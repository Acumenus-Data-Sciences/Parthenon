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


__all__ = ["ClaimType", "X12_837_Claim", "X12_837_ClaimLine"]
