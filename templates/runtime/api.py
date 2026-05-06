"""FastAPI app for parthenon-templates — health + catalog + run endpoints."""

from __future__ import annotations

from typing import Any

from fastapi import Depends, FastAPI, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, Field

from runtime import __version__
from runtime.dependencies import get_backend, get_registry
from runtime.middleware.internal_token import InternalTokenMiddleware
from runtime.orchestration.interface import OrchestrationBackend, RunHandle
from runtime.registry.manifest import Manifest
from runtime.registry.materializer import Materializer, ParameterValidationError
from runtime.registry.registry import Registry, TemplateNotFoundError

app = FastAPI(
    title="parthenon-templates",
    version=__version__,
    description="Internal-only ingestion templates runtime. Not exposed via Nginx.",
    docs_url="/docs",
    redoc_url=None,
    openapi_url="/openapi.json",
)

app.add_middleware(InternalTokenMiddleware)


class TemplateSummary(BaseModel):
    """Catalog summary for a single template (no full manifest payload)."""

    model_config = ConfigDict(extra="forbid")

    id: str
    name: str
    version: str
    category: str
    cdm_versions: list[str]
    tags: list[str]
    singleton: bool


class RunSubmitRequest(BaseModel):
    """Request body for ``POST /runs``."""

    model_config = ConfigDict(extra="forbid")

    template_id: str = Field(..., min_length=1)
    version: str = Field(..., pattern=r"^[0-9]+\.[0-9]+\.[0-9]+$")
    parameters: dict[str, Any] = Field(default_factory=dict)
    correlation_id: str | None = None


class RunSubmitResponse(BaseModel):
    """Response body for a successful ``POST /runs``."""

    model_config = ConfigDict(extra="forbid")

    run_id: str
    backend_id: str
    status: str
    sanitized_parameters: dict[str, Any]


class RunStatusResponse(BaseModel):
    """Response body for ``GET /runs/{run_id}``."""

    model_config = ConfigDict(extra="forbid")

    run_id: str
    status: str


class RunLogsResponse(BaseModel):
    """Response body for ``GET /runs/{run_id}/logs``."""

    model_config = ConfigDict(extra="forbid")

    run_id: str
    lines: list[dict[str, Any]]


class RunArtifactsResponse(BaseModel):
    """Response body for ``GET /runs/{run_id}/artifacts``."""

    model_config = ConfigDict(extra="forbid")

    run_id: str
    artifacts: list[dict[str, Any]]


# Process-wide map of run_id -> RunHandle. Phase 0 keeps run state in-memory;
# Phase 1 will persist this to the ``app.template_runs`` table.
_HANDLES: dict[str, RunHandle] = {}


def _summary(manifest: Manifest) -> TemplateSummary:
    return TemplateSummary(
        id=manifest.metadata.id,
        name=manifest.metadata.name,
        version=manifest.metadata.version,
        category=manifest.metadata.category,
        cdm_versions=list(manifest.metadata.cdm_versions),
        tags=list(manifest.metadata.tags),
        singleton=manifest.metadata.singleton,
    )


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    """Liveness probe. Intentionally unauthenticated."""
    return {"status": "ok", "service": "parthenon-templates"}


@app.get("/templates", response_model=list[TemplateSummary], tags=["catalog"])
def list_templates(
    registry: Registry = Depends(get_registry),
) -> list[TemplateSummary]:
    """Return the catalog of available templates (metadata only)."""
    return [_summary(m) for m in registry.list_templates()]


@app.get("/templates/{template_id}", tags=["catalog"])
def get_template(template_id: str, registry: Registry = Depends(get_registry)) -> dict[str, Any]:
    """Return the full manifest payload for ``template_id``."""
    try:
        manifest = registry.get_template(template_id)
    except TemplateNotFoundError as exc:
        raise HTTPException(status_code=404, detail=f"unknown template {template_id!r}") from exc
    return manifest.model_dump(mode="json")


@app.post(
    "/runs",
    response_model=RunSubmitResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["runs"],
)
def submit_run(
    body: RunSubmitRequest,
    registry: Registry = Depends(get_registry),
    backend: OrchestrationBackend = Depends(get_backend),
) -> RunSubmitResponse:
    """Materialize a template + parameters into a FlowSpec and submit it."""
    try:
        manifest = registry.get_template(body.template_id)
    except TemplateNotFoundError as exc:
        raise HTTPException(
            status_code=404, detail=f"unknown template {body.template_id!r}"
        ) from exc
    if manifest.metadata.version != body.version:
        raise HTTPException(
            status_code=409,
            detail=(
                f"version mismatch: registry has {manifest.metadata.version}, "
                f"caller requested {body.version}"
            ),
        )
    try:
        manifest_dir = registry.get_manifest_dir(body.template_id)
        flow, sanitized = Materializer().materialize(
            manifest, body.parameters, manifest_dir=manifest_dir
        )
    except ParameterValidationError as exc:
        raise HTTPException(status_code=422, detail=f"parameter validation failed: {exc}") from exc
    handle = backend.submit(flow)
    _HANDLES[handle.run_id] = handle
    return RunSubmitResponse(
        run_id=handle.run_id,
        backend_id=handle.backend_id,
        status=backend.get_status(handle).value,
        sanitized_parameters=sanitized,
    )


def _resolve_handle(run_id: str) -> RunHandle:
    handle = _HANDLES.get(run_id)
    if handle is None:
        raise HTTPException(status_code=404, detail=f"unknown run_id {run_id!r}")
    return handle


@app.get("/runs/{run_id}", response_model=RunStatusResponse, tags=["runs"])
def run_status(
    run_id: str,
    backend: OrchestrationBackend = Depends(get_backend),
) -> RunStatusResponse:
    """Return current status for a run."""
    handle = _resolve_handle(run_id)
    return RunStatusResponse(run_id=run_id, status=backend.get_status(handle).value)


@app.get("/runs/{run_id}/logs", response_model=RunLogsResponse, tags=["runs"])
def run_logs(
    run_id: str,
    backend: OrchestrationBackend = Depends(get_backend),
) -> RunLogsResponse:
    """Return up to 1000 log lines for a run."""
    handle = _resolve_handle(run_id)
    lines = backend.get_logs(handle, limit=1000)
    return RunLogsResponse(
        run_id=run_id,
        lines=[
            {
                "timestamp": line.timestamp,
                "node_id": line.node_id,
                "level": line.level,
                "message": line.message,
            }
            for line in lines
        ],
    )


@app.get("/runs/{run_id}/artifacts", response_model=RunArtifactsResponse, tags=["runs"])
def run_artifacts(
    run_id: str,
    backend: OrchestrationBackend = Depends(get_backend),
) -> RunArtifactsResponse:
    """List artifacts produced by a run."""
    handle = _resolve_handle(run_id)
    refs = backend.list_artifacts(handle)
    return RunArtifactsResponse(
        run_id=run_id,
        artifacts=[
            {
                "node_id": a.node_id,
                "name": a.name,
                "relative_path": a.relative_path,
                "size_bytes": a.size_bytes,
                "media_type": a.media_type,
            }
            for a in refs
        ],
    )


@app.delete("/runs/{run_id}", status_code=status.HTTP_204_NO_CONTENT, tags=["runs"])
def cancel_run(
    run_id: str,
    backend: OrchestrationBackend = Depends(get_backend),
) -> Response:
    """Best-effort cancel of an in-flight run."""
    handle = _resolve_handle(run_id)
    backend.cancel(handle)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
