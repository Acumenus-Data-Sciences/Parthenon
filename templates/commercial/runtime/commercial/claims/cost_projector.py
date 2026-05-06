"""COST projector — claim-line / claim-header amounts → OMOP CDM v5.4 COST rows.

Phase 3 Plan 1 Task 5 (T-021A). The projector emits ``CostRow`` objects
that map 1:1 onto ``cost.cost`` columns in OMOP CDM v5.4 (§COST,
https://ohdsi.github.io/CommonDataModel/cdm54.html#COST).

Convention (ADR 0016):

- Each non-NULL amount on a claim line projects to its own COST row,
  anchored on the line's ``procedure_occurrence_id``. So a fully
  reconciled professional line with charged/allowed/paid yields three
  rows. The ``cost_concept_id`` distinguishes the kind:

      * ``31968`` — "Total charged"   (charged_amount, source SV1*02 / SV2*03 / SV3*02)
      * ``31976`` — "Total allowed"   (allowed_amount, source CAS*A / 835 reconciliation)
      * ``31973`` — "Paid by payer"   (paid_amount,    source SVC*04 / 835 reconciliation)

  These three concepts come from the OMOP standardized vocabularies
  (Cost Concept Class). They are the OHDSI-blessed mapping for the X12
  837/835 amount kinds.

- Institutional (837I) claims additionally project ``total_charged`` and
  ``total_paid`` at the **visit_occurrence** level — facility billing
  rolls up to the encounter, not to the individual line, and the COST
  table's ``cost_event_field_concept_id`` distinguishes the two anchors:

      * ``1147301`` — Standard concept "procedure_occurrence" (line-level)
      * ``1147300`` — Standard concept "visit_occurrence"     (header-level)

- Professional (837P) and Dental (837D) claims do NOT emit header rows —
  their cost is line-level by construction. The Atlas / OHDSI cost-of-
  care queries assume this convention.

- Currency is hard-coded to USD = 44818668 in v0.1. Multi-currency is a
  Phase 4 follow-up (ADR 0016 §Open follow-ups).

- ``revenue_code_concept_id`` and ``payer_plan_period_id`` are passed in
  by the caller (the Task 9 SQL mapper) — the projector does NOT look up
  vocabulary mappings or join member-eligibility tables. It is purely a
  data-shape adapter.

Stable surface for Plan 2 (X12 835 remit):
    The 835 reader will call ``project_line(line, procedure_occurrence_id, ...)``
    on a line that ONLY carries ``allowed_amount`` and ``paid_amount`` (the
    835 remit doesn't restate the charged amount). The projector tolerates
    a NULL charged_amount silently, but ``X12_837_ClaimLine`` always
    requires it (``Field(ge=0)``), so 835 reconciliation will likely use
    a small purpose-built model rather than this projector directly.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Final

from pydantic import BaseModel, ConfigDict, Field

from runtime.commercial.claims.exceptions import CostProjectionError
from runtime.commercial.claims.types import X12_837_Claim, X12_837_ClaimLine

# OMOP standardized vocabulary concept IDs ---------------------------------

CURRENCY_CONCEPT_USD: Final[int] = 44818668
"""United States dollar — vocabulary 'Currency', concept_class_id 'Currency'."""

COST_EVENT_FIELD_PROCEDURE_OCCURRENCE: Final[int] = 1147301
"""Standard concept identifying procedure_occurrence as the cost-event anchor."""

COST_EVENT_FIELD_VISIT_OCCURRENCE: Final[int] = 1147300
"""Standard concept identifying visit_occurrence as the cost-event anchor."""

COST_CONCEPT_CHARGED: Final[int] = 31968
"""'Total charged' — billed amount before adjudication."""

COST_CONCEPT_ALLOWED: Final[int] = 31976
"""'Total allowed' — payer-determined allowable; charged minus contractual write-offs."""

COST_CONCEPT_PAID: Final[int] = 31973
"""'Paid by payer' — actual payer disbursement; allowed minus member responsibility."""


class CostRow(BaseModel):
    """One row of OMOP CDM v5.4 ``cost.cost``.

    Mirrors the spec: nullable foreign keys are typed ``int | None``;
    required event/concept anchors are non-nullable. ``frozen=True`` so
    the projector returns immutable rows the caller can safely fan out.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    cost_event_id: int = Field(gt=0)
    cost_event_field_concept_id: int = Field(gt=0)
    cost_concept_id: int = Field(gt=0)
    cost: Decimal
    currency_concept_id: int = Field(gt=0)
    revenue_code_concept_id: int | None = None
    payer_plan_period_id: int | None = None


