"""Tests for the publish agent tool pack (Phase 1 — read-only).

respx mocks the Laravel API layer at http://nginx:80/api/v1. Every tool is
exercised for both the happy path and the Bug-C guard (optional id missing →
is_error, no HTTP call).
"""

from __future__ import annotations

import httpx
import respx

from app.agents.tool_base import AgentToolContext
from app.agents.publish_tools import build_tool_pack

BASE = "http://nginx:80/api/v1"


def _ctx() -> AgentToolContext:
    return AgentToolContext(
        auth_token="tok",
        context={"draft_id": 5, "study_id": 9},
    )


def _ctx_no_draft() -> AgentToolContext:
    return AgentToolContext(
        auth_token="tok",
        context={},
    )


# ---------------------------------------------------------------------------
# list_studies_for_publish
# ---------------------------------------------------------------------------


@respx.mock
async def test_list_studies_for_publish_calls_correct_url():
    route = respx.get(f"{BASE}/studies").mock(
        return_value=httpx.Response(
            200,
            json={"data": [{"id": 9, "title": "HTN study"}]},
        )
    )
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["list_studies_for_publish"].handler({})

    assert route.called
    req = route.calls.last.request
    assert req.headers["authorization"] == "Bearer tok"
    assert req.url.params["per_page"] == "100"
    assert req.url.params["include"] == "analyses"
    assert "HTN study" in result["content"][0]["text"]


# ---------------------------------------------------------------------------
# get_study_analyses
# ---------------------------------------------------------------------------


@respx.mock
async def test_get_study_analyses_calls_study_endpoint():
    route = respx.get(f"{BASE}/studies/9").mock(
        return_value=httpx.Response(
            200,
            json={"data": {"id": 9, "title": "HTN study", "analyses": []}},
        )
    )
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["get_study_analyses"].handler({"study_id": 9})

    assert route.called
    assert "HTN study" in result["content"][0]["text"]


@respx.mock
async def test_get_study_analyses_without_study_id_returns_error_no_http():
    # No route registered — if a call were made, respx would raise
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["get_study_analyses"].handler({})

    assert result.get("is_error") is True
    assert "study_id" in result["content"][0]["text"].lower()


# ---------------------------------------------------------------------------
# get_draft
# ---------------------------------------------------------------------------


@respx.mock
async def test_get_draft_calls_correct_url():
    route = respx.get(f"{BASE}/publish/drafts/5").mock(
        return_value=httpx.Response(
            200,
            json={"data": {"id": 5, "title": "My manuscript"}},
        )
    )
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["get_draft"].handler({})

    assert route.called
    assert "My manuscript" in result["content"][0]["text"]


@respx.mock
async def test_get_draft_without_draft_id_in_context_returns_error_no_http():
    # No route registered — confirms no HTTP call is attempted
    tools = {t.name: t for t in build_tool_pack(_ctx_no_draft())}
    result = await tools["get_draft"].handler({})

    assert result.get("is_error") is True
    assert "draft" in result["content"][0]["text"].lower()


# ---------------------------------------------------------------------------
# draft_narrative_section
# ---------------------------------------------------------------------------


@respx.mock
async def test_draft_narrative_section_posts_correct_body():
    route = respx.post(f"{BASE}/publish/narrative").mock(
        return_value=httpx.Response(
            200,
            json={"data": {"text": "The study enrolled ...", "section_type": "methods"}},
        )
    )
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["draft_narrative_section"].handler(
        {
            "section_type": "methods",
            "context": {"cohort_size": 1000},
            "analysis_id": 42,
            "execution_id": 7,
        }
    )

    assert route.called
    req = route.calls.last.request
    import json

    body = json.loads(req.content)
    assert body["section_type"] == "methods"
    assert body["context"] == {"cohort_size": 1000}
    assert body["analysis_id"] == 42
    assert body["execution_id"] == 7
    assert "The study enrolled" in result["content"][0]["text"]


@respx.mock
async def test_draft_narrative_section_invalid_section_type_returns_error_no_http():
    # No route registered — confirms no HTTP call is attempted
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["draft_narrative_section"].handler(
        {"section_type": "introduction", "context": {}}
    )

    assert result.get("is_error") is True
    assert "section_type" in result["content"][0]["text"].lower()


