"""Tests for runtime.nodes.py2table.Py2TableNode.

Py2TableNode is a structured Python node that *must* return a Polars DataFrame.
It writes a Parquet artifact and exposes column metadata. Used for transforms
between two table-shaped boundaries.
"""

from __future__ import annotations

import logging
import textwrap
from pathlib import Path
from typing import Any

import pytest

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.py2table import Py2TableNode


@pytest.fixture()
def context(tmp_path: Path) -> NodeContext:
    return NodeContext(
        run_id="run-p2t",
        node_id="p2t-1",
        logger=logging.getLogger("test.p2t"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )


def test_type_name() -> None:
    assert Py2TableNode.type_name == "py2table"


def test_returns_polars_frame(context: NodeContext) -> None:
    code = textwrap.dedent(
        """
        import polars as pl

        def main(context, params):
            return pl.DataFrame({"x": [1, 2, 3], "y": ["a", "b", "c"]})
        """
    )
    params: dict[str, Any] = {"code": code, "artifact_name": "out.parquet"}
    result = Py2TableNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs["row_count"] == 3
    assert result.outputs["columns"] == ["x", "y"]
    assert len(result.artifacts) == 1


def test_pandas_frame_is_converted(context: NodeContext) -> None:
    """If user returns a dict, Py2TableNode coerces it via pl.DataFrame()."""
    code = textwrap.dedent(
        """
        def main(context, params):
            return {"a": [1, 2], "b": [3, 4]}
        """
    )
    result = Py2TableNode().run(context, {"code": code, "artifact_name": "out.parquet"})
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs["row_count"] == 2


def test_main_returning_non_dataframe_fails(context: NodeContext) -> None:
    code = "def main(context, params):\n    return 'oops'\n"
    result = Py2TableNode().run(context, {"code": code, "artifact_name": "out.parquet"})
    assert result.status == NodeStatus.FAILED
    assert "DataFrame" in (result.error_message or "")


def test_runtime_exception_surfaces(context: NodeContext) -> None:
    code = "def main(context, params):\n    raise ValueError('nope')\n"
    result = Py2TableNode().run(context, {"code": code, "artifact_name": "out.parquet"})
    assert result.status == NodeStatus.FAILED
    assert "nope" in (result.error_message or "")
