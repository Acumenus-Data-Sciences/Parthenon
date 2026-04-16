"""Tests for lib/mapper.py — bidirectional GSD/OP/GitHub entity mapper."""
from __future__ import annotations

import pytest

from lib.gsd_parser import PlanDetail, QuickTask, RoadmapPhase
from lib.mapper import (
    OP_STATUS_CLOSED,
    OP_STATUS_IN_PROGRESS,
    OP_STATUS_NEW,
    gh_state_to_gsd_status,
    gsd_status_to_gh_state,
    gsd_status_to_op_status_id,
    op_status_name_to_gsd_status,
    op_status_to_gsd_status,
    phase_labels,
    phase_to_gh_issue_body,
    phase_to_wp_description,
    plan_labels,
    plan_to_wp_description,
    quick_task_to_wp_description,
)


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def sample_phase() -> RoadmapPhase:
    return RoadmapPhase(
        number=3,
        name="Data Enrichment",
        goal="Enrich the CDM with derived analytics",
        status="executing",
        completed_date=None,
        depends_on=[1, 2],
        requirements=["FOUND-05", "FOUND-06"],
        success_criteria=[
            "All concept IDs resolved",
            "Drug era table populated",
            "Achilles results present",
        ],
        plans=["03-01: Concept resolution", "03-02: Drug era build"],
        plan_count=2,
    )


@pytest.fixture()
def complete_phase() -> RoadmapPhase:
    return RoadmapPhase(
        number=1,
        name="Project Setup",
        goal="Bootstrap infrastructure",
        status="complete",
        completed_date="2026-03-01",
        depends_on=[],
        requirements=["FOUND-01"],
        success_criteria=["Docker stack healthy"],
        plans=["01-01: Compose setup"],
        plan_count=1,
    )


@pytest.fixture()
def sample_plan() -> PlanDetail:
    return PlanDetail(
        phase_number=3,
        plan_number=2,
        objective="Build drug era table from drug exposure",
        requirements=["FOUND-06"],
        must_have_truths=[
            "drug_era rows created for every patient",
            "era boundaries respect gap_days parameter",
        ],
        files_modified=["scripts/drug_era.sql", "backend/app/Services/DrugEraService.php"],
        duration_minutes=90,
        commit_hash="abc1234",
    )


@pytest.fixture()
def sample_quick_task() -> QuickTask:
    return QuickTask(
        name="Fix concept mapping",
        description="Patched NULL concept_ids in measurement table",
        date="2026-04-10",
        commit_hash="def5678",
        directory="./quick/fix-concept-mapping",
    )


# ---------------------------------------------------------------------------
# Status mapping — GSD → OpenProject
# ---------------------------------------------------------------------------


class TestGsdToOpStatus:
    def test_pending_maps_to_new(self) -> None:
        assert gsd_status_to_op_status_id("pending") == OP_STATUS_NEW

    def test_executing_maps_to_in_progress(self) -> None:
        assert gsd_status_to_op_status_id("executing") == OP_STATUS_IN_PROGRESS

    def test_complete_maps_to_closed(self) -> None:
        assert gsd_status_to_op_status_id("complete") == OP_STATUS_CLOSED

    def test_unknown_defaults_to_new(self) -> None:
        assert gsd_status_to_op_status_id("unknown_value") == OP_STATUS_NEW

    def test_empty_string_defaults_to_new(self) -> None:
        assert gsd_status_to_op_status_id("") == OP_STATUS_NEW


# ---------------------------------------------------------------------------
# Status mapping — GSD → GitHub
# ---------------------------------------------------------------------------


class TestGsdToGhState:
    def test_pending_maps_to_open(self) -> None:
        assert gsd_status_to_gh_state("pending") == "open"

    def test_executing_maps_to_open(self) -> None:
        assert gsd_status_to_gh_state("executing") == "open"

    def test_complete_maps_to_closed(self) -> None:
        assert gsd_status_to_gh_state("complete") == "closed"

    def test_unknown_maps_to_open(self) -> None:
        assert gsd_status_to_gh_state("anything") == "open"


# ---------------------------------------------------------------------------
# Status mapping — OpenProject → GSD
# ---------------------------------------------------------------------------