@respx.mock
async def test_draft_narrative_section_valid_section_types_all_accepted():
    """All four valid section types reach the endpoint without error."""
    for section_type in ("methods", "results", "discussion", "caption"):
        respx.post(f"{BASE}/publish/narrative").mock(
            return_value=httpx.Response(
                200,
                json={"data": {"text": f"Draft {section_type}", "section_type": section_type}},
            )
        )
        tools = {t.name: t for t in build_tool_pack(_ctx())}
        result = await tools["draft_narrative_section"].handler(
            {"section_type": section_type, "context": {}}
        )
        assert result.get("is_error") is not True, f"Unexpected error for section_type={section_type}"


# ---------------------------------------------------------------------------
# update_draft (Phase 2 write tool)
# ---------------------------------------------------------------------------


@respx.mock
async def test_update_draft_patches_correct_url():
    route = respx.patch(f"{BASE}/publish/drafts/5").mock(
        return_value=httpx.Response(
            200,
            json={"data": {"id": 5, "title": "New title"}},
        )
    )
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["update_draft"].handler({"title": "New title"})

    assert route.called
    import json
    body = json.loads(route.calls.last.request.content)
    assert body == {"title": "New title"}
    assert "New title" in result["content"][0]["text"]


@respx.mock
async def test_update_draft_sends_document_json():
    route = respx.patch(f"{BASE}/publish/drafts/5").mock(
        return_value=httpx.Response(
            200,
            json={"data": {"id": 5}},
        )
    )
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    doc = {"sections": [{"key": "methods", "content": "We enrolled..."}]}
    result = await tools["update_draft"].handler({"document_json": doc})

    assert route.called
    import json
    body = json.loads(route.calls.last.request.content)
    assert body == {"document_json": doc}
    assert result.get("is_error") is not True


@respx.mock
async def test_update_draft_without_draft_id_returns_error_no_http():
    # No route registered — confirms no HTTP call is made
    tools = {t.name: t for t in build_tool_pack(_ctx_no_draft())}
    result = await tools["update_draft"].handler({"title": "anything"})

    assert result.get("is_error") is True
    assert "draft" in result["content"][0]["text"].lower()


@respx.mock
async def test_update_draft_no_fields_returns_error_no_http():
    # No route registered — empty body is rejected before any HTTP call
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["update_draft"].handler({})

    assert result.get("is_error") is True


# ---------------------------------------------------------------------------
# create_snapshot (Phase 2 write tool)
# ---------------------------------------------------------------------------


@respx.mock
async def test_create_snapshot_posts_correct_url():
    route = respx.post(f"{BASE}/publish/drafts/5/snapshots").mock(
        return_value=httpx.Response(
            201,
            json={"data": {"id": 12, "label": "v1.0"}},
        )
    )
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["create_snapshot"].handler({"label": "v1.0", "comment": "Initial draft"})

    assert route.called
    import json
    body = json.loads(route.calls.last.request.content)
    assert body["label"] == "v1.0"
    assert body["comment"] == "Initial draft"
    assert "idempotency_key" in body
    # idempotency_key must be a non-empty string (UUID)
    assert isinstance(body["idempotency_key"], str)
    assert len(body["idempotency_key"]) > 0
    assert "v1.0" in result["content"][0]["text"]


@respx.mock
async def test_create_snapshot_without_draft_id_returns_error_no_http():
    # No route registered — confirms no HTTP call is made
    tools = {t.name: t for t in build_tool_pack(_ctx_no_draft())}
    result = await tools["create_snapshot"].handler({"label": "v1.0"})

    assert result.get("is_error") is True
    assert "draft" in result["content"][0]["text"].lower()


@respx.mock
async def test_create_snapshot_empty_label_returns_error_no_http():
    # No route registered — empty label is rejected before any HTTP call
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["create_snapshot"].handler({"label": ""})

    assert result.get("is_error") is True
    assert "label" in result["content"][0]["text"].lower()


@respx.mock
async def test_create_snapshot_missing_label_returns_error_no_http():
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["create_snapshot"].handler({})

    assert result.get("is_error") is True
