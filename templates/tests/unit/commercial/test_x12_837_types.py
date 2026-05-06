"""Phase 3 Plan 1 Task 3: typed claim models reject malformed input.

Asserts the contract:
- ``extra="forbid"`` — unknown fields raise ValidationError.
- ``frozen=True`` — instances are immutable.
- Decimal field constraints (``ge=0``) fire on negative amounts.
- Enum-style ``claim_type`` only accepts P / I / D.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from runtime.commercial.claims.types import X12_837_Claim, X12_837_ClaimLine


def _claim_kwargs() -> dict[str, object]:
    return {
        "claim_id": "CLM-001",
        "payer_id": "PAYER-001",
        "submitter_id": "SUB-001",
        "receiver_id": "RCV-001",
        "subscriber_id": "MEMBER-XYZ",
        "patient_id": "PAT-HASH-9F",
        "claim_type": "P",
        "statement_date": date(2026, 1, 15),
        "total_charged": Decimal("250.00"),
    }


def _line_kwargs() -> dict[str, object]:
    return {
        "claim_id": "CLM-001",
        "line_number": 1,
        "procedure_code": "99213",
        "service_date_from": date(2026, 1, 10),
        "service_date_to": date(2026, 1, 10),
        "units": Decimal("1"),
        "charged_amount": Decimal("125.00"),
    }


class TestX12_837_Claim:
    def test_minimal_claim_validates(self) -> None:
        claim = X12_837_Claim(**_claim_kwargs())
        assert claim.claim_id == "CLM-001"
        assert claim.claim_type == "P"
        assert claim.total_charged == Decimal("250.00")
        assert claim.diagnosis_codes == []

    def test_extra_fields_forbidden(self) -> None:
        kwargs = _claim_kwargs()
        kwargs["unknown_field"] = "leak"
        with pytest.raises(ValidationError, match="unknown_field"):
            X12_837_Claim(**kwargs)

    def test_frozen_instance(self) -> None:
        claim = X12_837_Claim(**_claim_kwargs())
        with pytest.raises(ValidationError):
            claim.claim_id = "CLM-002"  # type: ignore[misc]

    def test_invalid_claim_type_rejected(self) -> None:
        kwargs = _claim_kwargs()
        kwargs["claim_type"] = "X"  # not one of P / I / D
        with pytest.raises(ValidationError, match="claim_type"):
            X12_837_Claim(**kwargs)

    def test_negative_total_charged_rejected(self) -> None:
        kwargs = _claim_kwargs()
        kwargs["total_charged"] = Decimal("-1.00")
        with pytest.raises(ValidationError):
            X12_837_Claim(**kwargs)

    def test_empty_claim_id_rejected(self) -> None:
        kwargs = _claim_kwargs()
        kwargs["claim_id"] = ""
        with pytest.raises(ValidationError):
            X12_837_Claim(**kwargs)


class TestX12_837_ClaimLine:
    def test_minimal_line_validates(self) -> None:
        line = X12_837_ClaimLine(**_line_kwargs())
        assert line.line_number == 1
        assert line.procedure_code == "99213"
        assert line.procedure_modifiers == []
        assert line.allowed_amount is None
        assert line.paid_amount is None

    def test_extra_fields_forbidden(self) -> None:
        kwargs = _line_kwargs()
        kwargs["icd_codes"] = ["A00.0"]  # not on the model
        with pytest.raises(ValidationError, match="icd_codes"):
            X12_837_ClaimLine(**kwargs)

    def test_frozen_instance(self) -> None:
        line = X12_837_ClaimLine(**_line_kwargs())
        with pytest.raises(ValidationError):
            line.charged_amount = Decimal("9999.00")  # type: ignore[misc]

    def test_line_number_must_be_positive(self) -> None:
        kwargs = _line_kwargs()
        kwargs["line_number"] = 0
        with pytest.raises(ValidationError, match="line_number"):
            X12_837_ClaimLine(**kwargs)

    def test_negative_units_rejected(self) -> None:
        kwargs = _line_kwargs()
        kwargs["units"] = Decimal("-1")
        with pytest.raises(ValidationError):
            X12_837_ClaimLine(**kwargs)

    def test_negative_charged_amount_rejected(self) -> None:
        kwargs = _line_kwargs()
        kwargs["charged_amount"] = Decimal("-0.01")
        with pytest.raises(ValidationError):
            X12_837_ClaimLine(**kwargs)

    def test_empty_procedure_code_rejected(self) -> None:
        kwargs = _line_kwargs()
        kwargs["procedure_code"] = ""
        with pytest.raises(ValidationError):
            X12_837_ClaimLine(**kwargs)
