"""Tests for runtime.nodes.python_node.PythonNode."""

from __future__ import annotations

import logging
import textwrap
from pathlib import Path
from typing import Any

import pytest

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.python_node import PythonNode


@pytest.fixture()
def context(tmp_path: Path) -> NodeContext:
    return NodeContext(
        run_id="run-py",
        node_id="py-1",
        logger=logging.getLogger("test.python"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )


def test_type_name() -> None:
    assert PythonNode.type_name == "python"


def test_inline_code_returns_outputs(context: NodeContext) -> None:
    params: dict[str, Any] = {
        "code": textwrap.dedent(
            """
            def main(context, params):
                return {"sum": params["a"] + params["b"]}
            """
        ),
        "inputs": {"a": 2, "b": 3},
    }
    result = PythonNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs == {"sum": 5}


def test_missing_main_function_fails(context: NodeContext) -> None:
    params = {"code": "x = 1\n", "inputs": {}}
    result = PythonNode().run(context, params)
    assert result.status == NodeStatus.FAILED
    assert result.error_message is not None
    assert "main" in result.error_message


def test_runtime_exception_surfaces_in_result(context: NodeContext) -> None:
    params = {
        "code": "def main(context, params):\n    raise RuntimeError('boom')\n",
        "inputs": {},
    }
    result = PythonNode().run(context, params)
    assert result.status == NodeStatus.FAILED
    assert "boom" in (result.error_message or "")


def test_main_must_return_dict(context: NodeContext) -> None:
    params = {
        "code": "def main(context, params):\n    return 42\n",
        "inputs": {},
    }
    result = PythonNode().run(context, params)
    assert result.status == NodeStatus.FAILED
    assert "must return dict" in (result.error_message or "")