class TestOpToGsdStatus:
    def test_closed_maps_to_complete(self) -> None:
        assert op_status_to_gsd_status(OP_STATUS_CLOSED) == "complete"

    def test_in_progress_maps_to_executing(self) -> None:
        assert op_status_to_gsd_status(OP_STATUS_IN_PROGRESS) == "executing"

    def test_new_maps_to_pending(self) -> None:
        assert op_status_to_gsd_status(OP_STATUS_NEW) == "pending"

    def test_unknown_id_maps_to_pending(self) -> None:
        assert op_status_to_gsd_status(999) == "pending"


# ---------------------------------------------------------------------------
# Status mapping — OpenProject status name → GSD
# ---------------------------------------------------------------------------


class TestOpStatusNameToGsd:
    def test_closed_name_maps_to_complete(self) -> None:
        assert op_status_name_to_gsd_status("Closed") == "complete"

    def test_rejected_name_maps_to_complete(self) -> None:
        assert op_status_name_to_gsd_status("Rejected") == "complete"

    def test_in_progress_name_maps_to_executing(self) -> None:
        assert op_status_name_to_gsd_status("In progress") == "executing"

    def test_developed_name_maps_to_executing(self) -> None:
        assert op_status_name_to_gsd_status("Developed") == "executing"

    def test_new_name_maps_to_pending(self) -> None:
        assert op_status_name_to_gsd_status("New") == "pending"

    def test_unknown_name_maps_to_pending(self) -> None:
        assert op_status_name_to_gsd_status("Scheduled") == "pending"

    def test_name_is_case_insensitive(self) -> None:
        assert op_status_name_to_gsd_status("CLOSED") == "complete"
        assert op_status_name_to_gsd_status("IN PROGRESS") == "executing"


# ---------------------------------------------------------------------------
# Status mapping — GitHub → GSD
# ---------------------------------------------------------------------------


class TestGhToGsdStatus:
    def test_closed_maps_to_complete(self) -> None:
        assert gh_state_to_gsd_status("closed") == "complete"

    def test_open_maps_to_pending(self) -> None:
        assert gh_state_to_gsd_status("open") == "pending"

    def test_unknown_maps_to_pending(self) -> None:
        assert gh_state_to_gsd_status("draft") == "pending"


# ---------------------------------------------------------------------------
# Description builder — phase_to_wp_description
# ---------------------------------------------------------------------------


class TestPhaseToWpDescription:
    def test_goal_appears_in_output(self, sample_phase: RoadmapPhase) -> None:
        desc = phase_to_wp_description(sample_phase)
        assert "Enrich the CDM with derived analytics" in desc

    def test_requirements_appear_in_output(self, sample_phase: RoadmapPhase) -> None:
        desc = phase_to_wp_description(sample_phase)
        assert "FOUND-05" in desc
        assert "FOUND-06" in desc

    def test_success_criteria_appear_in_output(self, sample_phase: RoadmapPhase) -> None:
        desc = phase_to_wp_description(sample_phase)
        assert "All concept IDs resolved" in desc
        assert "Drug era table populated" in desc
        assert "Achilles results present" in desc

    def test_depends_on_appears_in_output(self, sample_phase: RoadmapPhase) -> None:
        desc = phase_to_wp_description(sample_phase)
        assert "Phase 1" in desc
        assert "Phase 2" in desc

    def test_plans_appear_in_output(self, sample_phase: RoadmapPhase) -> None:
        desc = phase_to_wp_description(sample_phase)
        assert "03-01: Concept resolution" in desc

    def test_sync_marker_present(self, sample_phase: RoadmapPhase) -> None:
        desc = phase_to_wp_description(sample_phase)
        assert "<!-- n8n-sync -->" in desc

    def test_completed_date_appears_when_present(self, complete_phase: RoadmapPhase) -> None:
        desc = phase_to_wp_description(complete_phase)
        assert "2026-03-01" in desc

    def test_no_completed_date_section_when_absent(self, sample_phase: RoadmapPhase) -> None:
        desc = phase_to_wp_description(sample_phase)
        assert "Completed" not in desc


# ---------------------------------------------------------------------------
# Description builder — plan_to_wp_description
# ---------------------------------------------------------------------------


