"""PythonNode: execute inline Python code defining a ``main(context, params)`` function.

Use cases: trivial transforms, glue between two SQL nodes, validation helpers.
For non-trivial code, prefer Py2TableNode (DataFrame-shaped contract).
"""

from __future__ import annotations

import traceback
from typing import Any

from runtime.nodes.base import Node, NodeContext, NodeResult, NodeStatus


class PythonNode(Node):
    """Execute an inline ``code`` string. The string must define ``main(context, params)``."""

    type_name = "python"

    def run(self, context: NodeContext, params: dict[str, Any]) -> NodeResult:
        code = str(params.get("code", "")).strip()
        inputs = dict(params.get("inputs", {}))
        if not code:
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message="PythonNode requires a non-empty 'code' parameter",
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
                error_message="PythonNode 'code' must define a callable named 'main'",
            )

        try:
            result_value = main(context, inputs)
        except Exception as exc:
            tb = traceback.format_exc(limit=4)
            context.logger.error("python_node failure: %s\n%s", exc, tb)
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=f"{type(exc).__name__}: {exc}",
            )

        if not isinstance(result_value, dict):
            return NodeResult(
                status=NodeStatus.FAILED,
                error_message=(
                    f"PythonNode 'main' must return dict, got {type(result_value).__name__}"
                ),
            )

        return NodeResult(status=NodeStatus.SUCCESS, outputs=result_value)
