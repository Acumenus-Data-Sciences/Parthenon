"""Phase 3 Plan 3 Task 2 (T-021C): NCPDPClaim typed Pydantic model.

The model is the runtime-typed projection of NCPDPTransaction (the
grammar layer) — frozen, extra="forbid", with field constraints that
enforce NCPDP D.0 invariants:

- transaction_code is one of {B1, B2, B3} (Billing / Reversal / Rebill)
- date_of_service is a valid ``date``
- ndc_code is the 11-digit NCPDP product ID
- days_supply >= 0
- quantity_dispensed >= 0
- monetary fields >= 0 (NCPDP D.0 doesn't sign-encode reversal amounts;
  the reversal flag is the sole indicator and the SQL layer flips signs)
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from runtime.commercial.claims.types import NCPDPClaim


def _kwargs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "transaction_code": "B1",
        "bin_number": "610001",
        "processor_control_number": "AAD0",
        "pharmacy_npi": "1234567893",
        "cardholder_id": "MEMBER0001",
        "date_of_service": date(2024, 1, 15),
        "ndc_code": "00378011305",
        "days_supply": 30,
        "quantity_dispensed": Decimal("60.0"),
        "ingredient_cost": Decimal("15.50"),
        "dispensing_fee": Decimal("2.50"),
        "patient_paid_amount": Decimal("5.00"),
        "is_reversal": False,
    }
    base.update(overrides)
    return base


def test_constructs_from_minimal_fields() -> None:
    claim = NCPDPClaim(**_kwargs())
    assert claim.transaction_code == "B1"
    assert claim.ndc_code == "00378011305"
    assert claim.days_supply == 30
    assert claim.is_reversal is False


def test_extra_fields_rejected() -> None:
    with pytest.raises(ValidationError):
        NCPDPClaim(**_kwargs(unexpected_field="oops"))


def test_frozen_after_construction() -> None:
    claim = NCPDPClaim(**_kwargs())
    with pytest.raises(ValidationError):
        claim.days_supply = 60  # type: ignore[misc]


def test_negative_days_supply_rejected() -> None:
    with pytest.raises(ValidationError):
        NCPDPClaim(**_kwargs(days_supply=-1))


def test_negative_quantity_rejected() -> None:
    with pytest.raises(ValidationError):
        NCPDPClaim(**_kwargs(quantity_dispensed=Decimal("-1.0")))


def test_negative_cost_rejected() -> None:
    with pytest.raises(ValidationError):
        NCPDPClaim(**_kwargs(ingredient_cost=Decimal("-0.01")))


def test_unknown_transaction_code_rejected() -> None:
    with pytest.raises(ValidationError):
        NCPDPClaim(**_kwargs(transaction_code="XX"))


def test_b2_reversal_construct_with_is_reversal_flag() -> None:
    """The model carries the reversal flag distinctly from the txn code.

    NCPDP D.0 transaction code B2 = reversal. The reader (Task 3) sets
    is_reversal=True alongside transaction_code='B2' for explicit
    downstream handling in the SQL stage.
    """
    claim = NCPDPClaim(**_kwargs(transaction_code="B2", is_reversal=True))
    assert claim.is_reversal is True
    assert claim.transaction_code == "B2"


def test_zero_amounts_allowed() -> None:
    """Some legitimate claims (samples, $0 copay) carry zero amounts."""
    claim = NCPDPClaim(
        **_kwargs(
            ingredient_cost=Decimal("0"),
            dispensing_fee=Decimal("0"),
            patient_paid_amount=Decimal("0"),
        )
    )
    assert claim.ingredient_cost == Decimal("0")
