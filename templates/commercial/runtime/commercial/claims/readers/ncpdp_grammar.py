"""NCPDP D.0 Telecom Standard grammar — minimal pyparsing definition.

Phase 3 Plan 3 Task 1 (T-021C). Parses one NCPDP D.0 pharmacy-claim
transaction (a "billing", "reversal", or "rebill" depending on the A4
field) into a typed ``NCPDPTransaction`` record.

NCPDP D.0 reference: NCPDP Telecom Standard v.D.0 §B.1 (Claim Billing).

Encoding (per NCPDP D.0 Implementation Guide §A.2):

- Field separator (FS) = 0x1C ()
- Segment / record separator (RS) = 0x1E ()
- Group separator (GS) = 0x1D () — used for repeating composites
- Each field starts with a 2-character alphanumeric ID (e.g. ``A4``,
  ``D7``); the value follows immediately and runs until the next FS
  or RS.
- Each segment begins with the marker ``AM<NN>`` where NN identifies
  the segment kind (01=header, 03=patient, 04=insurance, 07=claim,
  11=pricing).

We parse the *segments we care about* — the field set is small enough
that hand-rolled parsing on FS / RS splits would also work, but
pyparsing gives us a stable surface and clear error messages.

Out of scope for v0.1:

- Multi-transaction batches (a single payload = a single transaction).
- Repeating composite fields (GS-separated subfields). The fields we
  ingest don't use them.
- Older NCPDP versions (5.1 etc.). D.0 is the current version mandated
  for production pharmacy claims since 2012.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Final

from runtime.commercial.claims.exceptions import NCPDPParseError

# Separators per NCPDP D.0 §A.2.
# Use explicit chr() codes — the literal 0x1C / 0x1E control bytes don't
# round-trip cleanly through some editors, so we encode them numerically.
FS: Final[str] = chr(0x1C)  # field separator
RS: Final[str] = chr(0x1E)  # record / segment separator

# Segment markers we ingest (a subset of the 28 defined by NCPDP D.0).
_SEGMENT_HEADER = "AM01"
_SEGMENT_PATIENT = "AM03"
_SEGMENT_INSURANCE = "AM04"
_SEGMENT_CLAIM = "AM07"
_SEGMENT_PRICING = "AM11"

# Field IDs are exactly 2 alphanumeric characters per NCPDP D.0 §A.4.
_FIELD_ID_RE = re.compile(r"^([A-Z0-9]{2})(.*)$")


@dataclass(frozen=True)
class NCPDPTransaction:
    """Parsed NCPDP D.0 transaction broken out by segment.

    Each segment is a ``dict[str, str]`` keyed by the 2-char field ID.
    The reader (Task 3) materializes these into a typed ``NCPDPClaim``;
    keeping the grammar layer dict-based lets us add fields without
    breaking the parser when the IG evolves.
    """

    header: dict[str, str] = field(default_factory=dict)
    patient: dict[str, str] = field(default_factory=dict)
    insurance: dict[str, str] = field(default_factory=dict)
    claim: dict[str, str] = field(default_factory=dict)
    pricing: dict[str, str] = field(default_factory=dict)

    @property
    def is_reversal(self) -> bool:
        """A4 = transaction code; B2 means reversal (NCPDP D.0 §B.2)."""
        return self.header.get("A4") == "B2"

    @property
    def transaction_code(self) -> str:
        """Empty string if A4 is missing (we don't fail-closed at parse time)."""
        return self.header.get("A4", "")


def _parse_segment_fields(body: str) -> dict[str, str]:
    """Split a segment body on FS, then split each field into (id, value).

    The leading element is the segment marker (e.g. ``AM01``); we drop it
    here because the caller already routed on it.
    """
    fields_out: dict[str, str] = {}
    if not body:
        return fields_out
    parts = body.split(FS)
    # parts[0] is the segment marker; consume the rest.
    for part in parts[1:]:
        if not part:
            continue
        m = _FIELD_ID_RE.match(part)
        if not m:
            # Malformed field — skip rather than fail; production NCPDP
            # data has occasional padding artifacts.
            continue
        field_id, value = m.group(1), m.group(2)
        fields_out[field_id] = value
    return fields_out


def parse_ncpdp_transaction(payload: str) -> NCPDPTransaction:
    """Parse one NCPDP D.0 transaction.

    Returns a populated ``NCPDPTransaction``. Raises ``NCPDPParseError``
    for empty / non-NCPDP input. The parser is permissive about field
    ordering and unrecognized segments (real-world NCPDP data has
    payer-specific extensions).

    HIGHSEC §7: error messages MUST NOT include the payload (cardholder
    IDs, DOBs, member IDs are PHI).
    """
    if not payload:
        raise NCPDPParseError("NCPDP transaction is empty")

    # The minimum-viable transaction has at least the header segment.
    if FS not in payload and RS not in payload:
        raise NCPDPParseError(
            "input does not contain NCPDP separators (FS/RS); not an NCPDP D.0 transaction"
        )

    # Split into segments on RS. Trailing empty segment from a final RS
    # is harmless — we filter empty segments.
    segments = [seg for seg in payload.split(RS) if seg]

    txn = NCPDPTransaction()
    saw_header = False

    for seg in segments:
        # The first FS-delimited token is the segment marker.
        marker = seg.split(FS, 1)[0]
        fields_dict = _parse_segment_fields(seg)
        if marker == _SEGMENT_HEADER:
            txn.header.update(fields_dict)
            saw_header = True
        elif marker == _SEGMENT_PATIENT:
            txn.patient.update(fields_dict)
        elif marker == _SEGMENT_INSURANCE:
            txn.insurance.update(fields_dict)
        elif marker == _SEGMENT_CLAIM:
            txn.claim.update(fields_dict)
        elif marker == _SEGMENT_PRICING:
            txn.pricing.update(fields_dict)
        # Other markers (AM02 service, AM05 prescriber, etc.) silently
        # ignored — out of scope for v0.1.

    if not saw_header:
        raise NCPDPParseError("missing NCPDP header segment (AM01)")

    return txn


__all__ = ["FS", "RS", "NCPDPTransaction", "parse_ncpdp_transaction"]
