"""DbReaderNode: execute a SELECT and persist the result set to a Parquet artifact."""

from __future__ import annotations

from typing import Any

import polars as pl
from sqlalchemy import create_engine, text
from sqlalchemy.exc import SQLAlchemyError

from runtime.nodes.base import Node, NodeArtifact, NodeContext, NodeResult, NodeStatus


class DbReaderNode(Node):
    """Read rows from the run DSN into a Polars frame and emit a Parquet artifact."""

    type_name = "db_reader"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        if not context.db_dsn:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="DbReaderNode requires context.db_dsn",
            )
        query = params.get("query")
        artifact_name = str(params.get("artifact_name", "result.parquet"))
        bind_params: dict[str, Any] = dict(params.get("parameters") or {})
        if not query:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="DbReaderNode requires 'query' parameter",
            )

        engine = create_engine(context.db_dsn, future=True)
        try:
            with engine.connect() as conn:
                cursor = conn.execute(text(str(query)), bind_params)
                columns = list(cursor.keys())
                rows = [dict(zip(columns, row, strict=False)) for row in cursor.fetchall()]
        except SQLAlchemyError as exc:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"{type(exc).__name__}: {exc}",
            )

        frame = pl.DataFrame(rows) if rows else pl.DataFrame({c: [] for c in columns})
        artifact_path = context.artifact_dir / artifact_name
        artifact_path.parent.mkdir(parents=True, exist_ok=True)
        frame.write_parquet(artifact_path)

        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={
                "row_count": frame.height,
                "columns": columns,
                "artifact_name": artifact_name,
            },
            artifacts=[
                NodeArtifact(
                    name=artifact_name,
                    path=artifact_path,
                    media_type="application/x-parquet",
                    size_bytes=artifact_path.stat().st_size,
                )
            ],
        )
