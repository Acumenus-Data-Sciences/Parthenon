"""Tests for runtime.nodes.sql_node.SqlNode against an in-memory SQLite engine."""

from __future__ import annotations

import json
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


def test_writes_result_artifact_when_named(context: NodeContext, tmp_path: Path) -> None:
    """When result_artifact is set, fetch_query rows are also written as a JSON file."""
    params: dict[str, Any] = {
        "statements": [
            "CREATE TABLE t (id INTEGER, label TEXT)",
            "INSERT INTO t VALUES (1, 'a'), (2, 'b')",
        ],
        "fetch_query": "SELECT id, label FROM t ORDER BY id",
        "result_artifact": "query_result",
    }
    result = SqlNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    artifact_path = tmp_path / "query_result.json"
    assert artifact_path.exists(), f"artifact not written: {list(tmp_path.iterdir())}"
    payload = json.loads(artifact_path.read_text(encoding="utf-8"))
    assert payload == {
        "columns": ["id", "label"],
        "rows": [{"id": 1, "label": "a"}, {"id": 2, "label": "b"}],
    }


def test_no_artifact_when_unnamed(context: NodeContext, tmp_path: Path) -> None:
    """fetch_query without result_artifact does not write a file (back-compat)."""
    params: dict[str, Any] = {
        "statements": ["CREATE TABLE t (id INTEGER)", "INSERT INTO t VALUES (1)"],
        "fetch_query": "SELECT id FROM t",
    }
    result = SqlNode().run(context, params)
    assert result.status == NodeStatus.SUCCESS
    assert not list(tmp_path.glob("*.json"))
