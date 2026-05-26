"""Generic agent tool base: a per-session context + shared HTTP helpers.

Every agent profile's tools are thin authenticated clients over existing Laravel
routes. This module holds the parts that are identical across profiles: the
context (a scoped Sanctum token + a feature-specific id bag) and the
request/response shaping. Profile-specific tool packs live in ``<feature>_tools.py``
and call :func:`request` with the routes for their feature.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_TIMEOUT = 60.0


@dataclass(frozen=True)
class AgentToolContext:
    """Per-session tool context: a scoped Sanctum token + a feature id bag.

    ``context`` carries whatever ids a feature's tools need (e.g. ``study_slug``,
    ``design_session_id``, ``version_id`` for study design; ``draft_id``,
    ``study_id`` for publish). Tools read ids from it via ``ctx.context[...]``.
    """

    auth_token: str
    context: dict[str, Any] = field(default_factory=dict)


def api_url(path: str) -> str:
    base = settings.agency_api_base_url.rstrip("/")
    return f"{base}/api/v1/{path.lstrip('/')}"


def text_result(payload: Any) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": json.dumps(payload, default=str)[:20000]}]}


def error_result(message: str) -> dict[str, Any]:
    return {"content": [{"type": "text", "text": message}], "is_error": True}


async def request(
    ctx: AgentToolContext,
    method: str,
    path: str,
    *,
    params: dict | None = None,
    json_body: dict | None = None,
) -> dict[str, Any]:
    """Authenticated call to a Laravel API route, shaped as an MCP tool result."""
    headers = {
        "Authorization": f"Bearer {ctx.auth_token}",
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            resp = await client.request(
                method, api_url(path), headers=headers, params=params, json=json_body
            )
    except httpx.HTTPError as exc:
        return error_result(f"tool transport error calling {path}: {exc}")

    if resp.status_code >= 400:
        return error_result(f"Laravel returned {resp.status_code} for {path}: {resp.text[:500]}")
    try:
        body = resp.json()
    except ValueError:
        body = {"raw": resp.text[:2000]}
    return text_result(body.get("data", body) if isinstance(body, dict) else body)
