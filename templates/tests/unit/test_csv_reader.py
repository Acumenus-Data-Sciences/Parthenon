"""Tests for runtime.nodes.csv_reader.CsvReaderNode."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pytest

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.csv_reader import CsvReaderNode


@pytest.fixture()
def context(tmp_path: Path) -> NodeContext:
    return NodeContext(
        run_id="run-csv",
        node_id="csv-1",
        logger=logging.getLogger("test.csv"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )


def test_type_name() -> None:
    assert CsvReaderNode.type_name == "csv_reader"


def test_reads_csv_to_polars_frame(context: NodeContext, tmp_path: Path) -> None:
    csv_path = tmp_path / "input.csv"
    csv_path.write_text("a,b\n1,foo\n2,bar\n", encoding="utf-8")

    params: dict[str, Any] = {"path": str(csv_path)}
    result = CsvReaderNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs["row_count"] == 2
    assert result.outputs["columns"] == ["a", "b"]
    # The DataFrame is materialized to an artifact (Parquet) for downstream nodes.
    assert len(result.artifacts) == 1
    assert result.artifacts[0].name == "input.parquet"
    assert result.artifacts[0].media_type == "application/x-parquet"
    assert result.artifacts[0].path.exists()


def test_missing_path_fails(context: NodeContext) -> None:
    result = CsvReaderNode().run(context, {"path": "/nonexistent.csv"})
    assert result.status == NodeStatus.FAILED
    assert "not found" in (result.error_message or "")


def test_explicit_schema_override(context: NodeContext, tmp_path: Path) -> None:
    csv_path = tmp_path / "typed.csv"
    csv_path.write_text("id,score\n1,0.5\n2,0.75\n", encoding="utf-8")

    params: dict[str, Any] = {
        "path": str(csv_path),
        "schema": {"id": "i64", "score": "f64"},
    }
    result = CsvReaderNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs["dtypes"] == {"id": "Int64", "score": "Float64"}


def test_delimiter_override(context: NodeContext, tmp_path: Path) -> None:
    csv_path = tmp_path / "pipe.csv"
    csv_path.write_text("a|b\n1|x\n2|y\n", encoding="utf-8")
    params: dict[str, Any] = {"path": str(csv_path), "delimiter": "|"}
    result = CsvReaderNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs["columns"] == ["a", "b"]
