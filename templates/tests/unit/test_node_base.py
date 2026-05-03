"""Tests for the Node ABC and NodeContext."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pytest

from runtime.nodes.base import (
    Node,
    NodeContext,
    NodeResult,
    NodeStatus,
)


class _StubNode(Node):
    """Minimal concrete Node used to exercise the ABC."""

    type_name = "stub"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        context.logger.info("stub running")
        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={"echo": params},
            artifacts=[],
        )


def test_node_is_abstract() -> None:
    with pytest.raises(TypeError):
        Node()  # type: ignore[abstract]


def test_node_subclass_must_implement_run() -> None:
    class Bad(Node):
        type_name = "bad"

    with pytest.raises(TypeError):
        Bad()  # type: ignore[abstract]


def test_node_subclass_must_set_type_name() -> None:
    class NoName(Node):
        def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
            return NodeResult(status=NodeStatus.SUCCESS, outputs={}, artifacts=[])

    with pytest.raises(ValueError, match="type_name"):
        NoName()


def test_node_context_has_required_attributes(tmp_path: Path) -> None:
    artifact_dir = tmp_path / "artifacts"
    artifact_dir.mkdir()

    secrets = {"API_KEY": "redacted"}
    ctx = NodeContext(
        run_id="run-1",
        node_id="node-1",
        logger=logging.getLogger("test"),
        secrets=secrets,
        artifact_dir=artifact_dir,
        db_dsn="postgresql+psycopg://parthenon_app@localhost:5432/parthenon",
    )
    assert ctx.run_id == "run-1"
    assert ctx.node_id == "node-1"
    assert ctx.get_secret("API_KEY") == "redacted"
    with pytest.raises(KeyError):
        ctx.get_secret("MISSING")
    assert ctx.artifact_dir == artifact_dir


def test_node_context_write_artifact(tmp_path: Path) -> None:
    ctx = NodeContext(
        run_id="run-1",
        node_id="node-1",
        logger=logging.getLogger("test"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )
    path = ctx.write_artifact("hello.txt", b"world")
    assert path == tmp_path / "hello.txt"
    assert path.read_bytes() == b"world"


def test_node_context_rejects_path_traversal(tmp_path: Path) -> None:
    ctx = NodeContext(
        run_id="run-1",
        node_id="node-1",
        logger=logging.getLogger("test"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )
    with pytest.raises(ValueError, match="path traversal"):
        ctx.write_artifact("../escape.txt", b"x")
    with pytest.raises(ValueError, match="path traversal"):
        ctx.write_artifact("/etc/passwd", b"x")


def test_node_runs_and_returns_result(tmp_path: Path) -> None:
    node = _StubNode()
    ctx = NodeContext(
        run_id="run-1",
        node_id="stub-1",
        logger=logging.getLogger("test"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )
    result = node.run(ctx, {"name": "world"})
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs == {"echo": {"name": "world"}}
    assert result.artifacts == []


def test_node_status_values() -> None:
    assert NodeStatus.PENDING.value == "pending"
    assert NodeStatus.RUNNING.value == "running"
    assert NodeStatus.SUCCESS.value == "success"
    assert NodeStatus.FAILED.value == "failed"
    assert NodeStatus.SKIPPED.value == "skipped"