class CostProjector:
    """Stateless mapper from 837 claim/line objects to ``CostRow`` records."""

    def project_line(
        self,
        line: X12_837_ClaimLine,
        *,
        procedure_occurrence_id: int,
        revenue_code_concept_id: int | None = None,
        payer_plan_period_id: int | None = None,
    ) -> list[CostRow]:
        """Project one claim line's amounts to up to three COST rows.

        Args:
            line: The 837 claim line.
            procedure_occurrence_id: The OMOP ``procedure_occurrence_id``
                row this line was loaded as. Must be > 0; the projector
                does not allocate IDs.
            revenue_code_concept_id: Optional OMOP concept_id for the
                source revenue code (institutional only). Threaded
                through to every emitted row.
            payer_plan_period_id: Optional FK into ``payer_plan_period``;
                populated when member-eligibility data is available
                (not in 837 itself).

        Returns:
            A list of 1-3 ``CostRow`` objects (charged, allowed, paid),
            in that order. ``charged_amount`` is always emitted (the
            field is ``Field(ge=0)`` so it's never NULL); allowed/paid
            are emitted only when non-NULL on the source.
        """
        if procedure_occurrence_id <= 0:
            raise CostProjectionError(
                f"procedure_occurrence_id must be > 0; got {procedure_occurrence_id}"
            )

        rows: list[CostRow] = []
        rows.append(
            self._row(
                cost_event_id=procedure_occurrence_id,
                event_field=COST_EVENT_FIELD_PROCEDURE_OCCURRENCE,
                cost_concept_id=COST_CONCEPT_CHARGED,
                amount=line.charged_amount,
                revenue_code_concept_id=revenue_code_concept_id,
                payer_plan_period_id=payer_plan_period_id,
            )
        )
        if line.allowed_amount is not None:
            rows.append(
                self._row(
                    cost_event_id=procedure_occurrence_id,
                    event_field=COST_EVENT_FIELD_PROCEDURE_OCCURRENCE,
                    cost_concept_id=COST_CONCEPT_ALLOWED,
                    amount=line.allowed_amount,
                    revenue_code_concept_id=revenue_code_concept_id,
                    payer_plan_period_id=payer_plan_period_id,
                )
            )
        if line.paid_amount is not None:
            rows.append(
                self._row(
                    cost_event_id=procedure_occurrence_id,
                    event_field=COST_EVENT_FIELD_PROCEDURE_OCCURRENCE,
                    cost_concept_id=COST_CONCEPT_PAID,
                    amount=line.paid_amount,
                    revenue_code_concept_id=revenue_code_concept_id,
                    payer_plan_period_id=payer_plan_period_id,
                )
            )
        return rows

    def project_claim(
        self,
        claim: X12_837_Claim,
        *,
        visit_occurrence_id: int,
        payer_plan_period_id: int | None = None,
    ) -> list[CostRow]:
        """Project an institutional claim's header totals to visit-level COST rows.

        For 837P (Professional) and 837D (Dental) claims this returns an
        empty list — their COST anchors are exclusively at the procedure
        level. Only 837I (Institutional) claims emit visit-level rows.

        Args:
            claim: The claim header.
            visit_occurrence_id: OMOP ``visit_occurrence_id`` of the
                encounter this claim represents. Must be > 0.
            payer_plan_period_id: Optional FK into ``payer_plan_period``.

        Returns:
            A list of 0-2 ``CostRow`` objects: ``[charged, paid?]``.
            ``allowed`` at the header level requires an 835 reconciliation
            (Plan 2) and is not emitted here.
        """
        if visit_occurrence_id <= 0:
            raise CostProjectionError(f"visit_occurrence_id must be > 0; got {visit_occurrence_id}")
        if claim.claim_type != "I":
            return []

        rows: list[CostRow] = [
            self._row(
                cost_event_id=visit_occurrence_id,
                event_field=COST_EVENT_FIELD_VISIT_OCCURRENCE,
                cost_concept_id=COST_CONCEPT_CHARGED,
                amount=claim.total_charged,
                revenue_code_concept_id=None,
                payer_plan_period_id=payer_plan_period_id,
            )
        ]
        if claim.total_paid is not None:
            rows.append(
                self._row(
                    cost_event_id=visit_occurrence_id,
                    event_field=COST_EVENT_FIELD_VISIT_OCCURRENCE,
                    cost_concept_id=COST_CONCEPT_PAID,
                    amount=claim.total_paid,
                    revenue_code_concept_id=None,
                    payer_plan_period_id=payer_plan_period_id,
                )
            )
        return rows

    @staticmethod
    def _row(
        *,
        cost_event_id: int,
        event_field: int,
        cost_concept_id: int,
        amount: Decimal,
        revenue_code_concept_id: int | None,
        payer_plan_period_id: int | None,
    ) -> CostRow:
        return CostRow(
            cost_event_id=cost_event_id,
            cost_event_field_concept_id=event_field,
            cost_concept_id=cost_concept_id,
            cost=amount,
            currency_concept_id=CURRENCY_CONCEPT_USD,
            revenue_code_concept_id=revenue_code_concept_id,
            payer_plan_period_id=payer_plan_period_id,
        )


__all__ = [
    "COST_CONCEPT_ALLOWED",
    "COST_CONCEPT_CHARGED",
    "COST_CONCEPT_PAID",
    "COST_EVENT_FIELD_PROCEDURE_OCCURRENCE",
    "COST_EVENT_FIELD_VISIT_OCCURRENCE",
    "CURRENCY_CONCEPT_USD",
    "CostProjector",
    "CostRow",
]
