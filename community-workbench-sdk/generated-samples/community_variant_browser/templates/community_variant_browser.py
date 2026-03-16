from __future__ import annotations

import os
from typing import Any


def register(mcp: object) -> None:
    @mcp.tool(name="community_variant_browser_catalog")
    def community_variant_browser_catalog(payload: dict[str, Any] | None = None) -> dict[str, Any]:
        enabled = os.getenv("COMMUNITY_VARIANT_BROWSER_ENABLED", "").strip().lower() in {"1", "true", "yes", "on"}

        return {
            "service_name": "community_variant_browser",
            "display_name": "Community Variant Browser",
            "description": "Explore cohort-scoped genomic variants through a Parthenon workbench generated from the Community Workbench SDK.",
            "enabled": enabled,
            "healthy": enabled,
            "mode": "external-adapter",
            "ui_hints": {
                "title": "Community Variant Browser",
                "summary": "Explore cohort-scoped genomic variants through a Parthenon workbench generated from the Community Workbench SDK.",
                "accent": "slate",
                "workspace": "genomics-workbench",
                "repository": None,
            },
            "capabilities": {
                "source_scoped": True,
                "replay_supported": True,
                "export_supported": True,
                "write_operations": False,
            },
            "_meta": {
                "tool_name": "community_variant_browser_catalog",
                "generated_from": "community-workbench-sdk"
            }
        }

    return None
