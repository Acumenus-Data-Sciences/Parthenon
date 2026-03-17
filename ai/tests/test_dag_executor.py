"""Tests for the DAG Executor — parallel step execution with dependency tracking."""
from __future__ import annotations

import asyncio
from typing import Any

import pytest

from app.agency.dag_executor import DAGExecutor, DAGPlan, DAGStep


# ---------------------------------------------------------------------------
# Synchronous / structural tests
# ---------------------------------------------------------------------------


def test_linear_plan() -> None:
    """3 sequential steps produce 3 waves each containing exactly 1 step."""
    steps = [
        DAGStep(id="a", tool_name="t1", parameters={}),
        DAGStep(id="b", tool_name="t2", parameters={}, depends_on=["a"]),
        DAGStep(id="c", tool_name="t3", parameters={}, depends_on=["b"]),
    ]
    plan = DAGPlan(steps=steps)
    waves = plan.get_execution_waves()

    assert len(waves) == 3
    assert [step.id for step in waves[0]] == ["a"]
    assert [step.id for step in waves[1]] == ["b"]
    assert [step.id for step in waves[2]] == ["c"]


def test_parallel_steps() -> None:
    """2 independent steps + 1 dependent produce 2 waves (first wave has 2 steps)."""
    steps = [
        DAGStep(id="a", tool_name="t1", parameters={}),
        DAGStep(id="b", tool_name="t2", parameters={}),
        DAGStep(id="c", tool_name="t3", parameters={}, depends_on=["a", "b"]),
    ]
    plan = DAGPlan(steps=steps)
    waves = plan.get_execution_waves()

    assert len(waves) == 2
    first_ids = {step.id for step in waves[0]}
    assert first_ids == {"a", "b"}
    assert [step.id for step in waves[1]] == ["c"]


def test_diamond_dependency() -> None:
    """Diamond (a→b, a→c, b→d, c→d) produces 3 waves."""
    steps = [
        DAGStep(id="a", tool_name="t1", parameters={}),
        DAGStep(id="b", tool_name="t2", parameters={}, depends_on=["a"]),
        DAGStep(id="c", tool_name="t3", parameters={}, depends_on=["a"]),
        DAGStep(id="d", tool_name="t4", parameters={}, depends_on=["b", "c"]),
    ]
    plan = DAGPlan(steps=steps)
    waves = plan.get_execution_waves()

    assert len(waves) == 3
    assert [step.id for step in waves[0]] == ["a"]
    middle_ids = {step.id for step in waves[1]}
    assert middle_ids == {"b", "c"}
    assert [step.id for step in waves[2]] == ["d"]


def test_detect_cycle() -> None:
    """Mutual dependency (a depends on b, b depends on a) must raise ValueError with 'cycle'."""
    steps = [
        DAGStep(id="a", tool_name="t1", parameters={}, depends_on=["b"]),
        DAGStep(id="b", tool_name="t2", parameters={}, depends_on=["a"]),
    ]
    plan = DAGPlan(steps=steps)

    with pytest.raises(ValueError, match="cycle"):
        plan.get_execution_waves()


def test_plan_to_dict() -> None:
    """DAGPlan and DAGStep serialize to plain dicts correctly."""
    step = DAGStep(id="x", tool_name="my_tool", parameters={"k": "v"}, depends_on=["y"])
    plan = DAGPlan(steps=[step])

    step_dict = step.to_dict()
    assert step_dict["id"] == "x"
    assert step_dict["tool_name"] == "my_tool"
    assert step_dict["parameters"] == {"k": "v"}
    assert step_dict["depends_on"] == ["y"]
    assert step_dict["status"] == "pending"
    assert step_dict["result"] is None

    plan_dict = plan.to_dict()
    assert "steps" in plan_dict
    assert len(plan_dict["steps"]) == 1


# ---------------------------------------------------------------------------
# Async execution tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_execute_parallel() -> None:
    """Two independent steps both complete successfully when executed concurrently."""

    async def mock_executor(step: DAGStep) -> dict[str, Any]:
        return {"success": True, "step_id": step.id}

    steps = [
        DAGStep(id="a", tool_name="t1", parameters={}),
        DAGStep(id="b", tool_name="t2", parameters={}),
    ]
    plan = DAGPlan(steps=steps)
    executor = DAGExecutor()
    result_plan = await executor.execute(plan, mock_executor)

    step_map = {s.id: s for s in result_plan.steps}
    assert step_map["a"].status == "success"
    assert step_map["b"].status == "success"


@pytest.mark.asyncio
async def test_failure_skips_dependents() -> None:
    """A failing step causes its direct dependent to be marked as skipped."""

    async def mock_executor(step: DAGStep) -> dict[str, Any]:
        if step.id == "a":
            raise RuntimeError("simulated failure")
        return {"success": True}

    steps = [
        DAGStep(id="a", tool_name="t1", parameters={}),
        DAGStep(id="b", tool_name="t2", parameters={}, depends_on=["a"]),
    ]
    plan = DAGPlan(steps=steps)
    executor = DAGExecutor()
    result_plan = await executor.execute(plan, mock_executor)

    step_map = {s.id: s for s in result_plan.steps}
    assert step_map["a"].status == "failed"
    assert step_map["b"].status == "skipped"
