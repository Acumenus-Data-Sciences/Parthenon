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


# ----- Phase 3 Plan 0 Task 3: sql_file:// reader -----


def _ctx_with_manifest_dir(*, tmp_path: Path, sqlite_url: str, manifest_dir: Path) -> NodeContext:
    return NodeContext(
        run_id="run-sql-file",
        node_id="sql-file-1",
        logger=logging.getLogger("test.sql_file"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=sqlite_url,
        manifest_dir=manifest_dir,
    )


def test_sql_node_executes_sql_file(tmp_path: Path, sqlite_url: str) -> None:
    """sql_file: file://... loads the body from disk and executes it."""
    manifest_dir = tmp_path / "manifest"
    sql = manifest_dir / "sql" / "init.sql"
    sql.parent.mkdir(parents=True)
    sql.write_text("CREATE TABLE t (id INTEGER PRIMARY KEY)", encoding="utf-8")

    ctx = _ctx_with_manifest_dir(
        tmp_path=tmp_path, sqlite_url=sqlite_url, manifest_dir=manifest_dir
    )
    result = SqlNode().run(ctx, {"sql_file": "file://sql/init.sql"})
    assert result.status == NodeStatus.SUCCESS, result.error_message
    assert result.outputs["statements_executed"] == 1


def test_sql_node_sql_file_expands_parameters(tmp_path: Path, sqlite_url: str) -> None:
    """${parameters.NAME} placeholders are substituted from params."""
    manifest_dir = tmp_path / "manifest"
    sql = manifest_dir / "sql" / "create.sql"
    sql.parent.mkdir(parents=True)
    sql.write_text(
        "CREATE TABLE ${parameters.target_table} (id INTEGER)",
        encoding="utf-8",
    )

    ctx = _ctx_with_manifest_dir(
        tmp_path=tmp_path, sqlite_url=sqlite_url, manifest_dir=manifest_dir
    )
    result = SqlNode().run(ctx, {"sql_file": "file://sql/create.sql", "target_table": "widgets"})
    assert result.status == NodeStatus.SUCCESS, result.error_message

    engine = create_engine(sqlite_url)
    with engine.connect() as conn:
        # Insert + select to confirm the table 'widgets' was created (not the literal placeholder).
        conn.execute(text("INSERT INTO widgets (id) VALUES (42)"))
        rows = conn.execute(text("SELECT id FROM widgets")).fetchall()
    assert [tuple(r) for r in rows] == [(42,)]


def test_sql_node_sql_file_splits_statements_on_semicolon(tmp_path: Path, sqlite_url: str) -> None:
    """Multi-statement SQL files are executed in order in one transaction."""
    manifest_dir = tmp_path / "manifest"
    sql = manifest_dir / "sql" / "multi.sql"
    sql.parent.mkdir(parents=True)
    sql.write_text(
        "CREATE TABLE m (n INTEGER);\nINSERT INTO m (n) VALUES (1), (2), (3);\n",
        encoding="utf-8",
    )

    ctx = _ctx_with_manifest_dir(
        tmp_path=tmp_path, sqlite_url=sqlite_url, manifest_dir=manifest_dir
    )
    result = SqlNode().run(ctx, {"sql_file": "file://sql/multi.sql"})
    assert result.status == NodeStatus.SUCCESS, result.error_message
    assert result.outputs["statements_executed"] == 2

    engine = create_engine(sqlite_url)
    with engine.connect() as conn:
        rows = conn.execute(text("SELECT n FROM m ORDER BY n")).fetchall()
    assert [tuple(r) for r in rows] == [(1,), (2,), (3,)]


def test_sql_node_rejects_both_statements_and_sql_file(tmp_path: Path, sqlite_url: str) -> None:
    """Loud error when both inline statements and sql_file are set."""
    ctx = _ctx_with_manifest_dir(tmp_path=tmp_path, sqlite_url=sqlite_url, manifest_dir=tmp_path)
    result = SqlNode().run(ctx, {"statements": ["SELECT 1"], "sql_file": "file://x.sql"})
    assert result.status == NodeStatus.FAILED
    assert "exactly one of" in (result.error_message or "").lower()


def test_sql_node_sql_file_requires_manifest_dir(tmp_path: Path, sqlite_url: str) -> None:
    """sql_file without context.manifest_dir is a configuration error."""
    ctx = NodeContext(
        run_id="r",
        node_id="n",
        logger=logging.getLogger("test"),
        secrets={},
        artifact_dir=tmp_path,
        db_dsn=sqlite_url,
        manifest_dir=None,
    )
    result = SqlNode().run(ctx, {"sql_file": "file://x.sql"})
    assert result.status == NodeStatus.FAILED
    assert "manifest_dir" in (result.error_message or "")


def test_sql_node_fetch_query_file_loads_from_disk(tmp_path: Path, sqlite_url: str) -> None:
    """fetch_query_file is a file-backed alternative to fetch_query."""
    manifest_dir = tmp_path / "manifest"
    fetch = manifest_dir / "sql" / "fetch.sql"
    fetch.parent.mkdir(parents=True)
    fetch.write_text("SELECT n FROM x ORDER BY n", encoding="utf-8")

    ctx = _ctx_with_manifest_dir(
        tmp_path=tmp_path, sqlite_url=sqlite_url, manifest_dir=manifest_dir
    )
    params: dict[str, Any] = {
        "statements": [
            "CREATE TABLE x (n INTEGER)",
            "INSERT INTO x (n) VALUES (10), (20)",
        ],
        "fetch_query_file": "file://sql/fetch.sql",
    }
    result = SqlNode().run(ctx, params)
    assert result.status == NodeStatus.SUCCESS, result.error_message
    assert result.outputs["rows"] == [{"n": 10}, {"n": 20}]


def test_sql_node_rejects_both_fetch_query_and_fetch_query_file(
    tmp_path: Path, sqlite_url: str
) -> None:
    ctx = _ctx_with_manifest_dir(tmp_path=tmp_path, sqlite_url=sqlite_url, manifest_dir=tmp_path)
    params: dict[str, Any] = {
        "statements": ["CREATE TABLE z (id INTEGER)"],
        "fetch_query": "SELECT 1",
        "fetch_query_file": "file://x.sql",
    }
    result = SqlNode().run(ctx, params)
    assert result.status == NodeStatus.FAILED
    assert "exactly one of" in (result.error_message or "").lower()


def test_sql_node_sql_file_traversal_rejected(tmp_path: Path, sqlite_url: str) -> None:
    """Path-traversal references fail with a SqlNode error citing the resolver."""
    manifest_dir = tmp_path / "manifest"
    manifest_dir.mkdir()
    ctx = _ctx_with_manifest_dir(
        tmp_path=tmp_path, sqlite_url=sqlite_url, manifest_dir=manifest_dir
    )
    result = SqlNode().run(ctx, {"sql_file": "file://../../etc/passwd"})
    assert result.status == NodeStatus.FAILED
    assert result.error_message is not None
