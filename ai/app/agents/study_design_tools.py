"""Custom Claude Agent SDK tools for the Study Designer.

Each tool is a thin authenticated client over an existing Laravel study-design
route. The agent never touches the database directly: Laravel enforces RBAC,
validation, and audit, and performs all writes. Route context (study slug,
session id, version id, scoped token) is captured per session via closures.
"""

from __future__ import annotations

import logging
from typing import Any

from claude_agent_sdk import tool

from app.agents.tool_base import AgentToolContext, error_result, request

logger = logging.getLogger(__name__)


def _version_base(ctx: AgentToolContext) -> str:
    study_slug = ctx.context["study_slug"]
    design_session_id = ctx.context["design_session_id"]
    version_id = ctx.context.get("version_id")
    return (
        f"studies/{study_slug}/design-sessions/{design_session_id}"
        f"/versions/{version_id}"
    )


def _require_version(ctx: AgentToolContext) -> dict[str, Any] | None:
    """Guard for version-scoped tools: return a clear error if no version is set.

    Without this, ``_version_base`` would interpolate ``versions/None`` and every
    version-scoped route would 404 with an opaque message.
    """
    if ctx.context.get("version_id") is None:
        return error_result(
            "No study design version is selected. Ask the user to create or select "
            "a study design version before using this tool."
        )
    return None


def build_tool_pack(ctx: AgentToolContext) -> list:
    """Return the read/draft tool list for a session (Phase 1 — no materialization)."""

    @tool(
        "search_concepts",
        "Search the OMOP vocabulary for standard concepts by free text. Use before drafting concept sets.",
        {"query": str, "domain": str, "vocabulary": str, "limit": int},
    )
    async def search_concepts(args: dict[str, Any]) -> dict[str, Any]:
        params = {"q": args["query"], "limit": args.get("limit", 20)}
        if args.get("domain"):
            params["domain"] = args["domain"]
        if args.get("vocabulary"):
            params["vocabulary"] = args["vocabulary"]
        return await request(ctx, "GET", "vocabulary/search", params=params)

    @tool(
        "get_guidance",
        "Get the current Study Design Compiler guidance: readiness gates, blocking issues, and next-best-actions for this version.",
        {},
    )
    async def get_guidance(args: dict[str, Any]) -> dict[str, Any]:
        guard = _require_version(ctx)
        if guard is not None:
            return guard
        return await request(ctx, "GET", f"{_version_base(ctx)}/guidance")

    @tool(
        "recommend_phenotypes",
        "Recommend phenotype candidates for this version's intent. Stages draft assets; does not modify canonical study records.",
        {},
    )
    async def recommend_phenotypes(args: dict[str, Any]) -> dict[str, Any]:
        guard = _require_version(ctx)
        if guard is not None:
            return guard
        return await request(ctx, "POST", f"{_version_base(ctx)}/phenotypes/recommend", json_body={})

    @tool(
        "draft_concept_sets",
        "Draft one or more concept sets as proposals. Each draft needs a title and a non-empty concepts list of {concept_id, include_descendants?, is_excluded?, include_mapped?}. Stages drafts only; materialization requires human approval (not available yet).",
        {"drafts": list},
    )
    async def draft_concept_sets(args: dict[str, Any]) -> dict[str, Any]:
        guard = _require_version(ctx)
        if guard is not None:
            return guard
        return await request(
            ctx,
            "POST",
            f"{_version_base(ctx)}/concept-sets/draft",
            json_body={"drafts": args["drafts"]},
        )

    return [search_concepts, get_guidance, recommend_phenotypes, draft_concept_sets]
