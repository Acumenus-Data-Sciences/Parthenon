"""Tests for the Abby orchestrator tool pack (ADR-0020 Phase 5).

respx mocks the Laravel API at http://nginx:80/api/v1. The execute tools
(evaluate_gates, build_study_package) are declared as approval-gated writes so
the harness routes them through human approval; the get_* tools are reads.
"""

from __future__ import annotations

import httpx
import respx

from app.agents.abby_tools import build_tool_pack
from app.agents.profiles import get_profile
from app.agents.tool_base import AgentToolContext
from app.agents.tool_packs import build_tool_pack as registry_build
from app.agents.tool_packs import write_tools

BASE = "http://nginx:80/api/v1"


def _ctx() -> AgentToolContext:
    return AgentToolContext(auth_token="tok", context={"study_slug": "htn-v3"})


def _ctx_no_study() -> AgentToolContext:
    return AgentToolContext(auth_token="tok", context={})


def test_abby_profile_and_registry_are_wired() -> None:
    assert get_profile("abby").name == "abby"

    names = {t.name for t in registry_build("abby", _ctx())}
    assert names == {
        "get_study_overview",
        "get_study_progress",
        "get_gate_status",
        "get_study_results",
        "get_manuscript",
        "evaluate_gates",
        "reproject_results",
        "build_study_package",
        "open_in_publisher",
    }

    # The execute tools are approval-gated writes (the human-in-the-loop gates);
    # the agent proposes but a human approves. Reads (get_*) stay auto-approved.
    assert write_tools("abby") == {
        "evaluate_gates",
        "reproject_results",
        "build_study_package",
        "open_in_publisher",
    }


@respx.mock
async def test_get_gate_status_calls_gates_endpoint() -> None:
    route = respx.get(f"{BASE}/studies/htn-v3/gates").mock(
        return_value=httpx.Response(
            200,
            json={
                "data": [{"stage": "study_diagnostics", "status": "failed"}],
                "gating_enabled": True,
            },
        )
    )
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["get_gate_status"].handler({})

    assert route.called
    assert route.calls.last.request.headers["authorization"] == "Bearer tok"
    assert "study_diagnostics" in result["content"][0]["text"]


@respx.mock
async def test_evaluate_gates_posts_to_evaluate_endpoint() -> None:
    route = respx.post(f"{BASE}/studies/htn-v3/gates/evaluate").mock(
        return_value=httpx.Response(
            200,
            json={"data": [{"stage": "estimation_calibration", "status": "failed"}], "message": "ok"},
        )
    )
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["evaluate_gates"].handler({})

    assert route.called
    assert result.get("is_error") is not True


@respx.mock
async def test_build_study_package_posts_to_package_endpoint() -> None:
    route = respx.post(f"{BASE}/studies/htn-v3/package").mock(
        return_value=httpx.Response(201, json={"data": {"id": 1, "version": 1, "bundle_sha256": "abc"}})
    )
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["build_study_package"].handler({})

    assert route.called
    assert result.get("is_error") is not True


@respx.mock
async def test_get_study_results_reads_results_endpoint() -> None:
    route = respx.get(f"{BASE}/studies/htn-v3/results").mock(
        return_value=httpx.Response(
            200,
            json={"data": [{"result_type": "effect_estimate", "is_publishable": False}]},
        )
    )
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["get_study_results"].handler({"publishable_only": True})

    assert route.called
    assert route.calls.last.request.url.params["publishable_only"] == "true"
    assert "effect_estimate" in result["content"][0]["text"]


@respx.mock
async def test_get_manuscript_reads_manuscript_endpoint() -> None:
    route = respx.get(f"{BASE}/studies/htn-v3/manuscript").mock(
        return_value=httpx.Response(200, json={"data": {"title": "HTN v4", "sections": []}})
    )
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["get_manuscript"].handler({})

    assert route.called
    assert result.get("is_error") is not True
    assert "HTN v4" in result["content"][0]["text"]


@respx.mock
async def test_reproject_results_posts_to_reproject_endpoint() -> None:
    route = respx.post(f"{BASE}/studies/htn-v3/results/reproject").mock(
        return_value=httpx.Response(200, json={"data": {"reprojected": 4}, "message": "ok"})
    )
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["reproject_results"].handler({})

    assert route.called
    assert result.get("is_error") is not True


@respx.mock
async def test_open_in_publisher_posts_to_manuscript_draft_endpoint() -> None:
    route = respx.post(f"{BASE}/studies/htn-v3/manuscript/draft").mock(
        return_value=httpx.Response(201, json={"data": {"id": 77, "study_id": 165, "title": "HTN v4"}})
    )
    tools = {t.name: t for t in build_tool_pack(_ctx())}
    result = await tools["open_in_publisher"].handler({})

    assert route.called
    assert result.get("is_error") is not True
    assert "77" in result["content"][0]["text"]


@respx.mock
async def test_tools_guard_when_no_study_slug_make_no_http_call() -> None:
    # No routes registered — if any HTTP call were attempted, respx would raise.
    tools = {t.name: t for t in build_tool_pack(_ctx_no_study())}
    for name in ("get_study_overview", "get_gate_status", "evaluate_gates", "build_study_package"):
        result = await tools[name].handler({})
        assert result.get("is_error") is True
        assert "study" in result["content"][0]["text"].lower()
