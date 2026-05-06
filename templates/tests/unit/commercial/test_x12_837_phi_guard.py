"""Phase 3 Plan 1 Task 11: HIGHSEC §7 PHI guard for the X12 837 reader.

Per HIGHSEC §7 (Parthenon /home/smudoshi/Github/Parthenon/.claude/rules/HIGHSEC.spec.md),
provider NPIs (NM109 in NM1*82 / NM1*85 segments) and patient subscriber
IDs (NM109 in NM1*IL / NM1*QC segments) are PHI-adjacent. The reader's
``_RedactingFilter`` (see ``runtime.commercial.claims.readers.x12_837``)
attaches to the module logger and scrubs these tokens from log records
before they reach any handler.

This test:

1. Captures stderr + a memory log handler attached to the x12_837 logger.
2. Drives the reader through a parse that emits log records mentioning
   the known test NPI (``1234567893``) and member ID (``MEMBER01``).
3. Asserts neither identifier appears in the captured output.

Failure modes this regression catches:

- A future refactor removes ``addFilter()`` from the reader's
  ``__init__`` (filter is silently no-op'd).
- A future log call uses ``%s`` placeholders bypassing ``getMessage()`` —
  the filter has to be defensive about ``record.args``.
- A new code path (e.g., the 835 reader Plan 2 wires up) reuses the
  same logger but doesn't attach the filter — adjacent failure mode.
"""

from __future__ import annotations

import io
import logging
import re
from contextlib import redirect_stderr

from runtime.commercial.claims.readers.x12_837 import X12_837_Reader

# A representative 837 transaction containing the public CMS test NPI
# 1234567893 (NM1*85, rendering provider) and member ID MEMBER01
# (NM1*IL, subscriber). The reader will parse this and may log diagnostic
# messages mentioning the segment values.
_SAMPLE_WITH_PHI_TOKENS = (
    "ISA*00*          *00*          *ZZ*SUBMITTERID    *ZZ*RECEIVERID     "
    "*260101*1200*^*00501*000000001*0*P*:~"
    "GS*HC*SUBMITTERID*RECEIVERID*20260101*1200*1*X*005010X222A1~"
    "ST*837*0001*005010X222A1~"
    "BHT*0019*00*0123*20260101*1200*CH~"
    "NM1*41*2*ACME CLINIC*****46*SUBID~"
    "NM1*40*2*PAYER NAME*****46*PAYERID~"
    "NM1*85*2*PROVIDER ORG*****XX*1234567893~"
    "NM1*IL*1*DOE*JOHN****MI*MEMBER01~"
    "NM1*PR*2*PAYER NAME*****PI*PAYERID~"
    "CLM*CLAIM-1*250.00***11:B:1*Y*A*Y*Y~"
    "DTP*434*D8*20260115~"
    "HI*ABK:R51~"
    "LX*1~"
    "SV1*HC:99213*125.00*UN*1***1~"
    "DTP*472*D8*20260110~"
    "SE*16*0001~"
    "GE*1*1~"
    "IEA*1*000000001~"
)

_KNOWN_NPI = "1234567893"
_KNOWN_MEMBER_ID = "MEMBER01"


