"""Tests for the Tool Registry (Task 5)."""
from __future__ import annotations

import pytest

from app.agency.tool_registry import RiskLevel, ToolDefinition, ToolRegistry


def test_register_and_get_tool() -> None:
    """Registering a tool and retrieving it by name should return the same object."""
    registry = ToolRegistry()
    tool = ToolDefinition(
        name="my_tool",
        description="Does something",
        risk_level=RiskLevel.LOW,
    )
    registry.register(tool)
    result = registry.get("my_tool")
    assert result is tool


def test_get_unknown_returns_none() -> None:
    """Getting a tool that was never registered should return None."""
    registry = ToolRegistry()
    assert registry.get("nonexistent_tool") is None


def test_list_tools_returns_all() -> None:
    """list_tools() should return every registered tool."""
    registry = ToolRegistry()
    tools = [
        ToolDefinition(name="tool_a", description="A", risk_level=RiskLevel.LOW),
        ToolDefinition(name="tool_b", description="B", risk_level=RiskLevel.MEDIUM),
        ToolDefinition(name="tool_c", description="C", risk_level=RiskLevel.HIGH),
    ]
    for t in tools:
        registry.register(t)
    listed = registry.list_tools()
    assert len(listed) == 3
    names = {t.name for t in listed}
    assert names == {"tool_a", "tool_b", "tool_c"}


def test_list_by_risk_filters_correctly() -> None:
    """list_by_risk() should only return tools with the specified risk level."""
    registry = ToolRegistry()
    registry.register(ToolDefinition(name="low_1", description="L1", risk_level=RiskLevel.LOW))
    registry.register(ToolDefinition(name="low_2", description="L2", risk_level=RiskLevel.LOW))
    registry.register(ToolDefinition(name="med_1", description="M1", risk_level=RiskLevel.MEDIUM))
    registry.register(ToolDefinition(name="high_1", description="H1", risk_level=RiskLevel.HIGH))

    low_tools = registry.list_by_risk(RiskLevel.LOW)
    assert len(low_tools) == 2
    assert all(t.risk_level == RiskLevel.LOW for t in low_tools)

    med_tools = registry.list_by_risk(RiskLevel.MEDIUM)
    assert len(med_tools) == 1
    assert med_tools[0].name == "med_1"

    high_tools = registry.list_by_risk(RiskLevel.HIGH)
    assert len(high_tools) == 1
    assert high_tools[0].name == "high_1"


def test_default_has_all_phase4_tools() -> None:
    """ToolRegistry.default() must contain all Phase 4 tools (subset check).

    Uses a subset assertion so that additional Phase 5+ tools registered via
    default() do not cause this test to fail.
    """
    registry = ToolRegistry.default()
    expected_names = {
        "create_concept_set",
        "create_cohort_definition",
        "generate_cohort",
        "clone_cohort",
        "compare_cohorts",
        "export_results",
    }
    listed_names = {t.name for t in registry.list_tools()}
    assert expected_names.issubset(listed_names)


def test_default_has_all_phase5_tools() -> None:
    """ToolRegistry.default() must contain all 6 Phase 5 tools."""
    registry = ToolRegistry.default()
    expected_names = {
        "modify_concept_set",
        "modify_cohort_criteria",
        "execute_sql",
        "run_characterization",
        "run_incidence_analysis",
        "schedule_recurring_analysis",
    }
    listed_names = {t.name for t in registry.list_tools()}
    assert expected_names.issubset(listed_names)


def test_format_for_prompt_includes_names_and_risk() -> None:
    """format_for_prompt() should include each tool's name and risk level."""
    registry = ToolRegistry.default()
    prompt_text = registry.format_for_prompt()

    for tool in registry.list_tools():
        assert tool.name in prompt_text
        assert tool.risk_level.value.lower() in prompt_text.lower()
