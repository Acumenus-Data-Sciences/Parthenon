"""OrchestrationBackend ABC: the seam between manifest execution and a chosen engine."""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum

from runtime.orchestration.flow_spec import FlowSpec


class RunStatus(str, Enum):
    """Backend-agnostic run statuses (mirrored in app.template_runs.status)."""

    PENDING = "pending"
    QUEUED = "queued"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass(frozen=True)
class RunHandle:
    """Returned from ``submit``; the caller uses it for status/log/cancel calls."""

    run_id: str
    backend_id: str


@dataclass
class LogLine:
    """One structured log entry returned by ``get_logs``."""

    timestamp: str
    node_id: str | None
    level: str
    message: str


@dataclass(frozen=True)
class ArtifactRef:
    """Pointer to a single artifact, exposed via the API."""

    run_id: str
    node_id: str
    name: str
    relative_path: str
    size_bytes: int
    media_type: str


@dataclass(frozen=True)
class RunDetails:
    """Rich run state surfaced by ``get_run_details``.

    Fields beyond ``status`` are best-effort and may be ``None`` when the
    backend cannot determine them. Laravel ``TemplateRunService::pollAndUpdate``
    only writes non-null values, so missing fields preserve the prior state.
    """

    status: RunStatus
    progress: float = 0.0
    current_node: str | None = None
    started_at: str | None = None  # ISO-8601 UTC
    finished_at: str | None = None  # ISO-8601 UTC
    error_message: str | None = None


class OrchestrationBackend(ABC):
    """Backend-agnostic execution surface."""

    @abstractmethod
    def submit(self, flow: FlowSpec) -> RunHandle:
        """Submit a flow for execution and return a RunHandle."""

    @abstractmethod
    def get_status(self, handle: RunHandle) -> RunStatus:
        """Return the current run status."""

    def get_run_details(self, handle: RunHandle) -> RunDetails:
        """Return rich run state. Default implementation falls back to status only.

        Backends that track per-node execution and timing should override this
        so the SPA can render progress, current node, and timestamps.
        """
        return RunDetails(status=self.get_status(handle))

    @abstractmethod
    def get_logs(self, handle: RunHandle, *, limit: int = 1000) -> list[LogLine]:
        """Return up to ``limit`` log lines."""

    @abstractmethod
    def cancel(self, handle: RunHandle) -> None:
        """Best-effort cancel."""

    @abstractmethod
    def list_artifacts(self, handle: RunHandle) -> list[ArtifactRef]:
        """List artifacts produced by this run."""
