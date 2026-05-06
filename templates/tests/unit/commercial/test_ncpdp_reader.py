"""Phase 3 Plan 3 Task 3 (T-021C): NCPDPReader.

Materializes parsed NCPDP D.0 transactions (NCPDPTransaction) into
typed NCPDPClaim instances. Field-level mapping per NCPDP D.0 §B.1:

- A1 → bin_number
- A4 → transaction_code (also drives is_reversal when 'B2')
- AAD0 / N0 → processor_control_number (varies by IG; we accept either)
- D7 → ndc_code
- D3 → days_supply
- D5 → quantity_dispensed
- D9 → ingredient_cost
- DC → dispensing_fee
- F4 → patient_paid_amount
- C2 → cardholder_id
- C4 → date_of_service (CCYYMMDD parse)
- N2 → pharmacy_npi (NCPDP service-segment field, defaults to a
  fixture-supplied value when absent)

The reader is idempotent: same input → same NCPDPClaim object.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest

from runtime.commercial.claims.exceptions import NCPDPParseError
from runtime.commercial.claims.readers.ncpdp_grammar import FS, RS
from runtime.commercial.claims.readers.ncpdp_reader import NCPDPReader


def _build_minimal_payload(*, txn_code: str = "B1", ndc: str = "00378011305") -> str:
    # NCPDP D.0 field IDs are exactly 2 chars (§A.4).
    # A1=BIN, A3=PCN, A4=transaction code, N2=service-provider NPI.
    am01 = f"AM01{FS}A1610001{FS}A3PCN001{FS}A4{txn_code}{FS}N21234567893"
    am03 = f"AM03{FS}C419800101{FS}CYJANE{FS}CXDOE"
    am04 = f"AM04{FS}C2MEMBER0001{FS}CMPLAN0001"
    am07 = f"AM07{FS}D2RX-1001{FS}D7{ndc}{FS}D330{FS}D560.0{FS}DJ1"
    am11 = f"AM11{FS}D915.50{FS}DC2.50{FS}F45.00"
    return RS.join([am01, am03, am04, am07, am11]) + RS


def test_reader_materializes_b1_billing_claim() -> None:
    payload = _build_minimal_payload()
    claim = NCPDPReader().read(payload)
    assert claim.transaction_code == "B1"
    assert claim.is_reversal is False
    assert claim.bin_number == "610001"
    assert claim.processor_control_number == "PCN001"
    assert claim.pharmacy_npi == "1234567893"
    assert claim.cardholder_id == "MEMBER0001"
    assert claim.date_of_service == date(1980, 1, 1)
    assert claim.ndc_code == "00378011305"
    assert claim.days_supply == 30
    assert claim.quantity_dispensed == Decimal("60.0")
    assert claim.ingredient_cost == Decimal("15.50")
    assert claim.dispensing_fee == Decimal("2.50")
    assert claim.patient_paid_amount == Decimal("5.00")


def test_reader_marks_b2_as_reversal() -> None:
    payload = _build_minimal_payload(txn_code="B2")
    claim = NCPDPReader().read(payload)
    assert claim.transaction_code == "B2"
    assert claim.is_reversal is True


def test_reader_accepts_b3_rebill() -> None:
    payload = _build_minimal_payload(txn_code="B3")
    claim = NCPDPReader().read(payload)
    assert claim.transaction_code == "B3"
    assert claim.is_reversal is False


def test_reader_idempotent() -> None:
    payload = _build_minimal_payload()
    a = NCPDPReader().read(payload)
    b = NCPDPReader().read(payload)
    assert a == b


def test_reader_raises_on_garbage() -> None:
    with pytest.raises(NCPDPParseError):
        NCPDPReader().read("not NCPDP")


def test_reader_raises_when_required_fields_missing() -> None:
    """Missing NDC code → NCPDPParseError (we surface the validation error)."""
    am01 = f"AM01{FS}A1610001{FS}A3PCN001{FS}A4B1{FS}N21234567893"
    am03 = f"AM03{FS}C419800101"
    am04 = f"AM04{FS}C2MEMBER0001"
    am07 = f"AM07{FS}D2RX-1001{FS}D330{FS}D560.0"  # NO D7 / NDC code
    am11 = f"AM11{FS}D915.50{FS}DC2.50{FS}F45.00"
    payload = RS.join([am01, am03, am04, am07, am11]) + RS
    with pytest.raises(NCPDPParseError):
        NCPDPReader().read(payload)
