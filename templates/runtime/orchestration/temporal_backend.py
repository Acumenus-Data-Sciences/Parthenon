"""Temporal adapter — developer extension example for the portable OrchestrationBackend interface.

Not a shipped backend. This is a developer extension point: implement these methods
to enable Temporal orchestration. Prefect is the shipped default backend.
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


class TemporalBackend(OrchestrationBackend):
    """Temporal adapter — developer extension example (not a shipped backend)."""

    def __init__(self, *, storage: LocalFilesystemStorage) -> None:
        self.storage = storage

    def submit(self, flow: FlowSpec) -> RunHandle:
        raise NotImplementedError(
            "TemporalBackend is a developer-extension example; implement this method to enable Temporal orchestration"
        )

    def get_status(self, handle: RunHandle) -> RunStatus:
        raise NotImplementedError(
            "TemporalBackend is a developer-extension example; implement this method to enable Temporal orchestration"
        )

    def get_logs(self, handle: RunHandle, *, limit: int = 1000) -> list[LogLine]:
        raise NotImplementedError(
            "TemporalBackend is a developer-extension example; implement this method to enable Temporal orchestration"
        )

    def cancel(self, handle: RunHandle) -> None:
        raise NotImplementedError(
            "TemporalBackend is a developer-extension example; implement this method to enable Temporal orchestration"
        )

    def list_artifacts(self, handle: RunHandle) -> list[ArtifactRef]:
        raise NotImplementedError(
            "TemporalBackend is a developer-extension example; implement this method to enable Temporal orchestration"
        )
