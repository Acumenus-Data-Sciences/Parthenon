"""Tests for the Plan Engine (Task 6)."""
from __future__ import annotations

import pytest

from app.agency.plan_engine import ActionPlan, PlanEngine, PlanStatus
from app.agency.tool_registry import ToolRegistry


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_engine() -> PlanEngine:
    """Return a PlanEngine with no DB/logger/api_client dependencies."""
    return PlanEngine(
        tool_registry=ToolRegistry.default(),
        action_logger=None,
        api_client=None,
        db_engine=None,
    )


def _basic_steps() -> list[dict]:
    return [{"tool_name": "compare_cohorts", "parameters": {"cohort_a_id": 1, "cohort_b_id": 2}}]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------

def test_create_plan_returns_pending_status() -> None:
    """Newly created plans should have PENDING status."""
    engine = _make_engine()
    plan = engine.create_plan(
        user_id=1,
        description="Compare two cohorts",
        steps=_basic_steps(),
        auth_token="tok_abc",
    )
    assert plan.status == PlanStatus.PENDING


def test_plan_has_expiry() -> None:
    """Plans must carry a non-None expires_at timestamp."""
    engine = _make_engine()
    plan = engine.create_plan(
        user_id=1,
        description="Test plan",
        steps=_basic_steps(),
        auth_token="tok_abc",
    )
    assert plan.expires_at is not None


def test_plan_validates_tool_names() -> None:
    """create_plan should raise ValueError when a step names an unknown tool."""
    engine = _make_engine()
    bad_steps = [{"tool_name": "does_not_exist", "parameters": {}}]
    with pytest.raises(ValueError, match="does_not_exist"):
        engine.create_plan(
            user_id=1,
            description="Bad plan",
            steps=bad_steps,
            auth_token="tok_abc",
        )


def test_plan_serialization() -> None:
    """to_dict() should return a plain dict with expected keys."""
    engine = _make_engine()
    plan = engine.create_plan(
        user_id=1,
        description="Serialization test",
        steps=_basic_steps(),
        auth_token="tok_abc",
    )
    d = plan.to_dict()
    assert isinstance(d, dict)
    for key in ("plan_id", "user_id", "description", "steps", "status", "created_at", "expires_at"):
        assert key in d, f"Missing key: {key}"
    assert d["status"] == PlanStatus.PENDING.value


def test_approve_plan_changes_status() -> None:
    """approve_plan() should set status to APPROVED."""
    engine = _make_engine()
    plan = engine.create_plan(
        user_id=1,
        description="Approve test",
        steps=_basic_steps(),
        auth_token="tok_abc",
    )
    engine.approve_plan(plan)
    assert plan.status == PlanStatus.APPROVED


def test_cancel_plan_changes_status() -> None:
    """cancel_plan() should set status to CANCELLED."""
    engine = _make_engine()
    plan = engine.create_plan(
        user_id=1,
        description="Cancel test",
        steps=_basic_steps(),
        auth_token="tok_abc",
    )
    engine.cancel_plan(plan)
    assert plan.status == PlanStatus.CANCELLED


def test_multi_step_plan_creates_correct_steps() -> None:
    """A plan with multiple steps should have matching PlanStep objects."""
    engine = _make_engine()
    steps = [
        {"tool_name": "compare_cohorts", "parameters": {"cohort_a_id": 1, "cohort_b_id": 2}},
        {"tool_name": "export_results", "parameters": {"entity_type": "cohort", "entity_id": 1}},
        {"tool_name": "clone_cohort", "parameters": {"cohort_definition_id": 5}},
    ]
    plan = engine.create_plan(
        user_id=2,
        description="Multi-step plan",
        steps=steps,
        auth_token="tok_xyz",
    )
    assert len(plan.steps) == 3
    assert plan.steps[0].tool_name == "compare_cohorts"
    assert plan.steps[1].tool_name == "export_results"
    assert plan.steps[2].tool_name == "clone_cohort"
