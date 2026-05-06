"""Phase 3 Plan 1 Task 5: CostProjector emits OMOP CDM v5.4 COST rows.

Maps ``X12_837_ClaimLine`` (charged / allowed / paid amounts) into one or
more ``CostRow`` objects suitable for ``cost.cost`` in OMOP CDM v5.4.

Asserts the contract:
- One COST row per (claim line) x (non-NULL amount kind) -- i.e. up to three
  rows per line (charged + allowed + paid).
- ``charged_amount`` is always present (the line's ``charged_amount`` is
  ``Field(ge=0)`` so it always projects, even if zero).
- ``cost_event_field_concept_id`` = 1147301 (procedure_occurrence) at the
  line level; 1147300 (visit_occurrence) when ``CostProjector.project_claim``
  emits institutional claim-level totals (Task 9 mapper for 837I).
- ``currency_concept_id`` = 44818668 (USD) — hard-coded in v0.1 per ADR 0016.
- ``cost_concept_id`` is one of the OMOP cost-type concepts:
    * 31968 — "Total charged"   (charged_amount)
    * 31976 — "Total allowed"   (allowed_amount)
    * 31973 — "Paid by payer"   (paid_amount)
- ``cost_event_id`` is the procedure_occurrence_id (line) or
  visit_occurrence_id (claim header) the row is anchored to. The projector
  takes these as parameters — it doesn't allocate new IDs.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from runtime.commercial.claims.cost_projector import (
    COST_CONCEPT_ALLOWED,
    COST_CONCEPT_CHARGED,
    COST_CONCEPT_PAID,
    COST_EVENT_FIELD_PROCEDURE_OCCURRENCE,
    COST_EVENT_FIELD_VISIT_OCCURRENCE,
    CURRENCY_CONCEPT_USD,
    CostProjector,
    CostRow,
)
from runtime.commercial.claims.exceptions import CostProjectionError
from runtime.commercial.claims.types import X12_837_Claim, X12_837_ClaimLine


def _line(**overrides: object) -> X12_837_ClaimLine:
    base: dict[str, object] = {
        "claim_id": "CLM-001",
        "line_number": 1,
        "procedure_code": "99213",
        "service_date_from": date(2026, 1, 10),
        "service_date_to": date(2026, 1, 10),
        "units": Decimal("1"),
        "charged_amount": Decimal("125.00"),
        "allowed_amount": Decimal("100.00"),
        "paid_amount": Decimal("80.00"),
    }
    base.update(overrides)
    return X12_837_ClaimLine(**base)  # type: ignore[arg-type]


def _claim(**overrides: object) -> X12_837_Claim:
    base: dict[str, object] = {
        "claim_id": "CLM-001",
        "payer_id": "PAYER-001",
        "submitter_id": "SUB-001",
        "receiver_id": "RCV-001",
        "subscriber_id": "MEMBER-XYZ",
        "patient_id": "PAT-HASH-9F",
        "claim_type": "P",
        "statement_date": date(2026, 1, 15),
        "total_charged": Decimal("250.00"),
        "total_paid": Decimal("160.00"),
    }
    base.update(overrides)
    return X12_837_Claim(**base)  # type: ignore[arg-type]


class TestProjectLine:
    def test_line_with_all_three_amounts_yields_three_rows(self) -> None:
        proj = CostProjector()
        rows = proj.project_line(_line(), procedure_occurrence_id=42)
        assert len(rows) == 3
        assert {r.cost_concept_id for r in rows} == {
            COST_CONCEPT_CHARGED,
            COST_CONCEPT_ALLOWED,
            COST_CONCEPT_PAID,
        }

    def test_line_only_charged_yields_one_row(self) -> None:
        proj = CostProjector()
        line = _line(allowed_amount=None, paid_amount=None)
        rows = proj.project_line(line, procedure_occurrence_id=42)
        assert len(rows) == 1
        assert rows[0].cost_concept_id == COST_CONCEPT_CHARGED
        assert rows[0].cost == Decimal("125.00")

    def test_zero_charged_amount_still_projects(self) -> None:
        proj = CostProjector()
        line = _line(charged_amount=Decimal("0"), allowed_amount=None, paid_amount=None)
        rows = proj.project_line(line, procedure_occurrence_id=99)
        assert len(rows) == 1
        assert rows[0].cost == Decimal("0")

    def test_event_id_and_field_concept_set(self) -> None:
        proj = CostProjector()
        rows = proj.project_line(_line(), procedure_occurrence_id=7)
        for row in rows:
            assert row.cost_event_id == 7
            assert row.cost_event_field_concept_id == COST_EVENT_FIELD_PROCEDURE_OCCURRENCE

    def test_currency_is_usd(self) -> None:
        proj = CostProjector()
        rows = proj.project_line(_line(), procedure_occurrence_id=1)
        for row in rows:
            assert row.currency_concept_id == CURRENCY_CONCEPT_USD

    def test_revenue_code_threaded_through(self) -> None:
        proj = CostProjector()
        rows = proj.project_line(
            _line(),
            procedure_occurrence_id=1,
            revenue_code_concept_id=12345,
        )
        for row in rows:
            assert row.revenue_code_concept_id == 12345

    def test_payer_plan_period_threaded_through(self) -> None:
        proj = CostProjector()
        rows = proj.project_line(_line(), procedure_occurrence_id=1, payer_plan_period_id=99)
        for row in rows:
            assert row.payer_plan_period_id == 99

    def test_payer_plan_period_optional(self) -> None:
        proj = CostProjector()
        rows = proj.project_line(_line(), procedure_occurrence_id=1)
        for row in rows:
            assert row.payer_plan_period_id is None


class TestProjectClaim:
    def test_institutional_claim_emits_visit_level_total(self) -> None:
        proj = CostProjector()
        claim = _claim(claim_type="I")
        rows = proj.project_claim(claim, visit_occurrence_id=500)
        # Institutional claims project total_charged + total_paid at the
        # visit level; total_allowed only when an 835 reconciliation has
        # populated the claim (Plan 2). With no allowed total set we expect
        # exactly two rows.
        assert len(rows) == 2
        for row in rows:
            assert row.cost_event_id == 500
            assert row.cost_event_field_concept_id == COST_EVENT_FIELD_VISIT_OCCURRENCE

    def test_professional_claim_emits_no_header_rows(self) -> None:
        # 837P costs live entirely at the line level (per-CPT), so
        # project_claim returns an empty list for P-type claims.
        proj = CostProjector()
        rows = proj.project_claim(_claim(claim_type="P"), visit_occurrence_id=100)
        assert rows == []

    def test_dental_claim_emits_no_header_rows(self) -> None:
        proj = CostProjector()
        rows = proj.project_claim(_claim(claim_type="D"), visit_occurrence_id=200)
        assert rows == []


class TestEventIdValidation:
    def test_negative_procedure_occurrence_id_raises(self) -> None:
        proj = CostProjector()
        with pytest.raises(CostProjectionError):
            proj.project_line(_line(), procedure_occurrence_id=-1)

    def test_zero_procedure_occurrence_id_raises(self) -> None:
        proj = CostProjector()
        with pytest.raises(CostProjectionError):
            proj.project_line(_line(), procedure_occurrence_id=0)


class TestCostRowFields:
    def test_cost_row_is_frozen(self) -> None:
        row = CostRow(
            cost_event_id=1,
            cost_event_field_concept_id=COST_EVENT_FIELD_PROCEDURE_OCCURRENCE,
            cost_concept_id=COST_CONCEPT_CHARGED,
            cost=Decimal("100"),
            currency_concept_id=CURRENCY_CONCEPT_USD,
            revenue_code_concept_id=None,
            payer_plan_period_id=None,
        )
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            row.cost = Decimal("999")  # type: ignore[misc]

    def test_cost_row_extra_forbidden(self) -> None:
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            CostRow(  # type: ignore[call-arg]
                cost_event_id=1,
                cost_event_field_concept_id=COST_EVENT_FIELD_PROCEDURE_OCCURRENCE,
                cost_concept_id=COST_CONCEPT_CHARGED,
                cost=Decimal("100"),
                currency_concept_id=CURRENCY_CONCEPT_USD,
                revenue_code_concept_id=None,
                payer_plan_period_id=None,
                surprise_field="leak",
            )
