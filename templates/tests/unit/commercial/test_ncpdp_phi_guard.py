"""Phase 3 Plan 3 Task 9 (T-021C): HIGHSEC §7 PHI guard for NCPDPReader.

Asserts that the reader's ``_RedactingFilter`` scrubs cardholder IDs,
NPIs, member IDs, and CCYYMMDD dates from any log records emitted
under the reader's logger namespace.

Mirrors Plan 1's PHI guard test for the X12 837 reader. The filter is
broad by design — false positives in log output are acceptable; false
negatives violate HIGHSEC §7 and are not.
"""

from __future__ import annotations

import io
import logging

from runtime.commercial.claims.readers.ncpdp_grammar import FS, RS
from runtime.commercial.claims.readers.ncpdp_reader import NCPDPReader

# Real-shape PHI tokens we test redaction for.
_TEST_NPI = "1234567893"
_TEST_CARDHOLDER = "MEMBER0001"
_TEST_DOB = "19800101"


def _build_payload() -> str:
    am01 = f"AM01{FS}A1610001{FS}A3PCN001{FS}A4B1{FS}N2{_TEST_NPI}"
    am03 = f"AM03{FS}C4{_TEST_DOB}{FS}CYJANE{FS}CXDOE"
    am04 = f"AM04{FS}C2{_TEST_CARDHOLDER}{FS}CMPLAN0001"
    am07 = f"AM07{FS}D2RX-1001{FS}D700378011305{FS}D330{FS}D560.0{FS}DJ1"
    am11 = f"AM11{FS}D915.50{FS}DC2.50{FS}F45.00"
    return RS.join([am01, am03, am04, am07, am11]) + RS


def test_phi_filter_redacts_cardholder_id_from_log_messages() -> None:
    """Direct test: emit a log record carrying the cardholder_id and
    confirm the filter scrubs it before the record reaches handlers."""
    logger = logging.getLogger("runtime.commercial.claims.readers.ncpdp_reader")
    NCPDPReader()  # attaches the redaction filter

    # Capture the formatted record after filters run.
    buf = io.StringIO()
    handler = logging.StreamHandler(buf)
    handler.setFormatter(logging.Formatter("%(message)s"))
    logger.addHandler(handler)
    try:
        logger.warning("processing claim for cardholder %s", _TEST_CARDHOLDER)
        # Also exercise the literal-only path.
        logger.warning(f"NPI={_TEST_NPI} reported anomaly")
        logger.warning(f"DOB={_TEST_DOB} cardholder={_TEST_CARDHOLDER}")
    finally:
        logger.removeHandler(handler)

    output = buf.getvalue()
    # The literal token MUST NOT appear anywhere in captured log output.
    assert _TEST_CARDHOLDER not in output, "cardholder_id leaked to logs"
    assert _TEST_NPI not in output, "NPI leaked to logs"
    assert _TEST_DOB not in output, "DOB leaked to logs"
    # The redaction marker should appear (sanity — confirms filter ran).
    assert "***REDACTED***" in output


def test_phi_filter_idempotent_attachment() -> None:
    """Repeated NCPDPReader() construction must not stack multiple
    filters on the same logger."""
    logger = logging.getLogger("runtime.commercial.claims.readers.ncpdp_reader")
    pre_count = len(logger.filters)
    NCPDPReader()
    NCPDPReader()
    NCPDPReader()
    assert len(logger.filters) - pre_count <= 1


def test_reader_does_not_emit_phi_to_logger_during_parse() -> None:
    """Even when the reader parses successfully, the logger must not
    have leaked PHI into any record's formatted message."""
    logger = logging.getLogger("runtime.commercial.claims.readers.ncpdp_reader")
    buf = io.StringIO()
    handler = logging.StreamHandler(buf)
    handler.setFormatter(logging.Formatter("%(levelname)s %(message)s"))
    logger.addHandler(handler)
    logger.setLevel(logging.DEBUG)
    try:
        reader = NCPDPReader()
        claim = reader.read(_build_payload())
        assert claim.cardholder_id == _TEST_CARDHOLDER
    finally:
        logger.removeHandler(handler)

    output = buf.getvalue()
    assert _TEST_CARDHOLDER not in output
    assert _TEST_NPI not in output
    assert _TEST_DOB not in output
