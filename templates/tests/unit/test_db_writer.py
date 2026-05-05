"""Tests for runtime.nodes.db_writer.DbWriterNode against in-memory SQLite."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import polars as pl
import pytest
from sqlalchemy import create_engine, text

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.db_writer import DbWriterNode


@pytest.fixture()
def empty_db(tmp_path: Path) -> str:
    url = f"sqlite:///{tmp_path / 'writer.db'}"
    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE concept (id INTEGER, name TEXT)"))
    return url


@pytest.fixture()
def parquet_artifact(tmp_path: Path) -> Path:
    frame = pl.DataFrame({"id": [10, 20, 30], "name": ["a", "b", "c"]})
    path = tmp_path / "input.parquet"
    frame.write_parquet(path)
    return path


@pytest.fixture()
def context(tmp_path: Path, empty_db: str) -> NodeContext:
    return NodeContext(
        run_id="run-dbw",
        node_id="dbw-1",
        logger=logging.getLogger("test.dbw"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=empty_db,
    )


def test_type_name() -> None:
    assert DbWriterNode.type_name == "db_writer"


def test_appends_parquet_to_table(
    context: NodeContext, empty_db: str, parquet_artifact: Path
) -> None:
    params: dict[str, Any] = {
        "source_artifact": str(parquet_artifact),
        "target_table": "concept",
        "mode": "append",
    }
    result = DbWriterNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs == {"rows_written": 3, "target_table": "concept", "mode": "append"}

    engine = create_engine(empty_db)
    with engine.connect() as conn:
        count = conn.execute(text("SELECT COUNT(*) FROM concept")).scalar_one()
    assert count == 3


def test_truncate_mode_clears_then_writes(
    context: NodeContext, empty_db: str, parquet_artifact: Path
) -> None:
    engine = create_engine(empty_db)
    with engine.begin() as conn:
        conn.execute(text("INSERT INTO concept (id, name) VALUES (1, 'preexisting')"))

    params: dict[str, Any] = {
        "source_artifact": str(parquet_artifact),
        "target_table": "concept",
        "mode": "truncate",
    }
    result = DbWriterNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS

    with engine.connect() as conn:
        names = [
            r[0] for r in conn.execute(text("SELECT name FROM concept ORDER BY id")).fetchall()
        ]
    assert names == ["a", "b", "c"]


def test_invalid_mode_fails(context: NodeContext, parquet_artifact: Path) -> None:
    params: dict[str, Any] = {
        "source_artifact": str(parquet_artifact),
        "target_table": "concept",
        "mode": "weird",
    }
    result = DbWriterNode().run(context, params)
    assert result.status == NodeStatus.FAILED
    assert "mode" in (result.error_message or "")


def test_missing_artifact_fails(context: NodeContext) -> None:
    params: dict[str, Any] = {
        "source_artifact": "/nonexistent.parquet",
        "target_table": "concept",
        "mode": "append",
    }
    result = DbWriterNode().run(context, params)
    assert result.status == NodeStatus.FAILED
    assert "not found" in (result.error_message or "")
