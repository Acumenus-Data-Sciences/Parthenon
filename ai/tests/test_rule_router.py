"""Tests for Rule Router — two-stage rule-based model routing (local vs cloud)."""
import pytest
from app.routing.rule_router import RuleRouter, RoutingDecision


@pytest.fixture
def router() -> RuleRouter:
    return RuleRouter()


# ── Stage 1: CLOUD decisions ─────────────────────────────────────────────────

def test_stage1_cloud_create_concept_set(router: RuleRouter) -> None:
    decision = router.route("Create a new concept set for Type 2 diabetes")
    assert decision.model == "claude"
    assert decision.stage == 1


def test_stage1_cloud_build_cohort(router: RuleRouter) -> None:
    decision = router.route("Build me a cohort of patients with heart failure")
    assert decision.model == "claude"
    assert decision.stage == 1


def test_stage1_cloud_long_complex_message(router: RuleRouter) -> None:
    long_msg = (
        "I need to design a study that selects all patients with Type 2 diabetes "
        "who had an HbA1c measurement above 9.0, and I want to include only those "
        "with at least 12 months of observation prior to the index date, "
        "but exclude patients with gestational diabetes or type 1 diabetes diagnoses."
    )
    assert len(long_msg) > 200
    decision = router.route(long_msg)
    assert decision.model == "claude"
    assert decision.stage == 1


def test_stage1_cloud_modify_inclusion(router: RuleRouter) -> None:
    decision = router.route("Modify the inclusion criteria to require 365 days of prior observation")
    assert decision.model == "claude"
    assert decision.stage == 1


# ── Stage 1: LOCAL decisions ─────────────────────────────────────────────────

def test_stage1_local_hello(router: RuleRouter) -> None:
    decision = router.route("Hello Abby")
    assert decision.model == "local"
    assert decision.stage == 1


def test_stage1_local_thanks(router: RuleRouter) -> None:
    decision = router.route("Thanks!")
    assert decision.model == "local"
    assert decision.stage == 1


def test_stage1_local_concept_lookup(router: RuleRouter) -> None:
    decision = router.route("What is concept 201826?")
    assert decision.model == "local"
    assert decision.stage == 1


def test_stage1_local_patient_count(router: RuleRouter) -> None:
    decision = router.route("How many patients in our CDM?")
    assert decision.model == "local"
    assert decision.stage == 1


# ── Stage 2: CLOUD decisions ─────────────────────────────────────────────────

def test_stage2_cloud_methodology(router: RuleRouter) -> None:
    decision = router.route(
        "Can you explain the methodology to handle immortal time bias in this study design?"
    )
    assert decision.model == "claude"
    assert decision.stage == 2


def test_stage2_cloud_interpretation(router: RuleRouter) -> None:
    decision = router.route(
        "Please interpret these Kaplan-Meier survival curves and explain what the hazard ratio means"
    )
    assert decision.model == "claude"
    assert decision.stage == 2


# ── Stage 2: LOCAL decisions ─────────────────────────────────────────────────

def test_stage2_local_simple_definition(router: RuleRouter) -> None:
    decision = router.route("What is a cohort definition?")
    assert decision.model == "local"
    assert decision.stage == 2


# ── Budget exhausted ─────────────────────────────────────────────────────────

def test_budget_exhausted_routes_local(router: RuleRouter) -> None:
    decision = router.route("Build me a complex cohort", budget_exhausted=True)
    assert decision.model == "local"
    assert decision.reason == "budget_exhausted"


# ── Decision metadata ────────────────────────────────────────────────────────

def test_decision_has_reason(router: RuleRouter) -> None:
    decision = router.route("Create a new cohort")
    assert decision.reason is not None


def test_decision_has_confidence(router: RuleRouter) -> None:
    decision = router.route("What is diabetes?")
    assert 0.0 <= decision.confidence <= 1.0
