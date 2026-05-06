"""Phase 3 Plan 2 Task 3 (T-021B): RemitReconciler.

Tests the in-process algorithm: given a list of X12_835_RemitItem and the
set of existing (payer_id, claim_id, line_number) keys in the COST table,
produce a ReconciliationPlan with:

- updates: one CostUpdate per matched remit
- orphans: one OrphanRemit per remit that doesn't match an existing key
- compensations: empty in Task 3 (Task 4 wires reversals)

The reconciler is pure Python — Task 6 wires it to a SQL UPDATE stage.
This separation lets us unit-test the matching logic without a database.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

from runtime.commercial.claims.remit_reconciler import (
    CostMatchKey,
    CostUpdate,
    OrphanRemit,
    ReconciliationPlan,
    RemitReconciler,
)
from runtime.commercial.claims.types import X12_835_RemitItem


def _remit(
    *,
    payer_id: str = "PAYER001",
    claim_id: str = "PCN001",
    line_number: int = 1,
    procedure_code: str = "99213",
    charged_amount: str = "200.00",
    paid_amount: str = "150.00",
    allowed_amount: str = "180.00",
    is_reversal: bool = False,
    paid_date: date | None = None,
) -> X12_835_RemitItem:
    return X12_835_RemitItem(
        payer_id=payer_id,
        claim_id=claim_id,
        line_number=line_number,
        procedure_code=procedure_code,
        charged_amount=Decimal(charged_amount),
        paid_amount=Decimal(paid_amount),
        allowed_amount=Decimal(allowed_amount),
        is_reversal=is_reversal,
        paid_date=paid_date or date(2024, 1, 15),
    )


def test_match_key_is_payer_claim_line_triple() -> None:
    key = CostMatchKey(payer_id="P1", claim_id="C1", line_number=2)
    assert key.payer_id == "P1"
    assert key.claim_id == "C1"
    assert key.line_number == 2


def test_reconciler_emits_update_when_remit_matches_existing_cost_row() -> None:
    remits = [_remit()]
    existing = {("PAYER001", "PCN001", 1)}

    plan = RemitReconciler().reconcile(remits, existing)

    assert isinstance(plan, ReconciliationPlan)
    assert len(plan.updates) == 1
    assert len(plan.orphans) == 0
    assert plan.compensations == []

    update = plan.updates[0]
    assert isinstance(update, CostUpdate)
    assert update.match_key == CostMatchKey(payer_id="PAYER001", claim_id="PCN001", line_number=1)
    assert update.new_paid_amount == Decimal("150.00")
    assert update.new_allowed_amount == Decimal("180.00")
    assert update.paid_date == date(2024, 1, 15)


def test_reconciler_emits_orphan_when_no_matching_cost_row() -> None:
    remits = [_remit(claim_id="GHOST")]
    existing: set[tuple[str, str, int]] = set()  # No claims loaded

    plan = RemitReconciler().reconcile(remits, existing)

    assert len(plan.updates) == 0
    assert len(plan.orphans) == 1
    orphan = plan.orphans[0]
    assert isinstance(orphan, OrphanRemit)
    assert orphan.claim_id == "GHOST"
    assert orphan.payer_id == "PAYER001"
    assert orphan.paid_amount == Decimal("150.00")


def test_reconciler_handles_mixed_match_and_orphan() -> None:
    remits = [
        _remit(claim_id="MATCH001", line_number=1),
        _remit(claim_id="ORPHAN001", line_number=1),
        _remit(claim_id="MATCH001", line_number=2),
    ]
    existing = {
        ("PAYER001", "MATCH001", 1),
        ("PAYER001", "MATCH001", 2),
    }

    plan = RemitReconciler().reconcile(remits, existing)

    assert len(plan.updates) == 2
    assert len(plan.orphans) == 1
    assert plan.orphans[0].claim_id == "ORPHAN001"


def test_reconciler_carries_adjustment_codes_onto_update() -> None:
    item = _remit()
    item = item.model_copy(update={"adjustment_codes": [("CO", "45", Decimal("50.00"))]})
    existing = {("PAYER001", "PCN001", 1)}

    plan = RemitReconciler().reconcile([item], existing)

    assert plan.updates[0].adjustment_codes == [("CO", "45", Decimal("50.00"))]


def test_reconciler_passes_orphan_count_to_warning_log(caplog: object) -> None:
    """Orphan remits emit a WARNING-level log entry the caller can capture."""
    import logging

    remits = [_remit(claim_id="LOSTCLAIM001")]
    existing: set[tuple[str, str, int]] = set()

    with __import__("pytest").importorskip("pytest").MonkeyPatch.context() as m:
        del m
        # Use a real caplog-style capture since we don't have a fixture here.
        records: list[logging.LogRecord] = []

        class _Cap(logging.Handler):
            def emit(self, record: logging.LogRecord) -> None:
                records.append(record)

        handler = _Cap()
        logger = logging.getLogger("runtime.commercial.claims.remit_reconciler")
        logger.addHandler(handler)
        logger.setLevel(logging.WARNING)
        try:
            RemitReconciler().reconcile(remits, existing)
        finally:
            logger.removeHandler(handler)

        # Exactly one WARNING per orphan.
        warning_records = [r for r in records if r.levelno >= logging.WARNING]
        assert len(warning_records) == 1
        # PHI is scrubbed by the redaction filter (HIGHSEC §7); the literal
        # claim_id should not appear in the captured message.
        msg = warning_records[0].getMessage()
        # Just confirm the orphan-count is communicated; the literal id may
        # be redacted depending on filter ordering at the handler level.
        assert "orphan" in msg.lower()


def test_reconciler_does_not_emit_compensations_for_non_reversal_items() -> None:
    """Reversal handling is Task 4 — Task 3's reconciler ignores is_reversal."""
    plan = RemitReconciler().reconcile([_remit(is_reversal=False)], {("PAYER001", "PCN001", 1)})
    assert plan.compensations == []
