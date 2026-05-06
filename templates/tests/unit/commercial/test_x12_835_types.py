"""Phase 3 Plan 2 Task 1: typed 835 remit model rejects malformed input.

Asserts the contract:
- ``extra="forbid"`` — unknown fields raise ValidationError.
- ``frozen=True`` — instances are immutable.
- ``line_number`` must be ``>= 1``.
- ``is_reversal`` defaults to ``False`` and toggles cleanly.
- ``adjustment_codes`` accepts a list of ``(group, reason, amount)`` tuples
  (Decimal amounts) and defaults to the empty list.
- ``paid_date`` is optional (defaults to ``None``).
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from runtime.commercial.claims.types import X12_835_RemitItem


def _remit_kwargs() -> dict[str, object]:
    return {
        "payer_id": "PAYERID",
        "claim_id": "CLAIM-1",
        "line_number": 1,
        "procedure_code": "99213",
        "charged_amount": Decimal("125.00"),
        "paid_amount": Decimal("80.00"),
        "allowed_amount": Decimal("100.00"),
    }


class TestX12_835_RemitItem:
    def test_minimal_remit_validates(self) -> None:
        item = X12_835_RemitItem(**_remit_kwargs())
        assert item.claim_id == "CLAIM-1"
        assert item.line_number == 1
        assert item.charged_amount == Decimal("125.00")
        assert item.paid_amount == Decimal("80.00")
        assert item.allowed_amount == Decimal("100.00")
        assert item.adjustment_codes == []
        assert item.is_reversal is False
        assert item.paid_date is None

    def test_extra_fields_forbidden(self) -> None:
        kwargs = _remit_kwargs()
        kwargs["unknown_field"] = "leak"
        with pytest.raises(ValidationError, match="unknown_field"):
            X12_835_RemitItem(**kwargs)

    def test_frozen_instance(self) -> None:
        item = X12_835_RemitItem(**_remit_kwargs())
        with pytest.raises(ValidationError):
            item.paid_amount = Decimal("9999.00")  # type: ignore[misc]

    def test_line_number_must_be_positive(self) -> None:
        kwargs = _remit_kwargs()
        kwargs["line_number"] = 0
        with pytest.raises(ValidationError, match="line_number"):
            X12_835_RemitItem(**kwargs)

    def test_reversal_toggle(self) -> None:
        kwargs = _remit_kwargs()
        kwargs["is_reversal"] = True
        kwargs["paid_amount"] = Decimal("-80.00")
        kwargs["allowed_amount"] = Decimal("-100.00")
        item = X12_835_RemitItem(**kwargs)
        assert item.is_reversal is True
        assert item.paid_amount == Decimal("-80.00")

    def test_adjustment_codes_tuples(self) -> None:
        kwargs = _remit_kwargs()
        kwargs["adjustment_codes"] = [
            ("CO", "45", Decimal("25.00")),
            ("PR", "1", Decimal("20.00")),
        ]
        item = X12_835_RemitItem(**kwargs)
        assert len(item.adjustment_codes) == 2
        group, reason, amount = item.adjustment_codes[0]
        assert group == "CO"
        assert reason == "45"
        assert amount == Decimal("25.00")

    def test_paid_date_accepts_iso_string(self) -> None:
        kwargs = _remit_kwargs()
        kwargs["paid_date"] = date(2026, 2, 1)
        item = X12_835_RemitItem(**kwargs)
        assert item.paid_date == date(2026, 2, 1)
