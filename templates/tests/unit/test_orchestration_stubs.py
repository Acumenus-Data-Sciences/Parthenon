"""Stub backends raise NotImplementedError to prove the interface seam."""

from __future__ import annotations

from pathlib import Path

import pytest

from runtime.orchestration.airflow_backend import AirflowBackend
from runtime.orchestration.dagster_backend import DagsterBackend
from runtime.orchestration.flow_spec import FlowNode, FlowSpec
from runtime.orchestration.storage import LocalFilesystemStorage
from runtime.orchestration.temporal_backend import TemporalBackend


@pytest.fixture()
def flow() -> FlowSpec:
    return FlowSpec(
        flow_id="x",
        nodes=[FlowNode(node_id="a", type_name="python", params={})],
    )


@pytest.mark.parametrize("cls", [TemporalBackend, DagsterBackend, AirflowBackend])
def test_stub_submit_raises(cls: type, flow: FlowSpec, tmp_path: Path) -> None:
    backend = cls(storage=LocalFilesystemStorage(root=tmp_path))
    with pytest.raises(NotImplementedError, match="Phase 0"):
        backend.submit(flow)