def _emit_logged_parse(payload: str) -> tuple[str, list[str]]:
    """Parse ``payload``, capturing stderr + every record on the reader's logger.

    Returns ``(stderr_text, [record.getMessage() for record in handler])``.
    The handler is attached AFTER ``X12_837_Reader.__init__`` (so the
    redaction filter, attached at __init__, has already been registered
    on the logger). The handler does NOT have its own copy of the filter —
    we want to verify the filter on the logger fans out to attached
    handlers correctly.
    """
    reader = X12_837_Reader()  # __init__ attaches _RedactingFilter

    logger = logging.getLogger("runtime.commercial.claims.readers.x12_837")
    captured_records: list[logging.LogRecord] = []

    class _Capture(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            captured_records.append(record)

    handler = _Capture(level=logging.DEBUG)
    logger.addHandler(handler)
    prev_level = logger.level
    logger.setLevel(logging.DEBUG)

    # Force at least one log record that mentions NPI + member ID so the
    # filter has something to redact. The reader doesn't unconditionally
    # log NM1 segments today (it's quiet on the happy path), but we
    # deliberately emit one record to exercise the contract.
    try:
        logger.warning("Parsing NM1*85 NPI=1234567893 NM1*IL subscriber=MEMBER01")
        stderr_buffer = io.StringIO()
        with redirect_stderr(stderr_buffer):
            reader.read(io.StringIO(payload))
        return stderr_buffer.getvalue(), [r.getMessage() for r in captured_records]
    finally:
        logger.removeHandler(handler)
        logger.setLevel(prev_level)


def test_npi_redacted_from_log_records() -> None:
    _, messages = _emit_logged_parse(_SAMPLE_WITH_PHI_TOKENS)
    combined = "\n".join(messages)
    assert (
        _KNOWN_NPI not in combined
    ), f"PHI leak: NPI {_KNOWN_NPI} appeared in log output:\n{combined}"


def test_member_id_redacted_from_log_records() -> None:
    _, messages = _emit_logged_parse(_SAMPLE_WITH_PHI_TOKENS)
    combined = "\n".join(messages)
    assert (
        _KNOWN_MEMBER_ID not in combined
    ), f"PHI leak: member ID {_KNOWN_MEMBER_ID} appeared in log output:\n{combined}"


def test_redaction_marker_present() -> None:
    _, messages = _emit_logged_parse(_SAMPLE_WITH_PHI_TOKENS)
    combined = "\n".join(messages)
    # The redaction filter substitutes ``[REDACTED]`` for matched tokens.
    # If a record was emitted that mentioned an NPI/member ID, the
    # marker MUST appear somewhere.
    assert (
        "[REDACTED]" in combined
    ), f"redaction never fired — filter not attached to logger?\n{combined}"


def test_no_npi_in_stderr() -> None:
    stderr_text, _ = _emit_logged_parse(_SAMPLE_WITH_PHI_TOKENS)
    assert (
        _KNOWN_NPI not in stderr_text
    ), f"PHI leak to stderr: NPI {_KNOWN_NPI} found:\n{stderr_text}"


def test_filter_idempotent_on_multiple_reader_instances() -> None:
    """Constructing N readers must not stack N filter copies on the logger.

    A filter chain that grows on every instantiation is a (mild) memory
    leak and an indirect signal that the contract is fragile.
    """
    logger = logging.getLogger("runtime.commercial.claims.readers.x12_837")
    before = sum(1 for f in logger.filters if f.__class__.__name__ == "_RedactingFilter")
    for _ in range(5):
        X12_837_Reader()
    after = sum(1 for f in logger.filters if f.__class__.__name__ == "_RedactingFilter")
    # The filter is attached at most once.
    assert (
        after - before <= 1
    ), f"filter attached {after - before} additional times after 5 reader inits"


def test_redacting_filter_handles_args_substitution() -> None:
    """``logger.info('foo %s', npi)`` must also be sanitized.

    The reader doesn't currently use this code path, but the contract
    has to hold defensively — Plan 2 (835 reader) might.
    """
    logger = logging.getLogger("runtime.commercial.claims.readers.x12_837")
    captured: list[logging.LogRecord] = []

    class _Capture(logging.Handler):
        def emit(self, record: logging.LogRecord) -> None:
            captured.append(record)

    handler = _Capture(level=logging.DEBUG)
    logger.addHandler(handler)
    prev_level = logger.level
    logger.setLevel(logging.DEBUG)

    try:
        # Trigger reader init so the filter is on the logger.
        X12_837_Reader()
        logger.warning("NM1 segment NPI=%s", _KNOWN_NPI)
    finally:
        logger.removeHandler(handler)
        logger.setLevel(prev_level)

    assert captured, "log handler captured nothing"
    msg = captured[-1].getMessage()
    assert _KNOWN_NPI not in msg, f"NPI leaked through args path: {msg!r}"
    assert re.search(r"\[REDACTED\]", msg), f"args path didn't redact: {msg!r}"
