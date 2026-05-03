"""Tests for runtime.nodes.sql_node.SqlNode against an in-memory SQLite engine."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

import pytest
from sqlalchemy import create_engine, text

from runtime.nodes.base import NodeContext, NodeStatus
from runtime.nodes.sql_node import SqlNode


@pytest.fixture()
def sqlite_url(tmp_path: Path) -> str:
    return f"sqlite:///{tmp_path / 'sql_node.db'}"


@pytest.fixture()
def context(tmp_path: Path, sqlite_url: str) -> NodeContext:
    return NodeContext(
        run_id="run-sql",
        node_id="sql-1",
        logger=logging.getLogger("test.sql"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=sqlite_url,
    )


def test_type_name() -> None:
    assert SqlNode.type_name == "sql"


def test_executes_ddl_and_dml(context: NodeContext, sqlite_url: str) -> None:
    params: dict[str, Any] = {
        "statements": [
            "CREATE TABLE t (id INTEGER PRIMARY KEY, label TEXT)",
            "INSERT INTO t (id, label) VALUES (1, 'a'), (2, 'b')",
        ],
    }
    result = SqlNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs == {"statements_executed": 2}

    engine = create_engine(sqlite_url)
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT id, label FROM t ORDER BY id")).fetchall()
    assert [tuple(r) for r in rows] == [(1, "a"), (2, "b")]


def test_returns_rows_for_select(context: NodeContext) -> None:
    params: dict[str, Any] = {
        "statements": [
            "CREATE TABLE x (n INTEGER)",
            "INSERT INTO x (n) VALUES (10), (20)",
        ],
        "fetch_query": "SELECT n FROM x ORDER BY n",
    }
    result = SqlNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert result.outputs["rows"] == [{"n": 10}, {"n": 20}]


def test_missing_dsn_fails(tmp_path: Path) -> None:
    ctx = NodeContext(
        run_id="r",
        node_id="n",
        logger=logging.getLogger("test"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=None,
    )
    result = SqlNode().run(ctx, {"statements": ["SELECT 1"]})
    assert result.status == NodeStatus.FAILED
    assert "db_dsn" in (result.error_message or "")


def test_invalid_sql_fails(context: NodeContext) -> None:
    result = SqlNode().run(context, {"statements": ["NOT VALID SQL"]})
    assert result.status == NodeStatus.FAILED
    assert result.error_message is not None
