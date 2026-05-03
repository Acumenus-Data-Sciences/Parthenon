"""DbWriterNode: load a Parquet artifact into a SQL table.

Modes: ``append`` (default) and ``truncate`` (DELETE FROM target then insert).
The Phase 0 implementation reads the Parquet file with Polars and inserts rows
through SQLAlchemy ``executemany``. This avoids the optional pyarrow dependency
that ``polars.DataFrame.write_database`` would otherwise require, while still
matching the pinned ``polars==1.17.1`` + ``sqlalchemy==2.0.36`` stack.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any

import polars as pl
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from runtime.nodes.base import Node, NodeContext, NodeResult, NodeStatus

_VALID_MODES = frozenset({"append", "truncate"})


class DbWriterNode(Node):
    """Write a Parquet artifact into a target table."""

    type_name = "db_writer"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        if not context.db_dsn:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="DbWriterNode requires context.db_dsn",
            )
        source_raw = params.get("source_artifact")
        target_table = str(params.get("target_table", "")).strip()
        mode = str(params.get("mode", "append"))
        if not source_raw or not target_table:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="DbWriterNode requires 'source_artifact' and 'target_table'",
            )
        if mode not in _VALID_MODES:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=(
                    f"DbWriterNode invalid mode '{mode}'; "
                    f"expected one of {sorted(_VALID_MODES)}"
                ),
            )
        source = Path(str(source_raw))
        if not source.exists():
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"source_artifact not found: {source}",
            )

        try:
            frame = pl.read_parquet(source)
        except Exception as exc:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"failed to read parquet: {exc}",
            )

        columns = list(frame.columns)
        rows = frame.to_dicts()

        engine = create_engine(context.db_dsn, future=True)
        try:
            with engine.begin() as conn:
                if mode == "truncate":
                    conn.execute(text(f"DELETE FROM {target_table}"))
                if rows:
                    placeholders = ", ".join(f":{col}" for col in columns)
                    column_list = ", ".join(columns)
                    insert_sql = (
                        f"INSERT INTO {target_table} ({column_list}) VALUES ({placeholders})"
                    )
                    conn.execute(text(insert_sql), rows)
        except SQLAlchemyError as exc:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"{type(exc).__name__}: {exc}",
            )

        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={
                "rows_written": frame.height,
                "target_table": target_table,
                "mode": mode,
            },
        )
