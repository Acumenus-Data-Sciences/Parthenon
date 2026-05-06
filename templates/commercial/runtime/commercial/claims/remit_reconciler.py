"""Reconcile X12 835 remit items against existing COST rows.

Phase 3 Plan 2 Task 3 (T-021B). The reconciler is a pure-Python
algorithm: given a list of ``X12_835_RemitItem`` produced by the 835
reader and the set of existing ``(payer_id, claim_id, line_number)``
keys in the COST table, it produces a ``ReconciliationPlan`` carrying:

- ``updates``: one ``CostUpdate`` per remit that matched an existing
  cost row. The update carries the new ``paid_amount``,
  ``allowed_amount``, ``paid_date``, and the CAS adjustment triples for
  downstream HEOR analysis.
- ``orphans``: one ``OrphanRemit`` per remit that found no matching
  cost row (claim never loaded, payer mismatch, etc.). Each orphan
  also emits a WARNING-level log so operators see drift in real time.
- ``compensations``: empty in Task 3. Task 4 wires reversal handling
  (CLP02 = "22"); reversal items emit a compensating COST row instead
  of mutating the original.

Task 6 (manifest extension) translates the plan into SQL UPDATE +
INSERT statements via ``02f_reconcile_remit.sql``.

The separation between this in-process algorithm and the SQL stage
lets us unit-test the matching/orphan logic without a database.
"""

from __future__ import annotations

import logging
from datetime import date
from decimal import Decimal
from typing import TYPE_CHECKING

from pydantic import BaseModel, ConfigDict, Field

if TYPE_CHECKING:
    from runtime.commercial.claims.types import X12_835_RemitItem


_LOGGER = logging.getLogger(__name__)


class CostMatchKey(BaseModel):
    """Triple that uniquely identifies a cost row for remit reconciliation."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    payer_id: str
    claim_id: str
    line_number: int = Field(ge=1)


class CostUpdate(BaseModel):
    """One UPDATE on an existing COST row driven by an 835 remit."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    match_key: CostMatchKey
    new_paid_amount: Decimal
    new_allowed_amount: Decimal | None = None
    paid_date: date | None = None
    adjustment_codes: list[tuple[str, str, Decimal]] = Field(default_factory=list)


class OrphanRemit(BaseModel):
    """A remit item with no matching claim line in the COST table.

    Task 6's SQL stage inserts these into a ``remit_orphans`` log table
    that downstream operators can use to investigate drift (claim never
    loaded, payer-id mismatch, late remit before claim arrival, etc.).
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    payer_id: str
    claim_id: str
    line_number: int
    procedure_code: str
    paid_amount: Decimal
    paid_date: date | None = None


class CompensationRow(BaseModel):
    """A compensating COST row emitted by Task 4 for reversal remits.

    Reservation in the type system; Task 3 does not populate this. The
    reconciler returns ``compensations=[]`` for non-reversal items.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    match_key: CostMatchKey
    compensation_amount: Decimal


class ReconciliationPlan(BaseModel):
    """Structured output of ``RemitReconciler.reconcile``."""

    model_config = ConfigDict(extra="forbid")

    updates: list[CostUpdate] = Field(default_factory=list)
    orphans: list[OrphanRemit] = Field(default_factory=list)
    compensations: list[CompensationRow] = Field(default_factory=list)


class RemitReconciler:
    """Match X12_835_RemitItem entries against existing COST rows."""

    def reconcile(
        self,
        remit_items: list[X12_835_RemitItem],
        existing_keys: set[tuple[str, str, int]],
    ) -> ReconciliationPlan:
        """Build a reconciliation plan.

        Args:
            remit_items: Items from the 835 reader.
            existing_keys: ``(payer_id, claim_id, line_number)`` triples
                already present in the COST table.

        Returns:
            A ``ReconciliationPlan`` carrying the matched updates and
            unmatched orphans. Task 4 will populate ``compensations``
            for reversal items.
        """
        plan = ReconciliationPlan()
        for item in remit_items:
            key = CostMatchKey(
                payer_id=item.payer_id,
                claim_id=item.claim_id,
                line_number=item.line_number,
            )
            triple = (item.payer_id, item.claim_id, item.line_number)
            if triple in existing_keys:
                plan.updates.append(
                    CostUpdate(
                        match_key=key,
                        new_paid_amount=item.paid_amount,
                        new_allowed_amount=item.allowed_amount,
                        paid_date=item.paid_date,
                        adjustment_codes=list(item.adjustment_codes),
                    )
                )
            else:
                plan.orphans.append(
                    OrphanRemit(
                        payer_id=item.payer_id,
                        claim_id=item.claim_id,
                        line_number=item.line_number,
                        procedure_code=item.procedure_code,
                        paid_amount=item.paid_amount,
                        paid_date=item.paid_date,
                    )
                )
                _LOGGER.warning(
                    "Orphan remit: no matching cost row for payer/claim/line",
                )
        return plan
