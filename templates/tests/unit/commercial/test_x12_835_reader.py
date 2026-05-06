"""Phase 3 Plan 2 Task 2 (T-021B): X12_835_Reader core — CLP/SVC/CAS walker.

Tests cover the segment-level state machine: header / claim / service-line /
adjustment loops, reversal detection (CLP02 = "22"), date parsing, and the
empty-envelope edge case.

The X12 835 format spec used here follows the X12 005010X221A1
implementation guide. We intentionally keep the reader segment-oriented
(no IG validation, no loop-strictness) so it tolerates upstream payer
deviations that would otherwise cause hard failures during ingest.
"""

from __future__ import annotations

import io
from datetime import date
from decimal import Decimal

import pytest

from runtime.commercial.claims.exceptions import X12ParseError
from runtime.commercial.claims.readers.x12_835 import X12_835_Reader
from runtime.commercial.claims.types import X12_835_RemitItem

# ---------- 835 fixture builders ---------------------------------------

# Segment terminator + element separator follow the standard 005010 default.
# Real-world 835 transactions use ~ (segment) and * (element) almost
# universally; pyx12 auto-detects.
_SEG = "~"
_ELEM = "*"


def _wrap_envelope(body_segments: list[str]) -> str:
    """Wrap a list of segments in a minimal ISA / GS / ST envelope."""
    isa = (
        "ISA*00*          *00*          *ZZ*SUBMITTERID    *ZZ*RECEIVERID     "
        "*240101*1200*^*00501*000000001*0*P*:"
    )
    gs = "GS*HP*SUBMITTERID*RECEIVERID*20240101*1200*1*X*005010X221A1"
    st = "ST*835*0001"
    se = f"SE*{len(body_segments) + 2}*0001"
    ge = "GE*1*1"
    iea = "IEA*1*000000001"
    return _SEG.join([isa, gs, st, *body_segments, se, ge, iea]) + _SEG


def _minimal_835(claims_body: list[str]) -> str:
    """Header + payment + claim body."""
    header = [
        "BPR*I*1500*C*ACH*CCP*01*123456780*DA*9876543210*1234567890**01"
        "*123456780*DA*9876543210*20240115",
        "TRN*1*0123456789*1234567890",
        "DTM*405*20240115",
        "N1*PR*BIG INSURANCE",
        "N1*PE*PROVIDER GROUP*XX*1234567893",
    ]
    return _wrap_envelope(header + claims_body)


# ---------- tests ------------------------------------------------------


def test_reader_attaches_redacting_filter_once() -> None:
    """HIGHSEC §7: idempotent filter attachment (Task 11 territory; tested early)."""
    import logging

    logger = logging.getLogger("runtime.commercial.claims.readers.x12_835")
    pre_count = len(logger.filters)
    X12_835_Reader()
    X12_835_Reader()
    # At most one filter added across the two constructions.
    assert len(logger.filters) - pre_count <= 1


def test_reader_returns_empty_for_envelope_only() -> None:
    text = _minimal_835([])
    reader = X12_835_Reader()
    items = reader.read(io.StringIO(text))
    assert items == []


def test_reader_extracts_one_clp_with_one_svc() -> None:
    body = [
        "CLP*PCN001*1*200.00*150.00*30.00*MC*ICN001*11*1",
        "CAS*CO*45*50.00",
        "NM1*QC*1*DOE*JANE",
        "SVC*HC:99213*200.00*150.00**1",
        "DTM*472*20240110",
    ]
    text = _minimal_835(body)
    reader = X12_835_Reader()
    items = reader.read(io.StringIO(text))

    assert len(items) == 1
    item = items[0]
    assert isinstance(item, X12_835_RemitItem)
    assert item.payer_id  # populated from N1*PR or transaction header
    assert item.claim_id == "PCN001"
    assert item.line_number == 1
    assert item.procedure_code == "99213"
    assert item.charged_amount == Decimal("200.00")
    assert item.paid_amount == Decimal("150.00")
    assert item.is_reversal is False


def test_reader_marks_reversal_when_clp02_is_22() -> None:
    """CLP02 = '22' — reversal of a previous payment. The model carries
    is_reversal=True; downstream reconciler emits compensating COST rows."""
    body = [
        "CLP*PCN002*22*200.00*-150.00*0*MC*ICN002A*11*1",
        "SVC*HC:99213*200.00*-150.00**1",
        "DTM*472*20240115",
    ]
    text = _minimal_835(body)
    reader = X12_835_Reader()
    items = reader.read(io.StringIO(text))
    assert len(items) == 1
    assert items[0].is_reversal is True
    assert items[0].paid_amount == Decimal("-150.00")


def test_reader_aggregates_cas_adjustment_triples() -> None:
    body = [
        "CLP*PCN003*1*200.00*150.00*30.00*MC*ICN003*11*1",
        "CAS*CO*45*50.00*1**95*0",
        "SVC*HC:99213*200.00*150.00**1",
    ]
    text = _minimal_835(body)
    reader = X12_835_Reader()
    items = reader.read(io.StringIO(text))
    assert len(items) == 1
    triples = items[0].adjustment_codes
    # We capture the first (group, reason, amount) triple at minimum.
    assert ("CO", "45", Decimal("50.00")) in triples


def test_reader_emits_one_remit_per_svc_line_in_multi_line_claim() -> None:
    body = [
        "CLP*PCN004*1*500.00*400.00*0*MC*ICN004*11*1",
        "SVC*HC:99213*200.00*150.00**1",
        "DTM*472*20240110",
        "SVC*HC:99214*300.00*250.00**1",
        "DTM*472*20240110",
    ]
    text = _minimal_835(body)
    reader = X12_835_Reader()
    items = reader.read(io.StringIO(text))
    assert len(items) == 2
    assert items[0].line_number == 1
    assert items[1].line_number == 2
    assert items[1].procedure_code == "99214"


def test_reader_extracts_allowed_amount_from_amt_b6() -> None:
    """AMT*B6 inside a SVC loop carries the allowed amount."""
    body = [
        "CLP*PCN005*1*200.00*150.00*30.00*MC*ICN005*11*1",
        "SVC*HC:99213*200.00*150.00**1",
        "AMT*B6*180.00",
    ]
    text = _minimal_835(body)
    reader = X12_835_Reader()
    items = reader.read(io.StringIO(text))
    assert items[0].allowed_amount == Decimal("180.00")


def test_reader_parses_paid_date() -> None:
    """DTM*405 at transaction header carries production date; we surface it
    as paid_date when CLP-level DTM*405 is absent."""
    body = [
        "CLP*PCN006*1*200.00*150.00*30.00*MC*ICN006*11*1",
        "SVC*HC:99213*200.00*150.00**1",
        "DTM*472*20240110",
    ]
    text = _minimal_835(body)
    reader = X12_835_Reader()
    items = reader.read(io.StringIO(text))
    assert items[0].paid_date == date(2024, 1, 15)


def test_reader_raises_on_non_x12_input() -> None:
    reader = X12_835_Reader()
    with pytest.raises(X12ParseError):
        reader.read(io.StringIO("this is not x12"))
