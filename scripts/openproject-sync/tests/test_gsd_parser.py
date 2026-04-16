"""Tests for gsd_parser against real .planning files in this repository."""
from __future__ import annotations

import sys
import os

# Allow importing lib directly without installing the package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from lib.gsd_parser import (
    PlanDetail,
    ProjectState,
    QuickTask,
    RoadmapPhase,
    parse_plan,
    parse_roadmap,
    parse_state,
)

REPO_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..")
)
PLANNING_DIR = os.path.join(REPO_ROOT, ".planning")
ROADMAP_PATH = os.path.join(PLANNING_DIR, "ROADMAP.md")
STATE_PATH = os.path.join(PLANNING_DIR, "STATE.md")
PLAN_PATH = os.path.join(
    PLANNING_DIR,
    "phases",
    "01-project-setup-and-source-data-profiling",
    "01-01-PLAN.md",
)


def _read(path: str) -> str:
    with open(path, encoding="utf-8") as fh:
        return fh.read()


# ---------------------------------------------------------------------------
# parse_roadmap tests
# ---------------------------------------------------------------------------


class TestParseRoadmap:
    def test_returns_list_of_roadmap_phases(self) -> None:
        phases = parse_roadmap(_read(ROADMAP_PATH))
        assert isinstance(phases, list)
        assert all(isinstance(p, RoadmapPhase) for p in phases)

    def test_returns_12_phases(self) -> None:
        phases = parse_roadmap(_read(ROADMAP_PATH))
        assert len(phases) == 12, f"Expected 12 phases, got {len(phases)}"

    def test_all_phases_complete(self) -> None:
        phases = parse_roadmap(_read(ROADMAP_PATH))
        for p in phases:
            assert p.status == "complete", (
                f"Phase {p.number} expected complete, got {p.status}"
            )

    def test_phase_numbers_are_sequential(self) -> None:
        phases = parse_roadmap(_read(ROADMAP_PATH))
        nums = [p.number for p in phases]
        assert nums == list(range(1, 13))

    def test_phase_1_name_contains_project_setup(self) -> None:
        phases = parse_roadmap(_read(ROADMAP_PATH))
        phase1 = next(p for p in phases if p.number == 1)
        assert "Project Setup" in phase1.name, (
            f"Phase 1 name '{phase1.name}' should contain 'Project Setup'"
        )

    def test_phase_1_has_requirements(self) -> None:
        phases = parse_roadmap(_read(ROADMAP_PATH))
        phase1 = next(p for p in phases if p.number == 1)
        assert len(phase1.requirements) > 0, "Phase 1 should have requirements"
        req_ids = phase1.requirements
        # Per ROADMAP.md: Requirements: FOUND-05, FOUND-06
        assert any(r in ("FOUND-05", "FOUND-06") for r in req_ids), (
            f"Phase 1 requirements {req_ids} should include FOUND-05 or FOUND-06"
        )

    def test_phase_1_has_goal(self) -> None:
        phases = parse_roadmap(_read(ROADMAP_PATH))
        phase1 = next(p for p in phases if p.number == 1)
        assert phase1.goal, "Phase 1 should have a goal"

    def test_phase_1_has_success_criteria(self) -> None:
        phases = parse_roadmap(_read(ROADMAP_PATH))
        phase1 = next(p for p in phases if p.number == 1)
        assert len(phase1.success_criteria) >= 1, (
            "Phase 1 should have success criteria"
        )

    def test_phase_1_has_plans(self) -> None:
        phases = parse_roadmap(_read(ROADMAP_PATH))
        phase1 = next(p for p in phases if p.number == 1)
        assert len(phase1.plans) >= 2, (
            f"Phase 1 should have at least 2 plans, got {len(phase1.plans)}"
        )

    def test_phase_4_depends_on_2_and_3(self) -> None:
        phases = parse_roadmap(_read(ROADMAP_PATH))
        phase4 = next(p for p in phases if p.number == 4)
        assert 2 in phase4.depends_on, (
            f"Phase 4 depends_on {phase4.depends_on} should include 2"
        )
        assert 3 in phase4.depends_on, (
            f"Phase 4 depends_on {phase4.depends_on} should include 3"
        )

    def test_phase_2_depends_on_1(self) -> None:
        phases = parse_roadmap(_read(ROADMAP_PATH))
        phase2 = next(p for p in phases if p.number == 2)
        assert 1 in phase2.depends_on, (
            f"Phase 2 depends_on {phase2.depends_on} should include 1"
        )

    def test_phase_1_has_completed_date(self) -> None:
        phases = parse_roadmap(_read(ROADMAP_PATH))
        phase1 = next(p for p in phases if p.number == 1)
        assert phase1.completed_date is not None, (
            "Phase 1 should have a completed_date"
        )
        assert phase1.completed_date.startswith("2026"), (
            f"Phase 1 completed_date '{phase1.completed_date}' should start with 2026"
        )

    def test_phases_are_sorted_by_number(self) -> None:
        phases = parse_roadmap(_read(ROADMAP_PATH))
        nums = [p.number for p in phases]
        assert nums == sorted(nums)


