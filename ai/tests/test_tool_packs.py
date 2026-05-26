"""Tests for the profile → tool-pack builder registry."""

from __future__ import annotations

import pytest

from app.agents.tool_base import AgentToolContext
from app.agents.tool_packs import build_tool_pack, register, write_tools


def _ctx() -> AgentToolContext:
    return AgentToolContext(
        auth_token="tok",
        context={"study_slug": "t2dm", "design_session_id": 7, "version_id": 3},
    )


def _publish_ctx() -> AgentToolContext:
    return AgentToolContext(
        auth_token="tok",
        context={"draft_id": 5, "study_id": 9},
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


# ---------------------------------------------------------------------------
# write_tools()
# ---------------------------------------------------------------------------


def test_write_tools_publish_returns_correct_set():
    assert write_tools("publish") == {"update_draft", "create_snapshot"}


def test_write_tools_study_design_returns_empty_set():
    assert write_tools("study_design") == set()


def test_write_tools_unknown_profile_returns_empty_set():
    assert write_tools("completely_unknown_profile") == set()


# ---------------------------------------------------------------------------
# build_tool_pack for publish returns 6 tools (4 reads + 2 writes)
# ---------------------------------------------------------------------------


def test_publish_returns_six_tools():
    tools = build_tool_pack("publish", _publish_ctx())
    assert len(tools) == 6
    names = {t.name for t in tools}
    assert names == {
        "list_studies_for_publish",
        "get_study_analyses",
        "get_draft",
        "draft_narrative_section",
        "update_draft",
        "create_snapshot",
    }


def test_publish_read_tools_not_in_write_set():
    """The four read tools must NOT appear in write_tools("publish")."""
    reads = {"list_studies_for_publish", "get_study_analyses", "get_draft", "draft_narrative_section"}
    assert reads.isdisjoint(write_tools("publish"))


def test_publish_write_tools_in_pack():
    """The two write tools must be present in the full publish tool pack."""
    tools = build_tool_pack("publish", _publish_ctx())
    names = {t.name for t in tools}
    assert write_tools("publish").issubset(names)
