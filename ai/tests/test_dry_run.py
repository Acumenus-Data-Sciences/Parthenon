"""Tests for Dry Run Mode — simulating agency actions without side effects."""
from __future__ import annotations

from app.agency.dag_executor import DAGStep
from app.agency.dry_run import DryRunSimulator


def _make_step(tool_name: str, **params: object) -> DAGStep:
    return DAGStep(id="test", tool_name=tool_name, parameters=dict(params))


# ---------------------------------------------------------------------------
# Single-step simulation tests
# ---------------------------------------------------------------------------


def test_simulate_create_concept_set() -> None:
    """Simulating create_concept_set returns the expected simulation envelope."""
    sim = DryRunSimulator()
    step = _make_step("create_concept_set", name="My Set")
    result = sim.simulate(step)

    assert result["simulated"] is True
    assert result["would_create"] == "concept_set"


def test_simulate_generate_cohort() -> None:
    """Simulating generate_cohort returns the expected simulation envelope."""
    sim = DryRunSimulator()
    step = _make_step("generate_cohort", cohort_id=42)
    result = sim.simulate(step)

    assert result["simulated"] is True
    assert result["would_execute"] == "cohort_generation"


def test_simulate_execute_sql() -> None:
    """Simulating execute_sql returns a read-only, simulated result."""
    sim = DryRunSimulator()
    step = _make_step("execute_sql", query="SELECT 1")
    result = sim.simulate(step)

    assert result["simulated"] is True
    assert result["read_only"] is True


def test_simulate_unknown_tool() -> None:
    """Simulating an unknown tool returns a simulated result with an 'unknown' note."""
    sim = DryRunSimulator()
    step = _make_step("totally_unknown_tool")
    result = sim.simulate(step)

    assert result["simulated"] is True
    assert "unknown" in result["note"].lower()


# ---------------------------------------------------------------------------
# Multi-step plan simulation test
# ---------------------------------------------------------------------------


def test_simulate_plan() -> None:
    """simulate_plan with 3 steps returns a list of 3 results all with simulated=True."""
    sim = DryRunSimulator()
    steps = [
        _make_step("create_concept_set", name="Set A"),
        _make_step("generate_cohort", cohort_id=1),
        _make_step("execute_sql", query="SELECT count(*) FROM person"),
    ]
    results = sim.simulate_plan(steps)

    assert len(results) == 3
    for result in results:
        assert result["simulated"] is True
