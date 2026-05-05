"""Tests for the orchestration ABC, FlowSpec serialization, and local storage."""

from __future__ import annotations

from pathlib import Path

import pytest

from runtime.orchestration.flow_spec import FlowNode, FlowSpec
from runtime.orchestration.interface import (
    OrchestrationBackend,
    RunHandle,
    RunStatus,
)
from runtime.orchestration.storage import LocalFilesystemStorage


def test_orchestration_backend_is_abstract() -> None:
    with pytest.raises(TypeError):
        OrchestrationBackend()  # type: ignore[abstract]


def test_run_status_values() -> None:
    assert {s.value for s in RunStatus} == {
        "pending",
        "queued",
        "running",
        "completed",
        "failed",
        "cancelled",
    }


def test_flow_spec_round_trips_through_dict() -> None:
    spec = FlowSpec(
        flow_id="hello-cdm",
        nodes=[
            FlowNode(node_id="n1", type_name="python", params={"code": "..."}),
            FlowNode(
                node_id="n2",
                type_name="sql",
                params={"statements": ["SELECT 1"]},
                depends_on=["n1"],
            ),
        ],
    )
    payload = spec.to_dict()
    restored = FlowSpec.from_dict(payload)
    assert restored.flow_id == spec.flow_id
    assert [n.node_id for n in restored.nodes] == ["n1", "n2"]
    assert restored.nodes[1].depends_on == ["n1"]


def test_flow_spec_rejects_cyclic_graph() -> None:
    with pytest.raises(ValueError, match="cycle"):
        FlowSpec(
            flow_id="bad",
            nodes=[
                FlowNode(node_id="a", type_name="python", params={}, depends_on=["b"]),
                FlowNode(node_id="b", type_name="python", params={}, depends_on=["a"]),
            ],
        ).validate()


def test_flow_spec_rejects_unknown_dependency() -> None:
    with pytest.raises(ValueError, match="unknown dependency"):
        FlowSpec(
            flow_id="bad2",
            nodes=[FlowNode(node_id="a", type_name="python", params={}, depends_on=["ghost"])],
        ).validate()


def test_local_filesystem_storage_writes_under_run_dir(tmp_path: Path) -> None:
    storage = LocalFilesystemStorage(root=tmp_path)
    artifact_dir = storage.artifact_dir(run_id="run-42", node_id="n1")
    assert artifact_dir == tmp_path / "run-42" / "n1"
    assert artifact_dir.exists()


def test_local_filesystem_storage_lists_artifacts(tmp_path: Path) -> None:
    storage = LocalFilesystemStorage(root=tmp_path)
    artifact_dir = storage.artifact_dir(run_id="r", node_id="n")
    (artifact_dir / "out.parquet").write_bytes(b"x")
    (artifact_dir / "log.txt").write_bytes(b"y")
    listed = storage.list_artifacts(run_id="r")
    names = sorted(a.name for a in listed)
    assert names == ["log.txt", "out.parquet"]


def test_run_handle_dataclass() -> None:
    handle = RunHandle(run_id="r-1", backend_id="prefect-deployment-uuid")
    assert handle.run_id == "r-1"
    assert handle.backend_id == "prefect-deployment-uuid"
