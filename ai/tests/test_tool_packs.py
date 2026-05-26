"""Tests for the profile → tool-pack builder registry."""

from __future__ import annotations

import pytest

from app.agents.tool_base import AgentToolContext
from app.agents.tool_packs import build_tool_pack, register


def _ctx() -> AgentToolContext:
    return AgentToolContext(
        auth_token="tok",
        context={"study_slug": "t2dm", "design_session_id": 7, "version_id": 3},
    )


def test_study_design_returns_four_tools():
    tools = build_tool_pack("study_design", _ctx())
    assert len(tools) == 4
    names = {t.name for t in tools}
    assert names == {"search_concepts", "get_guidance", "recommend_phenotypes", "draft_concept_sets"}


def test_unknown_profile_raises_key_error():
    with pytest.raises(KeyError):
        build_tool_pack("unknown_profile_xyz", _ctx())


def test_register_adds_custom_profile():
    def _fake_builder(ctx: AgentToolContext) -> list:
        return ["tool_a", "tool_b"]

    register("fake_profile", _fake_builder)
    result = build_tool_pack("fake_profile", _ctx())
    assert result == ["tool_a", "tool_b"]