# ---------------------------------------------------------------------------
# parse_state tests
# ---------------------------------------------------------------------------


class TestParseState:
    def test_returns_project_state(self) -> None:
        state = parse_state(_read(STATE_PATH))
        assert isinstance(state, ProjectState)

    def test_total_phases_is_12(self) -> None:
        state = parse_state(_read(STATE_PATH))
        assert state.total_phases == 12, (
            f"Expected total_phases=12, got {state.total_phases}"
        )

    def test_completed_phases_is_10_or_12(self) -> None:
        # STATE.md has completed_phases: 10 in frontmatter (per actual file)
        state = parse_state(_read(STATE_PATH))
        assert state.completed_phases in (10, 12), (
            f"Expected completed_phases in (10, 12), got {state.completed_phases}"
        )

    def test_milestone_is_not_empty(self) -> None:
        state = parse_state(_read(STATE_PATH))
        assert state.milestone, "milestone should not be empty"

    def test_status_is_not_empty(self) -> None:
        state = parse_state(_read(STATE_PATH))
        assert state.status, "status should not be empty"

    def test_quick_tasks_not_empty(self) -> None:
        state = parse_state(_read(STATE_PATH))
        assert len(state.quick_tasks) >= 1, (
            "quick_tasks should have at least 1 entry"
        )

    def test_quick_tasks_are_quick_task_instances(self) -> None:
        state = parse_state(_read(STATE_PATH))
        for qt in state.quick_tasks:
            assert isinstance(qt, QuickTask)

    def test_quick_tasks_have_description(self) -> None:
        state = parse_state(_read(STATE_PATH))
        for qt in state.quick_tasks:
            assert qt.description, f"Quick task {qt.name!r} has empty description"

    def test_total_plans_is_positive(self) -> None:
        state = parse_state(_read(STATE_PATH))
        assert state.total_plans > 0, "total_plans should be positive"

    def test_percent_is_in_range(self) -> None:
        state = parse_state(_read(STATE_PATH))
        assert 0 <= state.percent <= 100, (
            f"percent {state.percent} should be in [0, 100]"
        )


# ---------------------------------------------------------------------------
# parse_plan tests
# ---------------------------------------------------------------------------


class TestParsePlan:
    def test_returns_plan_detail(self) -> None:
        detail = parse_plan(_read(PLAN_PATH))
        assert isinstance(detail, PlanDetail)

    def test_phase_number_is_1(self) -> None:
        detail = parse_plan(_read(PLAN_PATH))
        assert detail.phase_number == 1, (
            f"Expected phase_number=1, got {detail.phase_number}"
        )

    def test_plan_number_is_1(self) -> None:
        detail = parse_plan(_read(PLAN_PATH))
        assert detail.plan_number == 1, (
            f"Expected plan_number=1, got {detail.plan_number}"
        )

    def test_requirements_not_empty(self) -> None:
        detail = parse_plan(_read(PLAN_PATH))
        assert len(detail.requirements) > 0, "requirements should not be empty"

    def test_requirements_contains_found_06(self) -> None:
        detail = parse_plan(_read(PLAN_PATH))
        assert "FOUND-06" in detail.requirements, (
            f"requirements {detail.requirements} should contain FOUND-06"
        )

    def test_objective_not_empty(self) -> None:
        detail = parse_plan(_read(PLAN_PATH))
        assert detail.objective, "objective should not be empty"

    def test_files_modified_not_empty(self) -> None:
        detail = parse_plan(_read(PLAN_PATH))
        assert len(detail.files_modified) > 0, "files_modified should not be empty"

    def test_must_have_truths_not_empty(self) -> None:
        detail = parse_plan(_read(PLAN_PATH))
        assert len(detail.must_have_truths) > 0, "must_have_truths should not be empty"


# ---------------------------------------------------------------------------
# Unit tests with inline content
# ---------------------------------------------------------------------------


