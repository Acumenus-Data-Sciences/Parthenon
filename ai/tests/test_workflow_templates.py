"""Tests for Phase 5 workflow templates (Task 5)."""
from __future__ import annotations

import pytest

from app.agency.workflow_templates import WorkflowTemplates


def test_incident_cohort_template_generates_minimum_steps() -> None:
    """incident_cohort() should produce >= 3 steps."""
    steps = WorkflowTemplates.incident_cohort(
        condition_name="Type 2 Diabetes",
        condition_concepts=[201826],
        drug_name="Metformin",
        drug_concepts=[6809],
        washout_days=365,
        source_id=1,
    )
    assert len(steps) >= 3


def test_incident_cohort_template_starts_with_create_concept_set() -> None:
    """incident_cohort() first step must be create_concept_set."""
    steps = WorkflowTemplates.incident_cohort(
        condition_name="Hypertension",
        condition_concepts=[316866],
        drug_name="Lisinopril",
        drug_concepts=[1308216],
    )
    assert steps[0]["tool_name"] == "create_concept_set"


def test_characterization_study_template_includes_generate_cohort_step() -> None:
    """characterization_study() must include a generate_cohort step."""
    steps = WorkflowTemplates.characterization_study(
        cohort_name="Atrial Fibrillation",
        condition_concepts=[313217],
        source_id=1,
    )
    tool_names = [s["tool_name"] for s in steps]
    assert "generate_cohort" in tool_names


def test_list_templates_returns_minimum_two() -> None:
    """list_templates() must return at least 2 templates."""
    templates = WorkflowTemplates.list_templates()
    assert len(templates) >= 2
    # Each template must have name and description
    for tmpl in templates:
        assert "name" in tmpl
        assert "description" in tmpl


def test_format_for_prompt_includes_template_names() -> None:
    """format_for_prompt() output must include each template name."""
    prompt = WorkflowTemplates.format_for_prompt()
    templates = WorkflowTemplates.list_templates()
    for tmpl in templates:
        assert tmpl["name"] in prompt
