"""Integration test: submit a 3-node FlowSpec via the Prefect backend.

Uses Prefect's ephemeral (in-memory) API so no external server is required.
"""

from __future__ import annotations

import logging
import textwrap
from pathlib import Path

import pytest

from runtime.orchestration.flow_spec import FlowNode, FlowSpec
from runtime.orchestration.interface import RunStatus
from runtime.orchestration.prefect_backend import PrefectBackend
from runtime.orchestration.storage import LocalFilesystemStorage


@pytest.fixture()
def storage(tmp_path: Path) -> LocalFilesystemStorage:
    return LocalFilesystemStorage(root=tmp_path / "storage")


@pytest.fixture()
def backend(storage: LocalFilesystemStorage) -> PrefectBackend:
    return PrefectBackend(storage=storage, logger=logging.getLogger("test.prefect"))


def test_three_node_hello_runs_to_completion(backend: PrefectBackend) -> None:
    flow = FlowSpec(
        flow_id="hello-3node",
        nodes=[
            FlowNode(
                node_id="generate",
                type_name="py2table",
                params={
                    "code": textwrap.dedent(
                        """
                        import polars as pl

                        def main(context, params):
                            return pl.DataFrame({"id": [1, 2, 3]})
                        """
                    ),
                    "artifact_name": "rows.parquet",
                },
            ),
            FlowNode(
                node_id="echo",
                type_name="python",
                params={
                    "code": (
                        "def main(context, params):\n" "    return {'message': 'hi from echo'}\n"
                    ),
                    "inputs": {},
                },
                depends_on=["generate"],
            ),
            FlowNode(
                node_id="finish",
                type_name="python",
                params={
                    "code": ("def main(context, params):\n" "    return {'final': True}\n"),
                    "inputs": {},
                },
                depends_on=["echo"],
            ),
        ],
    )

    handle = backend.submit(flow)
    final_status = backend.wait_for(handle, timeout_seconds=60)
    assert final_status == RunStatus.COMPLETED

    artifacts = backend.list_artifacts(handle)
    names = sorted(a.name for a in artifacts)
    assert "rows.parquet" in names

    logs = backend.get_logs(handle, limit=100)
    assert any("generate" in line.message or line.node_id == "generate" for line in logs)


def test_backend_threads_db_dsn_into_node_context(
    storage: LocalFilesystemStorage,
) -> None:
    """PrefectBackend(db_dsn=...) propagates the DSN into NodeContext for db nodes."""
    dsn = "postgresql+psycopg://example:5432/probe"
    backend_with_dsn = PrefectBackend(
        storage=storage, db_dsn=dsn, logger=logging.getLogger("test.prefect.dsn")
    )
    flow = FlowSpec(
        flow_id="dsn-probe",
        nodes=[
            FlowNode(
                node_id="echo_dsn",
                type_name="python",
                params={
                    "code": (
                        "def main(context, params):\n"
                        "    path = context.write_artifact('observed_dsn.txt',"
                        " (context.db_dsn or '').encode('utf-8'))\n"
                        "    return {'path': str(path)}\n"
                    ),
                    "inputs": {},
                },
            ),
        ],
    )
    handle = backend_with_dsn.submit(flow)
    final_status = backend_with_dsn.wait_for(handle, timeout_seconds=30)
    assert final_status == RunStatus.COMPLETED
    artifacts = backend_with_dsn.list_artifacts(handle)
    matching = [a for a in artifacts if a.name == "observed_dsn.txt"]
    assert matching, f"observed_dsn.txt not in artifacts: {[a.name for a in artifacts]}"
    observed = (storage.root / matching[0].relative_path).read_text(encoding="utf-8")
    assert observed == dsn


def test_failed_node_marks_run_failed(backend: PrefectBackend) -> None:
    flow = FlowSpec(
        flow_id="hello-fail",
        nodes=[
            FlowNode(
                node_id="boom",
                type_name="python",
                params={
                    "code": "def main(context, params):\n    raise RuntimeError('boom')\n",
                    "inputs": {},
                },
            ),
        ],
    )
    handle = backend.submit(flow)
    final_status = backend.wait_for(handle, timeout_seconds=30)
    assert final_status == RunStatus.FAILED
