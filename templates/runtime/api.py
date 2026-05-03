"""FastAPI app for parthenon-templates."""

from __future__ import annotations

from fastapi import FastAPI

from runtime import __version__
from runtime.middleware.internal_token import InternalTokenMiddleware

app = FastAPI(
    title="parthenon-templates",
    version=__version__,
    description="Internal-only ingestion templates runtime. Not exposed via Nginx.",
    docs_url="/docs",
    redoc_url=None,
    openapi_url="/openapi.json",
)

app.add_middleware(InternalTokenMiddleware)


@app.get("/health", tags=["meta"])
def health() -> dict[str, str]:
    """Liveness probe. Intentionally unauthenticated."""
    return {"status": "ok", "service": "parthenon-templates"}
