"""Prefect 3.x adapter implementing OrchestrationBackend.

Each FlowNode becomes one Prefect task. Dependencies are wired via
``wait_for=``. The backend tracks runs in an in-memory dict keyed by
backend_id; status transitions and logs are recorded synchronously.
"""

from __future__ import annotations

import asyncio
import logging
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from prefect import flow, get_run_logger, task

from runtime.nodes.base import NodeContext, NodeResult, NodeStatus
from runtime.orchestration.flow_spec import FlowNode, FlowSpec
from runtime.orchestration.interface import (
    ArtifactRef,
    LogLine,
    OrchestrationBackend,
    RunDetails,
    RunHandle,
    RunStatus,
)
from runtime.orchestration.node_registry import get_node_class
from runtime.orchestration.storage import LocalFilesystemStorage


@dataclass
class _RunRecord:
    """Per-run bookkeeping for the Prefect backend."""

    flow_id: str
    status: RunStatus = RunStatus.PENDING
    logs: list[LogLine] = field(default_factory=list)
    started_at: float = 0.0
    finished_at: float = 0.0
    thread: threading.Thread | None = None
    total_nodes: int = 0
    completed_nodes: set[str] = field(default_factory=set)
    current_node: str | None = None
    error_message: str | None = None


class PrefectBackend(OrchestrationBackend):
    """OrchestrationBackend implemented with Prefect 3.x."""

    def __init__(
        self,
        *,
        storage: LocalFilesystemStorage,
        db_dsn: str | None = None,
        logger: logging.Logger | None = None,
    ) -> None:
        self.storage = storage
        self.db_dsn = db_dsn
        self.logger = logger or logging.getLogger("parthenon.templates.prefect")
        self._runs: dict[str, _RunRecord] = {}
        self._lock = threading.Lock()

    # -- OrchestrationBackend interface ----------------------------------

    def submit(self, flow: FlowSpec) -> RunHandle:
        flow.validate()
        run_id = str(uuid.uuid4())
        backend_id = run_id
        record = _RunRecord(
            flow_id=flow.flow_id,
            status=RunStatus.QUEUED,
            total_nodes=len(flow.nodes),
        )
        with self._lock:
            self._runs[backend_id] = record

        thread = threading.Thread(
            target=self._execute_in_thread,
            args=(run_id, backend_id, flow),
            daemon=True,
            name=f"prefect-flow-{run_id[:8]}",
        )
        record.thread = thread
        thread.start()
        return RunHandle(run_id=run_id, backend_id=backend_id)

    def get_status(self, handle: RunHandle) -> RunStatus:
        with self._lock:
            record = self._runs.get(handle.backend_id)
        return record.status if record else RunStatus.PENDING

    def get_run_details(self, handle: RunHandle) -> RunDetails:
        with self._lock:
            record = self._runs.get(handle.backend_id)
        if record is None:
            return RunDetails(status=RunStatus.PENDING)

        progress = 0.0
        if record.total_nodes > 0:
            progress = min(1.0, len(record.completed_nodes) / record.total_nodes)
        # Once the run reaches a terminal state, force progress to 1.0 (or 0.0
        # if it never started any nodes) so the UI doesn't show e.g. 67%
        # forever after a failure.
        if record.status == RunStatus.COMPLETED:
            progress = 1.0

        return RunDetails(
            status=record.status,
            progress=progress,
            current_node=record.current_node,
            started_at=_iso_or_none(record.started_at),
            finished_at=_iso_or_none(record.finished_at),
            error_message=record.error_message,
        )

    def get_logs(self, handle: RunHandle, *, limit: int = 1000) -> list[LogLine]:
        with self._lock:
            record = self._runs.get(handle.backend_id)
        if not record:
            return []
        return list(record.logs[:limit])

    def cancel(self, handle: RunHandle) -> None:
        with self._lock:
            record = self._runs.get(handle.backend_id)
            if record and record.status in {RunStatus.QUEUED, RunStatus.RUNNING}:
                record.status = RunStatus.CANCELLED

    def list_artifacts(self, handle: RunHandle) -> list[ArtifactRef]:
        return self.storage.list_artifacts(run_id=handle.run_id)

    # -- helper used by tests ---------------------------------------------

    def wait_for(self, handle: RunHandle, *, timeout_seconds: float = 120.0) -> RunStatus:
        deadline = time.monotonic() + timeout_seconds
        while time.monotonic() < deadline:
            status = self.get_status(handle)
            if status in {RunStatus.COMPLETED, RunStatus.FAILED, RunStatus.CANCELLED}:
                return status
            time.sleep(0.2)
        return self.get_status(handle)

    # -- internals ---------------------------------------------------------

    def _execute_in_thread(self, run_id: str, backend_id: str, flow_spec: FlowSpec) -> None:
        with self._lock:
            self._runs[backend_id].status = RunStatus.RUNNING
            self._runs[backend_id].started_at = time.time()

        try:
            asyncio.run(self._run_prefect_flow(run_id, backend_id, flow_spec))
        except Exception as exc:
            self._append_log(backend_id, None, "ERROR", f"flow crashed: {exc}")
            with self._lock:
                self._runs[backend_id].status = RunStatus.FAILED
        finally:
            with self._lock:
                self._runs[backend_id].finished_at = time.time()

    async def _run_prefect_flow(self, run_id: str, backend_id: str, flow_spec: FlowSpec) -> None:
        backend = self  # captured by inner closures

        @task(name="run-node", retries=0)
        def execute_node(node: FlowNode) -> NodeResult:
            logger = get_run_logger()
            artifact_dir = backend.storage.artifact_dir(run_id=run_id, node_id=node.node_id)
            ctx = NodeContext(
                run_id=run_id,
                node_id=node.node_id,
                logger=logging.getLogger(f"node.{node.node_id}"),
                secrets={},
                artifact_dir=artifact_dir,
                db_dsn=backend.db_dsn,
                manifest_dir=flow_spec.manifest_dir,
                run_parameters=dict(flow_spec.parameters),
            )
            cls = get_node_class(node.type_name)
            backend._append_log(backend_id, node.node_id, "INFO", f"start {node.type_name}")
            result = cls().run(ctx, dict(node.params))
            backend._append_log(
                backend_id, node.node_id, "INFO", f"end status={result.status.value}"
            )
            logger.info("node %s -> %s", node.node_id, result.status.value)
            if result.status == NodeStatus.FAILED:
                raise RuntimeError(f"node {node.node_id} failed: {result.error_message}")
            return result

        @flow(name=flow_spec.flow_id)
        def parthenon_flow() -> dict[str, NodeResult]:
            futures: dict[str, Any] = {}
            for fnode in flow_spec.nodes:
                wait_for_list = [futures[d] for d in fnode.depends_on]
                futures[fnode.node_id] = execute_node.submit(  # type: ignore[call-overload]
                    fnode, wait_for=wait_for_list
                )
            return {nid: fut.result() for nid, fut in futures.items()}

        try:
            parthenon_flow()
        except Exception as exc:
            self._append_log(backend_id, None, "ERROR", f"flow failed: {exc}")
            with self._lock:
                self._runs[backend_id].status = RunStatus.FAILED
            return

        with self._lock:
            if self._runs[backend_id].status == RunStatus.RUNNING:
                self._runs[backend_id].status = RunStatus.COMPLETED

    def _append_log(self, backend_id: str, node_id: str | None, level: str, message: str) -> None:
        line = LogLine(
            timestamp=datetime.now(UTC).isoformat(),
            node_id=node_id,
            level=level,
            message=message,
        )
        with self._lock:
            record = self._runs.get(backend_id)
            if record is None:
                return
            record.logs.append(line)

            # Track current_node and completed_nodes for progress reporting.
            # Conventions used by execute_node above:
            #   "start <type>"             — node begins (node_id set)
            #   "end status=success"       — node completed successfully
            #   "end status=<other>"       — node completed but not OK; do not
            #                                count toward progress
            if node_id is not None:
                if message.startswith("start "):
                    record.current_node = node_id
                elif message.startswith("end status="):
                    if message == "end status=success":
                        record.completed_nodes.add(node_id)
                    # Whether success or failure, this node is no longer
                    # "current" — clear it so the UI shows nothing in-flight.
                    if record.current_node == node_id:
                        record.current_node = None

            # First ERROR-level message wins as the error_message surface
            # (subsequent crash logs are noisy and less informative).
            if level == "ERROR" and record.error_message is None:
                record.error_message = message


def _iso_or_none(ts: float) -> str | None:
    """Convert an epoch float (0.0 == unset) to ISO-8601 UTC."""
    if ts <= 0.0:
        return None
    return datetime.fromtimestamp(ts, UTC).isoformat()