MINI_ROADMAP = """\
# Roadmap

## Phases

- [x] **Phase 1: Alpha** - First phase (completed 2026-01-01)
- [ ] **Phase 2: Beta** - Second phase

## Phase Details

### Phase 1: Alpha
**Goal**: Do alpha things
**Depends on**: Nothing (first phase)
**Requirements**: REQ-01, REQ-02
**Success Criteria** (what must be TRUE):
  1. Alpha criterion one
  2. Alpha criterion two
**Plans**: 1 plans

Plans:
- [x] 01-01: plan alpha one

### Phase 2: Beta
**Goal**: Do beta things
**Depends on**: Phase 1
**Requirements**: REQ-03
**Success Criteria** (what must be TRUE):
  1. Beta criterion one
**Plans**: TBD

Plans:
- [ ] 02-01: plan beta one
"""


class TestMiniRoadmap:
    def test_two_phases_parsed(self) -> None:
        phases = parse_roadmap(MINI_ROADMAP)
        assert len(phases) == 2

    def test_phase1_complete(self) -> None:
        phases = parse_roadmap(MINI_ROADMAP)
        assert phases[0].status == "complete"
        assert phases[0].completed_date == "2026-01-01"

    def test_phase2_pending(self) -> None:
        phases = parse_roadmap(MINI_ROADMAP)
        assert phases[1].status == "pending"

    def test_phase1_no_depends(self) -> None:
        phases = parse_roadmap(MINI_ROADMAP)
        assert phases[0].depends_on == []

    def test_phase2_depends_on_1(self) -> None:
        phases = parse_roadmap(MINI_ROADMAP)
        assert phases[1].depends_on == [1]

    def test_phase1_requirements(self) -> None:
        phases = parse_roadmap(MINI_ROADMAP)
        assert "REQ-01" in phases[0].requirements
        assert "REQ-02" in phases[0].requirements

    def test_phase1_success_criteria(self) -> None:
        phases = parse_roadmap(MINI_ROADMAP)
        assert len(phases[0].success_criteria) == 2

    def test_phase1_plans(self) -> None:
        phases = parse_roadmap(MINI_ROADMAP)
        assert len(phases[0].plans) == 1


MINI_STATE = """\
---
gsd_state_version: 1.0
milestone: v1.0
status: executing
progress:
  total_phases: 5
  completed_phases: 3
  total_plans: 10
  completed_plans: 7
  percent: 70
---

# Project State

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 1 | Fix thing A | 2026-01-01 | abc1234 | [fix-a](./quick/fix-a/) |
| 2 | Fix thing B | 2026-01-02 | def5678 | [fix-b](./quick/fix-b/) |
"""


class TestMiniState:
    def test_milestone(self) -> None:
        state = parse_state(MINI_STATE)
        assert state.milestone == "v1.0"

    def test_status(self) -> None:
        state = parse_state(MINI_STATE)
        assert state.status == "executing"

    def test_progress(self) -> None:
        state = parse_state(MINI_STATE)
        assert state.total_phases == 5
        assert state.completed_phases == 3
        assert state.total_plans == 10
        assert state.completed_plans == 7
        assert state.percent == 70

    def test_quick_tasks(self) -> None:
        state = parse_state(MINI_STATE)
        assert len(state.quick_tasks) == 2
        assert state.quick_tasks[0].description == "Fix thing A"
        assert state.quick_tasks[0].commit_hash == "abc1234"
        assert state.quick_tasks[1].description == "Fix thing B"


MINI_PLAN = """\
---
phase: 02-shared-library
plan: 3
type: execute
files_modified:
  - scripts/etl/lib/utils.py
  - scripts/etl/tests/test_utils.py
requirements:
  - FOUND-01
  - FOUND-02
must_haves:
  truths:
    - "Module is importable"
    - "All tests pass"
---

<objective>
Build the shared utilities library for the ETL pipeline.

Purpose: Reusable helpers for all downstream ETL scripts.
</objective>
"""


class TestMiniPlan:
    def test_phase_number(self) -> None:
        detail = parse_plan(MINI_PLAN)
        assert detail.phase_number == 2

    def test_plan_number(self) -> None:
        detail = parse_plan(MINI_PLAN)
        assert detail.plan_number == 3

    def test_files_modified(self) -> None:
        detail = parse_plan(MINI_PLAN)
        assert "scripts/etl/lib/utils.py" in detail.files_modified

    def test_requirements(self) -> None:
        detail = parse_plan(MINI_PLAN)
        assert "FOUND-01" in detail.requirements
        assert "FOUND-02" in detail.requirements

    def test_must_have_truths(self) -> None:
        detail = parse_plan(MINI_PLAN)
        assert "Module is importable" in detail.must_have_truths

    def test_objective(self) -> None:
        detail = parse_plan(MINI_PLAN)
        assert "shared utilities library" in detail.objective
