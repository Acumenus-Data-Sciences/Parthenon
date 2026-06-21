"""Pre-call gate enforcement for the orchestrator (ADR-0020 Phase 5).

Mirrors ``App\\Services\\Studies\\Gates\\StudyGateService`` so the agent refuses a
blocked action *before* calling Laravel. This is defense in depth: Laravel also
enforces via ``assertMayRun`` / estimate blinding, so a wrong guard here cannot
leak an effect estimate past a failed gate.
"""

from __future__ import annotations

# GateStatus::clears() — the only statuses that let the pipeline proceed.
CLEARING_STATUSES = frozenset({"passed", "overridden", "approved"})

# A blocking action -> the gate stage(s) that must clear before it may run.
# Matches the prerequisite chain enforced server-side:
#   - estimation may only run once cohort diagnostics (S3) and data quality (S4)
#     have cleared (otherwise the run executes against a degenerate cohort);
#   - publication export may only run once the calibration gate (S6) clears
#     (otherwise an uncalibrated estimate could be published).
PREREQUISITES: dict[str, tuple[str, ...]] = {
    "run_estimation": ("cohort_diagnostics", "data_quality"),
    "export_publication": ("study_diagnostics", "estimation_calibration"),
}


class GateBlocked(Exception):
    """Raised when an action is attempted while a prerequisite gate has not cleared."""

    def __init__(self, action: str, prerequisite: str, reasons: list[str]) -> None:
        self.action = action
        self.prerequisite = prerequisite
        self.reasons = reasons
        detail = f"; reasons: {', '.join(reasons)}" if reasons else ""
        super().__init__(
            f"'{action}' is blocked: the '{prerequisite}' gate has not cleared{detail}"
        )


class GateGuard:
    """Reads the gate ledger and authorizes (or refuses) blocking actions."""

    def __init__(self, gating_enabled: bool = True) -> None:
        # When gating is disabled (STUDIES_GATING_ENABLED=false) the server lets
        # everything proceed; mirror that so dry runs against unflagged studies
        # behave identically to production-without-gating.
        self._gating_enabled = gating_enabled

    @staticmethod
    def _find(gates: list[dict], stage: str) -> dict | None:
        return next((g for g in gates if g.get("stage") == stage), None)

    def gate_clears(self, gates: list[dict], stage: str) -> bool:
        """True when the stage's gate exists and has a clearing status. A missing
        gate is treated as NOT cleared when gating is on (matches mayProceed)."""
        if not self._gating_enabled:
            return True
        gate = self._find(gates, stage)
        return gate is not None and str(gate.get("status")) in CLEARING_STATUSES

    def reasons_for(self, gates: list[dict], stage: str) -> list[str]:
        gate = self._find(gates, stage)
        if gate is None:
            return []
        metrics = gate.get("metrics_json") or {}
        reasons = metrics.get("reasons") if isinstance(metrics, dict) else None
        return list(reasons) if isinstance(reasons, list) else []

    def assert_may_run(self, action: str, gates: list[dict]) -> None:
        """Raise ``GateBlocked`` if any prerequisite gate for ``action`` is not
        cleared. No-op when gating is disabled or the action has no prerequisites."""
        if not self._gating_enabled:
            return
        for prerequisite in PREREQUISITES.get(action, ()):  # noqa: B007
            if not self.gate_clears(gates, prerequisite):
                raise GateBlocked(action, prerequisite, self.reasons_for(gates, prerequisite))
