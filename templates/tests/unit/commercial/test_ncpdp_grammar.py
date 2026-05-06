"""Phase 3 Plan 3 Task 1 (T-021C): NCPDP D.0 pyparsing grammar.

NCPDP D.0 Telecom Standard §B.1 (Claim Billing). The grammar covers
only the segments we ingest:

- AM01 — transaction header (BIN, version, transaction code, count)
- AM03 — patient (date of birth, name, gender)
- AM04 — insurance (cardholder ID, group ID)
- AM07 — claim (NDC, days supply, quantity dispensed, prescription #)
- AM11 — pricing (ingredient cost, dispensing fee, patient pay)

Field separator is 0x1C (FS); segment separator is 0x1E (RS). NCPDP
D.0 uses a 2-character field-id prefix on each field rather than
positional parsing, so the grammar matches `<id><value>` pairs.

Tests cover:
- Round-trip parse → segment dicts
- Multi-segment transaction (header + patient + insurance + claim + pricing)
- Reversal transaction (B2 code) → grammar identifies the type
- Malformed input → NCPDPParseError
"""

from __future__ import annotations

import pytest

from runtime.commercial.claims.exceptions import NCPDPParseError
from runtime.commercial.claims.readers.ncpdp_grammar import (
    parse_ncpdp_transaction,
)

# NCPDP D.0 separators (chr() codes — literal 0x1C/0x1E control bytes
# don't survive editor round-trips reliably).
_FS = chr(0x1C)
_RS = chr(0x1E)


def _build_minimal_transaction(*, transaction_code: str = "B1", ndc: str = "00378011305") -> str:
    """Build a parseable NCPDP D.0 fixture using the field-id-prefix encoding."""
    am01 = f"AM01{_FS}A1610001{_FS}A4{transaction_code}{_FS}AAD0"
    am03 = f"AM03{_FS}C419800101{_FS}CYJANE{_FS}CXDOE"
    am04 = f"AM04{_FS}C2MEMBER0001{_FS}CMPLAN0001"
    am07 = f"AM07{_FS}D2RX-1001{_FS}D7{ndc}{_FS}D330{_FS}D560.0{_FS}DJ1"
    am11 = f"AM11{_FS}D915.50{_FS}DC2.50{_FS}F45.00"
    return _RS.join([am01, am03, am04, am07, am11]) + _RS


def test_parse_minimal_transaction() -> None:
    payload = _build_minimal_transaction()
    txn = parse_ncpdp_transaction(payload)

    # Header
    assert txn.header["A1"] == "610001"
    assert txn.header["A4"] == "B1"  # billing
    # Patient
    assert txn.patient["C4"] == "19800101"
    # Insurance
    assert txn.insurance["C2"] == "MEMBER0001"
    # Claim
    assert txn.claim["D7"] == "00378011305"
    assert txn.claim["D3"] == "30"  # days supply
    assert txn.claim["D5"] == "60.0"  # quantity
    # Pricing
    assert txn.pricing["D9"] == "15.50"
    assert txn.pricing["DC"] == "2.50"
    assert txn.pricing["F4"] == "5.00"


def test_parse_reversal_transaction() -> None:
    payload = _build_minimal_transaction(transaction_code="B2")
    txn = parse_ncpdp_transaction(payload)
    assert txn.header["A4"] == "B2"
    assert txn.is_reversal is True


def test_parse_handles_alternate_ndc() -> None:
    payload = _build_minimal_transaction(ndc="00074662303")
    txn = parse_ncpdp_transaction(payload)
    assert txn.claim["D7"] == "00074662303"


def test_parse_rejects_empty_input() -> None:
    with pytest.raises(NCPDPParseError):
        parse_ncpdp_transaction("")


def test_parse_rejects_garbage() -> None:
    with pytest.raises(NCPDPParseError):
        parse_ncpdp_transaction("this is not NCPDP")


def test_parse_returns_transaction_with_all_required_segments() -> None:
    payload = _build_minimal_transaction()
    txn = parse_ncpdp_transaction(payload)
    # All 5 segment dicts populated (no empty header/patient/etc).
    for label, seg in [
        ("header", txn.header),
        ("patient", txn.patient),
        ("insurance", txn.insurance),
        ("claim", txn.claim),
        ("pricing", txn.pricing),
    ]:
        assert seg, f"{label} segment is empty"


def test_parse_rejects_input_without_separators() -> None:
    """Garbage without FS/RS should raise."""
    with pytest.raises(NCPDPParseError):
        parse_ncpdp_transaction("AM01A4B1")  # no separators


def test_parse_rejects_input_missing_header_segment() -> None:
    """Transaction with separators but no AM01 must fail."""
    payload = f"AM03{_FS}C419800101{_RS}"
    with pytest.raises(NCPDPParseError):
        parse_ncpdp_transaction(payload)
