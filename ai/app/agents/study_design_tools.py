"""Custom Claude Agent SDK tools for the Study Designer.

Each tool is a thin authenticated client over an existing Laravel study-design
route. The agent never touches the database directly: Laravel enforces RBAC,
validation, and audit, and performs all writes. Route context (study slug,
session id, version id, scoped token) is captured per session via closures.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from typing import Any

import httpx
from claude_agent_sdk import tool

from app.config import settings

logger = logging.getLogger(__name__)

_TIMEOUT = 60.0


@dataclass(frozen=True)
class StudyDesignToolContext:
    study_slug: str
    design_session_id: int
    version_id: int | None
    auth_token: str

    @property
    def version_base(self) -> str:
        return (
            f"studies/{self.study_slug}/design-sessions/{self.design_session_id}"
            f"/versions/{self.version_id}"
        )


def _api_url(path: str) -> str:
    base = settings.agency_api_base_url.rstrip("/")
    return f"{base}/api/v1/{path.lstrip('/')}"


def _text(payload: Any) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": json.dumps(payload, default=str)[:20000]}]}


def _error(message: str) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": message}], "is_error": True}


async def _request(
    ctx: "StudyDesignToolContext",
    method: str,
    path: str,
    *,
    params: dict | None = None,
    json_body: dict | None = None,
) -> dict[str, Any]:
    headers = {
        "Authorization": f"Bearer {ctx.auth_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.request(
                method, _api_url(path), headers=headers, params=params, json=json_body
            )
    except httpx.HTTPError as exc:
        return _error(f"tool transport error calling {path}: {exc}")

    if resp.status_code >= 400:
        return _error(f"Laravel returned {resp.status_code} for {path}: {resp.text[:500]}")
    try:
        body = resp.json()
    except ValueError:
        body = {"raw": resp.text[:2000]}
    return _text(body.get("data", body) if isinstance(body, dict) else body)


def build_tool_pack(ctx: "StudyDesignToolContext") -> list:
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
        return await _request(ctx, "GET", "vocabulary/search", params=params)

    @tool(
        "get_guidance",
        "Get the current Study Design Compiler guidance: readiness gates, blocking issues, and next-best-actions for this version.",
        {},
    )
    async def get_guidance(args: dict[str, Any]) -> dict[str, Any]:
        return await _request(ctx, "GET", f"{ctx.version_base}/guidance")

    @tool(
        "recommend_phenotypes",
        "Recommend phenotype candidates for this version's intent. Stages draft assets; does not modify canonical study records.",
        {},
    )
    async def recommend_phenotypes(args: dict[str, Any]) -> dict[str, Any]:
        return await _request(ctx, "POST", f"{ctx.version_base}/phenotypes/recommend", json_body={})

    @tool(
        "draft_concept_sets",
        "Draft one or more concept sets as proposals. Each draft needs a title and a non-empty concepts list of {concept_id, include_descendants?, is_excluded?, include_mapped?}. Stages drafts only; materialization requires human approval (not available yet).",
        {"drafts": list},
    )
    async def draft_concept_sets(args: dict[str, Any]) -> dict[str, Any]:
        return await _request(
            ctx,
            "POST",
            f"{ctx.version_base}/concept-sets/draft",
            json_body={"drafts": args["drafts"]},
        )

    return [search_concepts, get_guidance, recommend_phenotypes, draft_concept_sets]
