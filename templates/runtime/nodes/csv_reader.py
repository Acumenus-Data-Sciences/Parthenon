"""CsvReaderNode: read a CSV from disk into a Polars frame, write Parquet artifact."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import polars as pl

from runtime.nodes.base import Node, NodeArtifact, NodeContext, NodeResult, NodeStatus

_POLARS_TYPE_MAP: dict[str, pl.DataType] = {
    "i64": pl.Int64(),
    "i32": pl.Int32(),
    "f64": pl.Float64(),
    "f32": pl.Float32(),
    "str": pl.Utf8(),
    "utf8": pl.Utf8(),
    "bool": pl.Boolean(),
    "date": pl.Date(),
    "datetime": pl.Datetime(),
}


class CsvReaderNode(Node):
    """Read CSV -> Polars DataFrame -> Parquet artifact."""

    type_name = "csv_reader"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        raw_path = params.get("path")
        if not raw_path:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="CsvReaderNode requires 'path' parameter",
            )
        path = Path(str(raw_path))
        if not path.exists():
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"CSV file not found: {path}",
            )

        delimiter = str(params.get("delimiter", ","))
        schema_param = params.get("schema") or {}
        dtypes: dict[str, pl.DataType] | None = None
        if schema_param:
            dtypes = {}
            for col, type_name in dict(schema_param).items():
                if type_name not in _POLARS_TYPE_MAP:
                    return NodeResult(
                        status=NodeStatus.FAILED,
                        error_message=f"unsupported polars dtype: {type_name}",
                    )
                dtypes[str(col)] = _POLARS_TYPE_MAP[type_name]

        try:
            frame = pl.read_csv(path, separator=delimiter, schema_overrides=dtypes)
        except Exception as exc:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"polars read_csv failed: {exc}",
            )

        artifact_name = f"{path.stem}.parquet"
        artifact_path = context.artifact_dir / artifact_name
        artifact_path.parent.mkdir(parents=True, exist_ok=True)
        frame.write_parquet(artifact_path)

        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={
                "row_count": frame.height,
                "columns": list(frame.columns),
                "dtypes": {
                    col: str(dtype) for col, dtype in zip(frame.columns, frame.dtypes, strict=False)
                },
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
