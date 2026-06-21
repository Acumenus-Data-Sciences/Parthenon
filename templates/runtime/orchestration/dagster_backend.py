"""Dagster adapter — developer extension example for the portable OrchestrationBackend interface.

Not a shipped backend. This is a developer extension point: implement these methods
to enable Dagster orchestration. Prefect is the shipped default backend.
"""

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
    """Dagster adapter — developer extension example (not a shipped backend)."""

    def __init__(self, *, storage: LocalFilesystemStorage) -> None:
        self.storage = storage

    def submit(self, flow: FlowSpec) -> RunHandle:
        raise NotImplementedError(
            "DagsterBackend is a developer-extension example; implement this method to enable Dagster orchestration"
        )

    def get_status(self, handle: RunHandle) -> RunStatus:
        raise NotImplementedError(
            "DagsterBackend is a developer-extension example; implement this method to enable Dagster orchestration"
        )

    def get_logs(self, handle: RunHandle, *, limit: int = 1000) -> list[LogLine]:
        raise NotImplementedError(
            "DagsterBackend is a developer-extension example; implement this method to enable Dagster orchestration"
        )

    def cancel(self, handle: RunHandle) -> None:
        raise NotImplementedError(
            "DagsterBackend is a developer-extension example; implement this method to enable Dagster orchestration"
        )

    def list_artifacts(self, handle: RunHandle) -> list[ArtifactRef]:
        raise NotImplementedError(
            "DagsterBackend is a developer-extension example; implement this method to enable Dagster orchestration"
        )
