"""SqlNode: execute one or more SQL statements via SQLAlchemy.

Connects to ``context.db_dsn``. ``statements`` runs in order inside a single
transaction. Optional ``fetch_query`` is run AFTER the transaction commits and
its rows are returned as ``outputs.rows`` (list of dicts). When
``result_artifact`` is set, the rows are also written as a JSON artifact under
that name so post-conditions like ``artifact_present`` can verify them.
"""

from __future__ import annotations

import json
from datetime import date, datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from runtime.nodes.base import Node, NodeContext, NodeResult, NodeStatus


def _json_default(value: Any) -> Any:
    """Serialize types SQLAlchemy returns that json.dumps doesn't handle natively."""
    if isinstance(value, datetime | date):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    raise TypeError(f"Object of type {type(value).__name__} is not JSON serializable")


class SqlNode(Node):
    """Execute SQL statements against the run's DSN."""

    type_name = "sql"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        if not context.db_dsn:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="SqlNode requires context.db_dsn to be set",
            )
        statements = list(params.get("statements", []))
        if not statements:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="SqlNode requires non-empty 'statements' list",
            )
        fetch_query = params.get("fetch_query")
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
