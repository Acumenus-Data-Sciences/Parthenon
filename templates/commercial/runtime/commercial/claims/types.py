"""Typed Pydantic models for the X12 837 P/I/D claim domain.

Phase 3 Plan 1 Task 3 (T-021A). Two frozen Pydantic models with
``extra="forbid"``:

- ``X12_837_Claim``: one per CLM-rooted loop in the 837 transaction.
- ``X12_837_ClaimLine``: one per SV1/SV2/SV3 (P / I / D) service line loop.

Naming follows the plan's convention (``X12_837_Claim`` with underscores
to mirror the X12 transaction set identifier). All ID fields are
PHI-adjacent — see HIGHSEC §7 — and the reader's logger MUST never emit
their values.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

ClaimType = Literal["P", "I", "D"]
"""Professional / Institutional / Dental — the three 837 transaction flavors."""


class X12_837_Claim(BaseModel):
    """Header-level fields from one CLM loop in an 837 transaction."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    claim_id: str = Field(min_length=1)
    payer_id: str
    submitter_id: str
    receiver_id: str
    subscriber_id: str
    patient_id: str  # de-identified or hashed; HIGHSEC §7
    claim_type: ClaimType
    statement_date: date
    total_charged: Decimal = Field(ge=0)
    total_paid: Decimal | None = None
    diagnosis_codes: list[str] = Field(default_factory=list)  # ICD-10
    place_of_service: str | None = None


class X12_837_ClaimLine(BaseModel):
    """One service-line loop (SV1 for 837P, SV2 for 837I, SV3 for 837D)."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    claim_id: str = Field(min_length=1)
    line_number: int = Field(ge=1)
    procedure_code: str = Field(min_length=1)  # CPT/HCPCS
    procedure_modifiers: list[str] = Field(default_factory=list)
    service_date_from: date
    service_date_to: date
    units: Decimal = Field(ge=0)
    charged_amount: Decimal = Field(ge=0)
    allowed_amount: Decimal | None = None
    paid_amount: Decimal | None = None
    diagnosis_pointers: list[int] = Field(default_factory=list)


class X12_835_RemitItem(BaseModel):
    """One reconciled service-line / claim-payment row from an 835 remit.

    Phase 3 Plan 2 Task 1 (T-021B). One ``X12_835_RemitItem`` per
    ``CLP/SVC`` loop pair walked by ``X12_835_Reader``. The model is
    deliberately narrow — it carries only the fields the reconciler needs
    to UPDATE the cost rows Plan 1 inserted (joined via
    ``(payer_id, claim_id, line_number)``).

    Reversals (CLP02 = "22") flip the sign on monetary amounts and set
    ``is_reversal=True``; the reconciler emits a compensating COST row
    rather than mutating the original (see ADR 0016 §"Remit
    reconciliation"). All amounts are signed Decimals — the model does
    NOT enforce ``ge=0`` because reversals legitimately carry negative
    paid / allowed amounts.

    PHI handling (HIGHSEC §7): ``payer_id`` and ``claim_id`` are
    PHI-adjacent identifiers. The 835 reader's logger MUST never emit
    them — see ``X12_835_Reader`` for the redaction filter.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    payer_id: str
    claim_id: str  # CLP01 — joins onto Plan 1's claim_id
    line_number: int = Field(ge=1)
    procedure_code: str
    charged_amount: Decimal
    paid_amount: Decimal
    allowed_amount: Decimal
    # CAS group / reason / amount triples (Group code, Reason code, Amount).
    # See WPC https://x12.org/codes/claim-adjustment-reason-codes for the
    # canonical Reason code list. The reconciler aggregates these into the
    # COST row's ``cost_source_value`` for downstream HEOR analysis.
    adjustment_codes: list[tuple[str, str, Decimal]] = Field(default_factory=list)
    is_reversal: bool = False
    paid_date: date | None = None


class NCPDPClaim(BaseModel):
    """One NCPDP D.0 pharmacy-claim transaction.

    Phase 3 Plan 3 Task 2 (T-021C). Materialized by NCPDPReader from
    the grammar layer's ``NCPDPTransaction``. Fields cover the
    canonical NCPDP D.0 §B.1 set we ingest: BIN/PCN routing,
    cardholder demo, NDC product code, days supply / quantity,
    and pricing breakdown.

    Reversals: NCPDP D.0 transaction code B2 carries the SAME monetary
    amounts as the original B1 — the spec doesn't sign-encode the
    amounts on the reversal. ``is_reversal=True`` is the sole indicator;
    the SQL layer emits compensating DRUG_EXPOSURE rows with negated
    quantity and negated COST.

    HIGHSEC §7: ``cardholder_id`` (NCPDP field C2) and
    ``date_of_service`` are PHI-adjacent. The reader's logger filter
    scrubs them; this model just carries them — callers must not echo
    to logs.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    transaction_code: Literal["B1", "B2", "B3"]  # Billing / Reversal / Rebill
    bin_number: str = Field(min_length=1)  # NCPDP A1 — payer routing BIN
    processor_control_number: str = Field(min_length=1)  # NCPDP AAD0 (PCN)
    pharmacy_npi: str = Field(min_length=10, max_length=10)  # 10-digit NPI
    cardholder_id: str  # de-identified or hashed in production; HIGHSEC §7
    date_of_service: date
    ndc_code: str = Field(min_length=11, max_length=11)  # 11-digit NCPDP product ID
    days_supply: int = Field(ge=0)
    quantity_dispensed: Decimal = Field(ge=0)
    ingredient_cost: Decimal = Field(ge=0)
    dispensing_fee: Decimal = Field(ge=0)
    patient_paid_amount: Decimal = Field(ge=0)
    is_reversal: bool = False


__all__ = [
    "ClaimType",
    "NCPDPClaim",
    "X12_835_RemitItem",
    "X12_837_Claim",
    "X12_837_ClaimLine",
]
