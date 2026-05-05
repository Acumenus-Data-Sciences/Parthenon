"""Py2TableNode: Python transform with a strict ``DataFrame`` return contract."""

from __future__ import annotations

from typing import Any

import polars as pl

from runtime.nodes.base import Node, NodeArtifact, NodeContext, NodeResult, NodeStatus


class Py2TableNode(Node):
    """Run an inline ``main(context, params)`` and persist the result as Parquet."""

    type_name = "py2table"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        code = str(params.get("code", "")).strip()
        artifact_name = str(params.get("artifact_name", "py2table.parquet"))
        if not code:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="Py2TableNode requires a 'code' parameter",
            )

        namespace: dict[str, Any] = {}
        try:
            exec(compile(code, f"<{context.node_id}>", "exec"), namespace)
        except Exception as exc:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"compile error: {exc}",
            )

        main = namespace.get("main")
        if not callable(main):
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="Py2TableNode 'code' must define callable 'main'",
            )

        try:
            value = main(context, params.get("inputs") or {})
        except Exception as exc:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"{type(exc).__name__}: {exc}",
            )

        frame = self._coerce_frame(value)
        if frame is None:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=(
                    "Py2TableNode 'main' must return a polars DataFrame or dict; "
                    f"got {type(value).__name__}"
                ),
            )

        artifact_path = context.artifact_dir / artifact_name
        artifact_path.parent.mkdir(parents=True, exist_ok=True)
        frame.write_parquet(artifact_path)

        return NodeResult(
            status=NodeStatus.SUCCESS,
            outputs={
                "row_count": frame.height,
                "columns": list(frame.columns),
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

    @staticmethod
    def _coerce_frame(value: Any) -> pl.DataFrame | None:
        if isinstance(value, pl.DataFrame):
            return value
        if isinstance(value, dict):
            try:
                return pl.DataFrame(value)
            except Exception:
                return None
        return None
