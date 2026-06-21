"""Abby protocol-to-publication orchestrator (ADR-0020 Phase 5).

A deterministic 7-stage finite state machine (S1 design -> S7 publication) that
drives a study through the gated rigor substrate built in Phases 1-4. The
orchestrator's only levers are authenticated calls into the Laravel API
(``tools.OrchestratorTools``); enforcement mirrors the server-side gate ledger
(``guards.GateGuard``) so the agent can never bypass a blocking gate even if its
own guard is wrong (Laravel also enforces via ``StudyGateService::assertMayRun``).

The FSM itself is interpreter-free and fully unit-testable: inject a fake tool
layer and assert the headline behaviour — for study 114 it halts at S5 on the
propensity-score separation failure, keeps the effect estimates blinded, and
emits an active-comparator remediation, never reaching estimation/publication.
"""

from app.orchestrator.guards import GateBlocked, GateGuard
from app.orchestrator.state_machine import (
    OrchestratorResult,
    StageOutcome,
    StudyOrchestrator,
)
from app.orchestrator.tools import OrchestratorTools

__all__ = [
    "GateBlocked",
    "GateGuard",
    "OrchestratorResult",
    "OrchestratorTools",
    "StageOutcome",
    "StudyOrchestrator",
]
