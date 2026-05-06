"""SqlNode: execute one or more SQL statements via SQLAlchemy.

Connects to ``context.db_dsn``. ``statements`` runs in order inside a single
transaction. Optional ``fetch_query`` is run AFTER the transaction commits and
its rows are returned as ``outputs.rows`` (list of dicts). When
``result_artifact`` is set, the rows are also written as a JSON artifact under
that name so post-conditions like ``artifact_present`` can verify them.

Phase 3 Plan 0 (T-022) added file-backed SQL bodies. Each side of the
inline/file pair is XOR — exactly one source must be set:

* ``statements: [...]`` (inline) XOR ``sql_file: file://<rel>`` (load from disk)
* ``fetch_query: "..."`` (inline) XOR ``fetch_query_file: file://<rel>``

File-backed bodies are read via :class:`runtime.sql_files.SqlFileResolver` and
expanded against the current run's ``params`` (``${parameters.NAME}`` tokens).
Multi-statement files are split on `;` for the bulk transaction; the
``fetch_query_file`` body is treated as a single SELECT.
"""

from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from runtime.nodes.base import Node, NodeContext, NodeResult, NodeStatus
from runtime.sql_files import SqlFileReadError, SqlFileResolver


def _json_default(value: Any) -> Any:
    """Serialize types SQLAlchemy returns that json.dumps doesn't handle natively."""
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


def _split_statements(body: str) -> list[str]:
    """Split a SQL file body into individual statements on ``;`` boundaries.

    Trims whitespace and drops empty fragments so trailing newlines / comments
    after the last ``;`` don't produce empty statements.
    """
    parts = [s.strip() for s in body.split(";")]
    return [p for p in parts if p]


class SqlNode(Node):
    """Execute SQL statements against the run's DSN."""

    type_name = "sql"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        if not context.db_dsn:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="SqlNode requires context.db_dsn to be set",
            )

        # Run-level parameter dict for ${parameters.NAME} expansion in SQL
        # files. The orchestration backend supplies these on NodeContext;
        # when callers don't (the dev runner, ad-hoc tests), fall back to the
        # node's own params dict so single-call usage still works.
        param_dict: dict[str, Any] = {**context.run_parameters, **params}

        # ---- Resolve statements: inline 'statements' XOR 'sql_file' ----
        sql_file = params.get("sql_file")
        inline_statements = params.get("statements")
        if sql_file and inline_statements:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=(
                    "SqlNode: exactly one of 'statements' or 'sql_file' may be set, not both"
                ),
            )
        if sql_file:
            if context.manifest_dir is None:
                return NodeResult(
                    status=NodeStatus.FAILED,
                    error_message=(
                        "SqlNode: 'sql_file' requires context.manifest_dir to be set "
                        "(the orchestration backend must plumb the manifest directory through)"
                    ),
                )
            try:
                body = SqlFileResolver(manifest_dir=context.manifest_dir).resolve(
                    sql_file, parameters=param_dict
                )
            except SqlFileReadError as exc:
                return NodeResult(
                    status=NodeStatus.FAILED,
                    error_message=f"SqlNode sql_file resolution failed: {exc}",
                )
            statements = _split_statements(body)
        else:
            statements = list(inline_statements or [])
        if not statements:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="SqlNode requires non-empty 'statements' list",
            )

        # ---- Resolve fetch_query: inline 'fetch_query' XOR 'fetch_query_file' ----
        fetch_query = params.get("fetch_query")
        fetch_query_file = params.get("fetch_query_file")
        if fetch_query and fetch_query_file:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=(
                    "SqlNode: exactly one of 'fetch_query' or 'fetch_query_file' may be set, "
                    "not both"
                ),
            )
        if fetch_query_file:
            if context.manifest_dir is None:
                return NodeResult(
                    status=NodeStatus.FAILED,
                    error_message=(
                        "SqlNode: 'fetch_query_file' requires context.manifest_dir to be set"
                    ),
                )
            try:
                fetch_query = SqlFileResolver(manifest_dir=context.manifest_dir).resolve(
                    fetch_query_file, parameters=param_dict
                )
            except SqlFileReadError as exc:
                return NodeResult(
                    status=NodeStatus.FAILED,
                    error_message=f"SqlNode fetch_query_file resolution failed: {exc}",
                )
        result_artifact = params.get("result_artifact")

        engine = create_engine(context.db_dsn, future=True)
        try:
            with engine.begin() as conn:
                for stmt in statements:
                    conn.execute(text(stmt))
        except SQLAlchemyError as exc:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"{type(exc).__name__}: {exc}",
            )

        outputs: dict[str, Any] = {"statements_executed": len(statements)}
        if fetch_query:
            try:
                with engine.connect() as conn:
                    result_rows = conn.execute(text(fetch_query))
                    columns = list(result_rows.keys())
                    rows = [dict(zip(columns, row, strict=False)) for row in result_rows.fetchall()]
            except SQLAlchemyError as exc:
                return NodeResult(
                    status=NodeStatus.FAILED,
                    error_message=f"fetch_query failed: {exc}",
                )
            outputs["rows"] = rows
            if result_artifact:
                payload = json.dumps(
                    {"columns": columns, "rows": rows},
                    default=_json_default,
                ).encode("utf-8")
                context.write_artifact(f"{result_artifact}.json", payload)

        return NodeResult(status=NodeStatus.SUCCESS, outputs=outputs)
