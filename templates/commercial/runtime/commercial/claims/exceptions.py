"""Exception types raised by the X12 / NCPDP readers and the COST projector."""

from __future__ import annotations


class X12ParseError(ValueError):
    """Raised when an X12 transaction cannot be parsed.

    Wraps pyx12 errors with a stable surface so callers can catch a single
    exception type. The message is sanitized — provider NPIs, patient
    subscriber IDs, and member IDs are NEVER included (HIGHSEC §7).
    """


class CostProjectionError(ValueError):
    """Raised when claim-line amounts cannot be projected to OMOP COST rows."""


class NCPDPParseError(ValueError):
    """Raised when an NCPDP D.0 pharmacy-claim transaction cannot be parsed.

    Sanitized identically to ``X12ParseError`` (HIGHSEC §7) — the
    cardholder ID (NCPDP field C2) and patient DOB (C4) are PHI-adjacent
    and MUST never appear in error messages.
    """