class TestPlanToWpDescription:
    def test_objective_appears(self, sample_plan: PlanDetail) -> None:
        desc = plan_to_wp_description(sample_plan)
        assert "Build drug era table from drug exposure" in desc

    def test_acceptance_criteria_as_checkboxes(self, sample_plan: PlanDetail) -> None:
        desc = plan_to_wp_description(sample_plan)
        assert "- [ ] drug_era rows created for every patient" in desc
        assert "- [ ] era boundaries respect gap_days parameter" in desc

    def test_files_modified_appear(self, sample_plan: PlanDetail) -> None:
        desc = plan_to_wp_description(sample_plan)
        assert "scripts/drug_era.sql" in desc

    def test_sync_marker_present(self, sample_plan: PlanDetail) -> None:
        desc = plan_to_wp_description(sample_plan)
        assert "<!-- n8n-sync -->" in desc


# ---------------------------------------------------------------------------
# Description builder — quick_task_to_wp_description
# ---------------------------------------------------------------------------


class TestQuickTaskToWpDescription:
    def test_description_appears(self, sample_quick_task: QuickTask) -> None:
        desc = quick_task_to_wp_description(sample_quick_task)
        assert "Patched NULL concept_ids in measurement table" in desc

    def test_date_appears(self, sample_quick_task: QuickTask) -> None:
        desc = quick_task_to_wp_description(sample_quick_task)
        assert "2026-04-10" in desc

    def test_commit_hash_appears(self, sample_quick_task: QuickTask) -> None:
        desc = quick_task_to_wp_description(sample_quick_task)
        assert "def5678" in desc

    def test_sync_marker_present(self, sample_quick_task: QuickTask) -> None:
        desc = quick_task_to_wp_description(sample_quick_task)
        assert "<!-- n8n-sync -->" in desc


# ---------------------------------------------------------------------------
# Description builder — phase_to_gh_issue_body
# ---------------------------------------------------------------------------


class TestPhaseToGhIssueBody:
    def test_h2_header_present(self, sample_phase: RoadmapPhase) -> None:
        body = phase_to_gh_issue_body(sample_phase)
        assert "## Phase 3: Data Enrichment" in body

    def test_goal_present(self, sample_phase: RoadmapPhase) -> None:
        body = phase_to_gh_issue_body(sample_phase)
        assert "Enrich the CDM with derived analytics" in body

    def test_success_criteria_as_checkboxes(self, sample_phase: RoadmapPhase) -> None:
        body = phase_to_gh_issue_body(sample_phase)
        assert "- [ ] All concept IDs resolved" in body

    def test_plans_list_present(self, sample_phase: RoadmapPhase) -> None:
        body = phase_to_gh_issue_body(sample_phase)
        assert "03-01: Concept resolution" in body

    def test_roadmap_attribution_present(self, sample_phase: RoadmapPhase) -> None:
        body = phase_to_gh_issue_body(sample_phase)
        assert "Synced from .planning/ROADMAP.md" in body


# ---------------------------------------------------------------------------
# Label generators
# ---------------------------------------------------------------------------


class TestPhaseLabels:
    def test_phase_label_zero_padded(self, sample_phase: RoadmapPhase) -> None:
        labels = phase_labels(sample_phase)
        assert "phase:03" in labels

    def test_sync_label_always_present(self, sample_phase: RoadmapPhase) -> None:
        labels = phase_labels(sample_phase)
        assert "synced-by:n8n" in labels

    def test_req_labels_added(self, sample_phase: RoadmapPhase) -> None:
        labels = phase_labels(sample_phase)
        assert "req:FOUND-05" in labels
        assert "req:FOUND-06" in labels

    def test_in_progress_label_when_executing(self, sample_phase: RoadmapPhase) -> None:
        labels = phase_labels(sample_phase)
        assert "in-progress" in labels

    def test_no_in_progress_label_when_complete(self, complete_phase: RoadmapPhase) -> None:
        labels = phase_labels(complete_phase)
        assert "in-progress" not in labels


class TestPlanLabels:
    def test_phase_label_present(self, sample_plan: PlanDetail) -> None:
        labels = plan_labels(sample_plan)
        assert "phase:03" in labels

    def test_plan_label_zero_padded(self, sample_plan: PlanDetail) -> None:
        labels = plan_labels(sample_plan)
        assert "plan:03-02" in labels

    def test_sync_label_present(self, sample_plan: PlanDetail) -> None:
        labels = plan_labels(sample_plan)
        assert "synced-by:n8n" in labels

    def test_req_labels_added(self, sample_plan: PlanDetail) -> None:
        labels = plan_labels(sample_plan)
        assert "req:FOUND-06" in labels
