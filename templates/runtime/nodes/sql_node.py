"""SqlNode: execute one or more SQL statements via SQLAlchemy.

Connects to ``context.db_dsn``. ``statements`` runs in order inside a single
transaction. Optional ``fetch_query`` is run AFTER the transaction commits and
its rows are returned as ``outputs.rows`` (list of dicts).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from runtime.nodes.base import Node, NodeContext, NodeResult, NodeStatus


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
                    outputs["rows"] = [
                        dict(zip(columns, row, strict=False)) for row in result_rows.fetchall()
                    ]
            except SQLAlchemyError as exc:
                return NodeResult(
                    status=NodeStatus.FAILED,
                    error_message=f"fetch_query failed: {exc}",
                )

        return NodeResult(status=NodeStatus.SUCCESS, outputs=outputs)
