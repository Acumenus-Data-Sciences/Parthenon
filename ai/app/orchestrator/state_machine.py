"""The 7-stage protocol-to-publication FSM (ADR-0020 Phase 5).

Drives a study S1->S7 over the gated rigor substrate. The machine is
deterministic and interpreter-free: it walks the server-authoritative gate
ledger in stage order and halts at the first gate that has not cleared, emitting
a remediation proposal. Effect estimates remain blinded (the server strips them)
until the study-diagnostics gate (S5) clears, so a study that halts at or before
S5 never surfaces an unbiased effect estimate.

The optional ``execute=True`` path performs the staged live execution (cohort
diagnostics -> data quality -> estimation -> gate evaluation), guarded so
estimation only runs once S3 and S4 have cleared. The dry path (default) walks
the existing ledger and is what the unit tests assert against.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Callable, Optional

from app.orchestrator.guards import GateBlocked, GateGuard
from app.orchestrator.tools import OrchestratorTools

# Stage order = GateStage enum order (S1..S7).
STAGES: tuple[str, ...] = (
    "design",
    "phenotype",
    "cohort_diagnostics",
    "data_quality",
    "study_diagnostics",
    "estimation_calibration",
    "publication",
)

# The gate after which effect estimates are unblinded.
UNBLIND_AFTER = "study_diagnostics"


@dataclass
class StageOutcome:
    stage: str
    result: str  # "cleared" | "halted" | "skipped"
    gate_status: Optional[str] = None
    reasons: list[str] = field(default_factory=list)
    remediation: Optional[str] = None


@dataclass
class OrchestratorResult:
    study_ref: str
    advanced_to: Optional[str]
    halted_at: Optional[str]
    estimates_blinded: bool
    gating_enabled: bool
    actions_taken: list[str]
    stages: list[StageOutcome]

    def to_dict(self) -> dict[str, Any]:
        return {
            "study": self.study_ref,
            "advanced_to": self.advanced_to,
            "halted_at": self.halted_at,
            "estimates_blinded": self.estimates_blinded,
            "gating_enabled": self.gating_enabled,
            "actions_taken": self.actions_taken,
            "stages": [
                {
                    "stage": s.stage,
                    "result": s.result,
                    "gate_status": s.gate_status,
                    "reasons": s.reasons,
                    "remediation": s.remediation,
                }
                for s in self.stages
            ],
        }


# Deterministic remediation per failing stage. Keyed on the failing reasons so a
# separation failure maps to the active-comparator proposal the ADR requires.
def _remediation(stage: str, reasons: list[str]) -> str:
    joined = " ".join(reasons).lower()
    if stage == "study_diagnostics":
        if "equipoise" in joined or "auc" in joined or "smd" in joined or "separation" in joined:
            return (
                "Switch to an active-comparator design. The propensity-score model "
                "shows complete separation (no clinical equipoise between target and "
                "comparator), so no unbiased effect estimate is possible — estimates "
                "remain blinded."
            )
        return "Revise the comparator/adjustment so the diagnostics gate can pass; estimates remain blinded."
    if stage == "estimation_calibration":
        return (
            "Add at least 5 informative negative controls. The empirical-calibration "
            "model cannot be fit on the current panel, so no calibrated effect "
            "estimate can be published."
        )
    if stage == "cohort_diagnostics":
        return "Revise the cohort: it is empty or degenerate (an inclusion rule removed every subject)."
    if stage == "data_quality":
        return "Resolve the severe data-quality failures before re-running the study."
    return "Resolve the gate's reported reasons before proceeding."


class StudyOrchestrator:
    def __init__(
        self,
        tools: OrchestratorTools,
        guard: Optional[GateGuard] = None,
        emit: Optional[Callable[[str, dict[str, Any]], Any]] = None,
    ) -> None:
        self._tools = tools
        self._guard = guard
        self._emit = emit

    def _signal(self, event: str, data: dict[str, Any]) -> None:
        if self._emit is not None:
            self._emit(event, data)

    @staticmethod
    def _unwrap_gates(resp: dict[str, Any]) -> tuple[list[dict], bool]:
        """Extract (gates, gating_enabled) from the Laravel gate-index envelope.

        AgencyApiClient returns ``{"success", "status", "data": <body>}`` where the
        body is ``{"data": [...gates], "gating_enabled": bool}``.
        """
        body = resp.get("data") if isinstance(resp, dict) else None
        if not isinstance(body, dict):
            return [], False
        gates = body.get("data")
        gating_enabled = bool(body.get("gating_enabled", False))
        return (gates if isinstance(gates, list) else []), gating_enabled

    async def run(self, source_id: Optional[int] = None, execute: bool = False) -> OrchestratorResult:
        self._signal("orchestrator.start", {"study": self._tools._study, "execute": execute})

        gates_resp = await self._tools.get_gates()
        gates, gating_enabled = self._unwrap_gates(gates_resp)
        guard = self._guard or GateGuard(gating_enabled)

        actions_taken: list[str] = []

        # Optional live staged execution. Estimation is guarded behind S3+S4.
        if execute:
            if not guard.gate_clears(gates, "cohort_diagnostics") or not guard.gate_clears(gates, "data_quality"):
                # Diagnostics/DQ not yet cleared — run them, then re-read the ledger.
                self._signal("orchestrator.action", {"action": "execute_study"})
                await self._tools.execute_study(source_id or 0)
                actions_taken.append("execute_study")
                gates, gating_enabled = self._unwrap_gates(await self._tools.get_gates())

            # Estimation is only permitted once the prerequisite gates clear.
            guard.assert_may_run("run_estimation", gates)
            self._signal("orchestrator.action", {"action": "evaluate_gates"})
            await self._tools.evaluate_gates()
            actions_taken.append("evaluate_gates")
            gates, gating_enabled = self._unwrap_gates(await self._tools.get_gates())

        # Walk the ledger in stage order; halt at the first non-clearing gate.
        outcomes: list[StageOutcome] = []
        advanced_to: Optional[str] = None
        halted_at: Optional[str] = None

        for stage in STAGES:
            gate = next((g for g in gates if g.get("stage") == stage), None)
            status = str(gate.get("status")) if gate else None

            if guard.gate_clears(gates, stage):
                outcomes.append(StageOutcome(stage, "cleared", status))
                advanced_to = stage
                self._signal("orchestrator.stage.cleared", {"stage": stage, "status": status})
                continue

            reasons = guard.reasons_for(gates, stage)
            remediation = _remediation(stage, reasons)
            outcomes.append(StageOutcome(stage, "halted", status, reasons, remediation))
            halted_at = stage
            self._signal(
                "orchestrator.stage.halted",
                {"stage": stage, "status": status, "reasons": reasons, "remediation": remediation},
            )
            break

        estimates_blinded = halted_at is not None and STAGES.index(halted_at) <= STAGES.index(UNBLIND_AFTER)

        result = OrchestratorResult(
            study_ref=self._tools._study,
            advanced_to=advanced_to,
            halted_at=halted_at,
            estimates_blinded=estimates_blinded,
            gating_enabled=gating_enabled,
            actions_taken=actions_taken,
            stages=outcomes,
        )
        self._signal("orchestrator.done", result.to_dict())
        return result


__all__ = ["GateBlocked", "OrchestratorResult", "StageOutcome", "StudyOrchestrator", "STAGES"]
