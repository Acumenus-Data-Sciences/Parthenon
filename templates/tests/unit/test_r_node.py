"""Tests for runtime.nodes.r_node.RNode.

Skipped when Rscript is not on PATH (developer machines without R).
CI image is expected to install r-base-core.
"""

from __future__ import annotations

import logging
import shutil
from pathlib import Path
from typing import Any

import pytest

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.r_node import RNode

pytestmark = pytest.mark.skipif(
    shutil.which("Rscript") is None,
    reason="Rscript not available on this host",
)


@pytest.fixture()
def context(tmp_path: Path) -> NodeContext:
    return NodeContext(
        run_id="run-r",
        node_id="r-1",
        logger=logging.getLogger("test.r"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )


def test_type_name() -> None:
    assert RNode.type_name == "r"


def test_runs_inline_script(context: NodeContext) -> None:
    params: dict[str, Any] = {
        "script": 'cat("answer:", 42, "\\n")',
        "artifact_name": "r_stdout.txt",
    }
    result = RNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs["exit_code"] == 0
    assert "answer: 42" in result.outputs["stdout"]
    assert (context.artifact_dir / "r_stdout.txt").read_text(encoding="utf-8").strip() == (
        "answer: 42"
    )


def test_nonzero_exit_fails(context: NodeContext) -> None:
    params: dict[str, Any] = {
        "script": 'stop("explicit failure")',
        "artifact_name": "r_stdout.txt",
    }
    result = RNode().run(context, params)
    assert result.status == NodeStatus.FAILED
    assert (result.error_message or "").startswith("Rscript exited with code")


def test_missing_script_fails(context: NodeContext) -> None:
    result = RNode().run(context, {"artifact_name": "x.txt"})
    assert result.status == NodeStatus.FAILED
    assert "script" in (result.error_message or "")
