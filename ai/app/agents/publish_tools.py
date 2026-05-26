"""Custom Claude Agent SDK tools for the Publish assistant.

Each tool is a thin authenticated client over an existing Laravel publication
route. The agent never touches the database directly: Laravel enforces ownership
(PublicationDraftPolicy), validation, and audit.

Phase 1 (read-only): four tools that let the agent research a study and draft
IMRAD sections grounded in real analysis results. No writes, no snapshots.
Phase 2 (approval-gated write tools) is added in a subsequent task.
"""

from __future__ import annotations

import logging
from typing import Any

from claude_agent_sdk import tool

from app.agents.tool_base import AgentToolContext, error_result, request

logger = logging.getLogger(__name__)


def build_tool_pack(ctx: AgentToolContext) -> list:
    """Return the Phase-1 read tool list for a publish session."""

    @tool(
        "list_studies_for_publish",
        "List studies available to publish, with their analyses. Use to find the study to write about.",
        {},
    )
    async def list_studies_for_publish(args: dict[str, Any]) -> dict[str, Any]:
        return await request(
            ctx, "GET", "studies", params={"per_page": 100, "include": "analyses"}
        )

    @tool(
        "get_study_analyses",
        "Get a study and its analyses/results to ground the manuscript. Pass the study_id from list_studies_for_publish.",
        {"study_id": int},
    )
    async def get_study_analyses(args: dict[str, Any]) -> dict[str, Any]:
        sid = args.get("study_id")
        if not sid:
            return error_result(
                "study_id is required. Call list_studies_for_publish first and pass a study_id."
            )
        return await request(ctx, "GET", f"studies/{int(sid)}")

    @tool(
        "get_draft",
        "Read the current publication draft (title, template, document sections).",
        {},
    )
    async def get_draft(args: dict[str, Any]) -> dict[str, Any]:
        draft_id = ctx.context.get("draft_id")
        if not draft_id:
            return error_result("No publication draft is selected.")
        return await request(ctx, "GET", f"publish/drafts/{int(draft_id)}")

    @tool(
        "draft_narrative_section",
        (
            "Draft one IMRAD manuscript section grounded ONLY in the provided analysis context. "
            "section_type is one of methods|results|discussion|caption. "
            "This is a PROPOSAL the author edits; nothing is saved."
        ),
        {"section_type": str, "context": dict, "analysis_id": int, "execution_id": int},
    )
    async def draft_narrative_section(args: dict[str, Any]) -> dict[str, Any]:
        st = args.get("section_type")
        if st not in {"methods", "results", "discussion", "caption"}:
            return error_result(
                "section_type must be one of methods|results|discussion|caption."
            )
        body: dict[str, Any] = {
            "section_type": st,
            "context": args.get("context", {}),
        }
        if args.get("analysis_id"):
            body["analysis_id"] = int(args["analysis_id"])
        if args.get("execution_id"):
            body["execution_id"] = int(args["execution_id"])
        return await request(ctx, "POST", "publish/narrative", json_body=body)

    return [list_studies_for_publish, get_study_analyses, get_draft, draft_narrative_section]
