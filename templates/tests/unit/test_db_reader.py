"""Tests for runtime.nodes.db_reader.DbReaderNode against in-memory SQLite."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import create_engine, text

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.db_reader import DbReaderNode


@pytest.fixture()
def seeded_db(tmp_path: Path) -> str:
    url = f"sqlite:///{tmp_path / 'reader.db'}"
    engine = create_engine(url)
    with engine.begin() as conn:
        conn.execute(text("CREATE TABLE person (id INTEGER, name TEXT, age INTEGER)"))
        conn.execute(text("INSERT INTO person VALUES (1, 'alice', 33), (2, 'bob', 41)"))
    return url


@pytest.fixture()
def context(tmp_path: Path, seeded_db: str) -> NodeContext:
    return NodeContext(
        run_id="run-dbr",
        node_id="dbr-1",
        logger=logging.getLogger("test.dbr"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=seeded_db,
    )


def test_type_name() -> None:
    assert DbReaderNode.type_name == "db_reader"


def test_reads_query_to_parquet(context: NodeContext) -> None:
    params: dict[str, Any] = {
        "query": "SELECT id, name, age FROM person ORDER BY id",
        "artifact_name": "people.parquet",
    }
    result = DbReaderNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs["row_count"] == 2
    assert result.outputs["columns"] == ["id", "name", "age"]
    assert len(result.artifacts) == 1
    assert result.artifacts[0].name == "people.parquet"


def test_query_with_bind_parameters(context: NodeContext) -> None:
    params: dict[str, Any] = {
        "query": "SELECT id FROM person WHERE age > :min_age",
        "parameters": {"min_age": 35},
        "artifact_name": "old.parquet",
    }
    result = DbReaderNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs["row_count"] == 1


def test_missing_dsn_fails(tmp_path: Path) -> None:
    ctx = NodeContext(
        run_id="r",
        node_id="n",
        logger=logging.getLogger("test"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )
    result = DbReaderNode().run(ctx, {"query": "SELECT 1", "artifact_name": "x.parquet"})
    assert result.status == NodeStatus.FAILED
    assert "db_dsn" in (result.error_message or "")


def test_missing_query_fails(context: NodeContext) -> None:
    result = DbReaderNode().run(context, {"artifact_name": "x.parquet"})
    assert result.status == NodeStatus.FAILED
    assert "query" in (result.error_message or "")
