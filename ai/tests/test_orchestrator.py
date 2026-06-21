"""Headline + guard tests for the protocol-to-publication orchestrator FSM
(ADR-0020 Phase 5). These are the dry-run regression assertions: the FSM is
exercised against a fake Laravel API (no live darkstar / no production DB), so
they prove the gate-halting logic deterministically and offline.
"""

from __future__ import annotations

from typing import Any, Optional

import pytest

from app.orchestrator.guards import GateBlocked, GateGuard
from app.orchestrator.state_machine import StudyOrchestrator
from app.orchestrator.tools import OrchestratorTools


class FakeApi:
    """Records calls and returns a canned gate ledger for the /gates endpoints."""

    def __init__(self, gates: list[dict], gating_enabled: bool = True) -> None:
        self._gates = gates
        self._gating = gating_enabled
        self.calls: list[tuple[str, str]] = []

    async def call(
        self,
        method: str,
        path: str,
        auth_token: str,
        data: Optional[dict[str, Any]] = None,
        timeout: float = 60.0,
    ) -> dict[str, Any]:
        self.calls.append((method, path))
        if path.endswith("/gates"):
            return {
                "success": True,
                "status": 200,
                "data": {"data": self._gates, "gating_enabled": self._gating},
            }
        if path.endswith("/gates/evaluate"):
            return {"success": True, "status": 200, "data": {"data": self._gates, "message": "ok"}}
        return {"success": True, "status": 202, "data": {}}


def _gate(stage: str, status: str, reasons: Optional[list[str]] = None) -> dict:
    return {"stage": stage, "status": status, "metrics_json": {"reasons": reasons or []}}


# Study 114: characterization/DQ pass, but the propensity-score model is fully
# separated (AUC ~ 1, equipoise ~ 0) so the study-diagnostics gate fails.
STUDY_114_GATES = [
    _gate("design", "passed"),
    _gate("phenotype", "passed"),
    _gate("cohort_diagnostics", "passed"),
    _gate("data_quality", "passed"),
    _gate("study_diagnostics", "failed", ["ps_auc 0.99 exceeds 0.80", "equipoise 0.01 below 0.30"]),
    _gate("estimation_calibration", "pending"),
    _gate("publication", "pending"),
]


async def test_study_114_halts_at_s5_with_estimates_blinded():
    """The headline ADR-0020 acceptance: the orchestrator advances through S1-S4,
    halts at S5 on the separation failure, keeps estimates blinded, proposes an
    active comparator, and never reaches estimation/publication."""
    api = FakeApi(STUDY_114_GATES)
    orch = StudyOrchestrator(OrchestratorTools(api, "scoped-token", "hypertension-v3"))

    result = await orch.run()

    assert result.halted_at == "study_diagnostics"
    assert result.advanced_to == "data_quality"
    assert result.estimates_blinded is True

    halted = next(s for s in result.stages if s.result == "halted")
    assert "active-comparator" in halted.remediation.lower()
    assert halted.reasons  # carries the separation reasons for the manuscript

    walked = [s.stage for s in result.stages]
    assert walked == ["design", "phenotype", "cohort_diagnostics", "data_quality", "study_diagnostics"]
    assert "publication" not in walked  # never reached


async def test_full_pass_advances_to_publication():
    gates = [_gate(s, "passed") for s in (
        "design", "phenotype", "cohort_diagnostics", "data_quality",
        "study_diagnostics", "estimation_calibration", "publication",
    )]
    orch = StudyOrchestrator(OrchestratorTools(FakeApi(gates), "tok", "clean-study"))

    result = await orch.run()

    assert result.halted_at is None
    assert result.advanced_to == "publication"
    assert result.estimates_blinded is False


async def test_s6_calibration_halt_keeps_estimates_blinded():
    gates = [_gate(s, "passed") for s in ("design", "phenotype", "cohort_diagnostics", "data_quality", "study_diagnostics")]
    gates.append(_gate("estimation_calibration", "failed", ["insufficient_controls (2 informative)"]))
    gates.append(_gate("publication", "pending"))
    orch = StudyOrchestrator(OrchestratorTools(FakeApi(gates), "tok", "few-controls"))

    result = await orch.run()

    assert result.halted_at == "estimation_calibration"
    # S5 cleared, so estimates are unblinded but publication is still blocked on calibration.
    assert result.estimates_blinded is False
    halted = next(s for s in result.stages if s.result == "halted")
    assert "negative controls" in halted.remediation.lower()


async def test_gating_disabled_clears_everything():
    """With STUDIES_GATING_ENABLED=false the server lets everything proceed; the
    FSM must mirror that and never halt."""
    gates = [_gate("study_diagnostics", "failed", ["separation"])]
    orch = StudyOrchestrator(OrchestratorTools(FakeApi(gates, gating_enabled=False), "tok", "ungated"))

    result = await orch.run()

    assert result.halted_at is None
    assert result.gating_enabled is False


def test_guard_blocks_estimation_until_prerequisites_clear():
    guard = GateGuard(gating_enabled=True)
    gates = [_gate("cohort_diagnostics", "failed", ["0 subjects"]), _gate("data_quality", "passed")]

    with pytest.raises(GateBlocked) as exc:
        guard.assert_may_run("run_estimation", gates)
    assert exc.value.prerequisite == "cohort_diagnostics"
    assert "0 subjects" in exc.value.reasons


def test_guard_blocks_export_until_calibration_clears():
    guard = GateGuard(gating_enabled=True)
    gates = [_gate("study_diagnostics", "passed"), _gate("estimation_calibration", "failed", ["insufficient_controls"])]

    with pytest.raises(GateBlocked) as exc:
        guard.assert_may_run("export_publication", gates)
    assert exc.value.prerequisite == "estimation_calibration"


async def test_execute_path_runs_evaluate_and_is_guarded():
    """The live staged path evaluates gates; estimation stays guarded behind
    S3+S4. Here S3/S4 are cleared so execution proceeds to evaluate_gates."""
    api = FakeApi(STUDY_114_GATES)
    orch = StudyOrchestrator(OrchestratorTools(api, "tok", "hypertension-v3"))

    result = await orch.run(source_id=47, execute=True)

    assert ("POST", "studies/hypertension-v3/gates/evaluate") in api.calls
    assert result.halted_at == "study_diagnostics"  # still halts after evaluation
