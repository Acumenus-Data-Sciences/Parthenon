from __future__ import annotations

import os
from typing import Any


def register(mcp: object) -> None:
    @mcp.tool(name="__TOOL_ID___catalog")
    def __TOOL_ID___catalog(payload: dict[str, Any] | None = None) -> dict[str, Any]:
        enabled = os.getenv("__ENV_PREFIX___ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}

        return {
            "service_name": "__TOOL_ID__",
            "display_name": "__DISPLAY_NAME__",
            "description": "__DESCRIPTION__",
            "enabled": enabled,
            "healthy": enabled,
            "mode": "__MODE__",
            "ui_hints": {
                "title": "__DISPLAY_NAME__",
                "summary": "__DESCRIPTION__",
                "accent": "slate",
                "workspace": "__DOMAIN__-workbench",
                "repository": None,
            },
            "capabilities": {
                "source_scoped": True,
                "replay_supported": True,
                "export_supported": True,
                "write_operations": False,
            },
            "_meta": {
                "tool_name": "__TOOL_ID___catalog",
                "generated_from": "community-workbench-sdk"
            }
        }

    return None
