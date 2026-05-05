"""Dagster stub — proves the OrchestrationBackend interface is portable."""

from __future__ import annotations

from runtime.orchestration.flow_spec import FlowSpec
from runtime.orchestration.interface import (
    ArtifactRef,
    LogLine,
    OrchestrationBackend,
    RunHandle,
    RunStatus,
)
from runtime.orchestration.storage import LocalFilesystemStorage


class DagsterBackend(OrchestrationBackend):
    """Dagster adapter — not implemented in Phase 0."""

    def __init__(self, *, storage: LocalFilesystemStorage) -> None:
        self.storage = storage

    def submit(self, flow: FlowSpec) -> RunHandle:
        raise NotImplementedError("DagsterBackend is a Phase 0 stub")

    def get_status(self, handle: RunHandle) -> RunStatus:
        raise NotImplementedError("DagsterBackend is a Phase 0 stub")

    def get_logs(self, handle: RunHandle, *, limit: int = 1000) -> list[LogLine]:
        raise NotImplementedError("DagsterBackend is a Phase 0 stub")

    def cancel(self, handle: RunHandle) -> None:
        raise NotImplementedError("DagsterBackend is a Phase 0 stub")

    def list_artifacts(self, handle: RunHandle) -> list[ArtifactRef]:
        raise NotImplementedError("DagsterBackend is a Phase 0 stub")
