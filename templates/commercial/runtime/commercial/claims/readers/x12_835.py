"""X12 835 reader — walks segment loops via pyx12 and yields ``X12_835_RemitItem`` rows.

Phase 3 Plan 2 Task 2 (T-021B). The 835 transaction set carries
electronic remittance advice — the payer's reconciliation of an 837
claim. One ``CLP/SVC`` loop pair → one ``X12_835_RemitItem``. The
reconciler in Task 3 joins these onto Plan 1's COST rows by
``(payer_id, claim_id, line_number)``.

Mapping rules (follows X12 005010X221A1):

- ST*835 opens the transaction.
- BPR carries financial info (payment amount, payment method,
  production date) but is otherwise informational at the line level.
- TRN carries the trace / reassociation number used to pair with 837s.
- N1*PR is the payer (organization name + ID); N1*PE is the payee.
- DTM*405 at the BPR/header level is the **production date** — surfaces
  on every emitted ``X12_835_RemitItem`` as ``paid_date`` unless a
  more specific CLP-level DTM*405 overrides it. The 005010X221A1 IG
  permits both.
- CLP opens a claim-payment loop:
    * CLP01 = Patient Control Number   → claim_id (joins onto 837)
    * CLP02 = claim status code        → "22" means **Reversal**
    * CLP03 = total charged
    * CLP04 = total paid
    * CLP05 = patient responsibility
- CAS carries claim-adjustment triples — (group_code, reason_code,
  amount) — that we aggregate onto the most-recent emitted RemitItem.
- NM1 in a CLP loop optionally carries patient/subscriber identifiers;
  we don't use them (PHI-adjacent).
- SVC opens a service-line payment loop. The composite SVC01 carries
  ``HC:<procedure_code>`` (HCPCS/CPT). The reader emits one
  ``X12_835_RemitItem`` per SVC, line-numbered sequentially within the
  CLP.
- AMT*B6 inside the SVC loop carries the line allowed amount.
- DTM*472 inside the SVC loop carries the service date.

PHI handling (HIGHSEC §7): the reader uses a logger filtered by
``_RedactingFilter`` so payer / payee identifiers, claim_ids, and
control numbers never appear in stderr/stdout (test:
``tests/unit/commercial/test_x12_835_phi_guard.py`` — Task 11 of Plan 1
covers the parallel 837 case; this reader piggy-backs on the same
pattern).
"""

from __future__ import annotations

import contextlib
import logging
import re
from collections.abc import Iterable
from datetime import date, datetime
from decimal import Decimal
from typing import TYPE_CHECKING, TextIO

import pyx12.errors
import pyx12.x12file

from runtime.commercial.claims.exceptions import X12ParseError
from runtime.commercial.claims.types import X12_835_RemitItem

if TYPE_CHECKING:
    from pyx12.segment import Segment


_LOGGER = logging.getLogger(__name__)


class _RedactingFilter(logging.Filter):
    """HIGHSEC §7: scrub claim_ids / payer IDs / NPIs from log records.

    Mirrors the pattern from Plan 1's 837 reader. The filter is broad
    by design — false positives in log output are acceptable; false
    negatives violate HIGHSEC §7.
    """

    # 9-15 character alphanumeric tokens — catches NPIs, ICNs, claim_ids,
    # TRN numbers, member IDs, payer IDs.
    _ID_TOKEN = re.compile(r"\b[A-Z0-9]{9,15}\b")

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            msg = record.getMessage()
        except Exception:  # pragma: no cover - defensive
            return True
        record.msg = self._ID_TOKEN.sub("***REDACTED***", msg)
        record.args = ()
        return True


def _parse_date(value: str) -> date | None:
    """X12 dates are CCYYMMDD when 8 chars."""
    value = (value or "").strip()
    if len(value) == 8 and value.isdigit():
        try:
            return datetime.strptime(value, "%Y%m%d").date()
        except ValueError:
            return None
    return None


def _to_decimal(value: str | None) -> Decimal:
    if value is None or value == "":
        return Decimal("0")
    try:
        return Decimal(value)
    except Exception as exc:
        raise X12ParseError(f"non-numeric amount: {value!r}") from exc


def _split_composite(value: str) -> list[str]:
    """SVC01 / SVC03 / etc. carry composite values separated by ':'."""
    return (value or "").split(":")


class _ClpBuilder:
    """Mutable scratch state for an in-flight CLP loop."""

    def __init__(self) -> None:
        self.claim_id: str = ""
        self.status_code: str = ""  # CLP02
        self.is_reversal: bool = False
        self.total_charged: Decimal = Decimal("0")
        self.total_paid: Decimal = Decimal("0")
        self.line_count: int = 0
        # CAS triples that have not yet been attached to an emitted
        # RemitItem (i.e. CAS seen at CLP level before any SVC). Once a
        # SVC emits an item, subsequent CAS triples attach to it.
        self.pending_cas: list[tuple[str, str, Decimal]] = []


class X12_835_Reader:
    """Iterates pyx12 segments, yields ``X12_835_RemitItem`` rows."""

    type_name = "x12_835_reader"

    def __init__(self) -> None:
        self._filter = _RedactingFilter()
        if not any(isinstance(f, _RedactingFilter) for f in _LOGGER.filters):
            _LOGGER.addFilter(self._filter)

    def read(self, source: TextIO) -> list[X12_835_RemitItem]:
        """Parse ``source`` (TextIO yielding raw 835 transaction text).

        Returns the list of ``X12_835_RemitItem`` — one per CLP/SVC loop.
        Empty input or non-X12 payload raises ``X12ParseError``. A valid
        envelope with no CLP segments returns an empty list.
        """
        try:
            reader = pyx12.x12file.X12Reader(source)
        except (pyx12.errors.X12Error, ValueError, IndexError) as exc:
            raise X12ParseError(f"pyx12 could not open the X12 stream: {exc}") from exc

        items: list[X12_835_RemitItem] = []
        payer_id: str = ""
        production_date: date | None = None
        clp: _ClpBuilder | None = None
        # The most-recently emitted item; CAS / AMT / DTM segments after an
        # SVC attach to this item.
        last_item: X12_835_RemitItem | None = None

        try:
            segments_iterable: Iterable[Segment] = reader
            for seg in segments_iterable:
                seg_id = seg.get_seg_id()

                if seg_id == "DTM":
                    qual = seg.get_value("DTM01") or ""
                    if qual == "405":
                        # Production / paid date at header level.
                        production_date = _parse_date(seg.get_value("DTM02") or "")
                    elif qual == "472" and last_item is not None:
                        # Service date — informational; not on the model.
                        pass
                elif seg_id == "N1":
                    code = seg.get_value("N101") or ""
                    if code == "PR":
                        # Payer — first non-empty token wins. Try N104 (ID
                        # qualifier varies); fall back to N102 (org name).
                        payer_id = (seg.get_value("N104") or "").strip() or (
                            seg.get_value("N102") or ""
                        ).strip()
                elif seg_id == "CLP":
                    clp = _ClpBuilder()
                    clp.claim_id = (seg.get_value("CLP01") or "").strip()
                    clp.status_code = (seg.get_value("CLP02") or "").strip()
                    clp.is_reversal = clp.status_code == "22"
                    clp.total_charged = _to_decimal(seg.get_value("CLP03"))
                    clp.total_paid = _to_decimal(seg.get_value("CLP04"))
                    last_item = None
                elif seg_id == "CAS":
                    triple = self._parse_cas(seg)
                    if last_item is not None and triple is not None:
                        # Append to the existing item by reconstructing it
                        # (frozen=True). Idiomatic for Pydantic v2.
                        items[-1] = last_item.model_copy(
                            update={"adjustment_codes": [*last_item.adjustment_codes, triple]}
                        )
                        last_item = items[-1]
                    elif clp is not None and triple is not None:
                        clp.pending_cas.append(triple)
                elif seg_id == "SVC":
                    if clp is None:
                        # SVC outside a CLP loop — malformed; skip.
                        continue
                    composite = _split_composite(seg.get_value("SVC01") or "")
                    procedure_code = composite[1] if len(composite) >= 2 else ""
                    charged = _to_decimal(seg.get_value("SVC02"))
                    paid = _to_decimal(seg.get_value("SVC03"))
                    clp.line_count += 1
                    item = X12_835_RemitItem(
                        payer_id=payer_id or "",
                        claim_id=clp.claim_id,
                        line_number=clp.line_count,
                        procedure_code=procedure_code,
                        charged_amount=charged,
                        paid_amount=paid,
                        allowed_amount=Decimal("0"),
                        adjustment_codes=list(clp.pending_cas),
                        is_reversal=clp.is_reversal,
                        paid_date=production_date,
                    )
                    clp.pending_cas = []  # CAS triples consumed.
                    items.append(item)
                    last_item = item
                elif seg_id == "AMT":
                    if last_item is not None and (seg.get_value("AMT01") or "") == "B6":
                        amount = _to_decimal(seg.get_value("AMT02"))
                        items[-1] = last_item.model_copy(update={"allowed_amount": amount})
                        last_item = items[-1]
        except pyx12.errors.X12Error as exc:
            raise X12ParseError(f"X12 segment error during 835 parse: {exc}") from exc
        finally:
            with contextlib.suppress(Exception):  # pragma: no cover - defensive
                reader.close()

        if not items and not _has_envelope(source):
            raise X12ParseError("input did not contain any X12 segments")

        return items

    def _parse_cas(self, seg: Segment) -> tuple[str, str, Decimal] | None:
        """Extract the first (group, reason, amount) triple from a CAS segment.

        CAS can carry up to 6 triples in elements (CAS01,CAS02,CAS03) and
        repeat through (CAS16,CAS17,CAS18). We take the first one — the
        reconciler is interested in the dominant adjustment, not every
        sub-line breakdown.
        """
        group = (seg.get_value("CAS01") or "").strip()
        reason = (seg.get_value("CAS02") or "").strip()
        amount_raw = seg.get_value("CAS03") or ""
        if not group or not reason or not amount_raw:
            return None
        try:
            amount = Decimal(amount_raw)
        except Exception:
            return None
        return (group, reason, amount)


def _has_envelope(source: TextIO) -> bool:
    """Best-effort check that the input looked like an X12 stream."""
    try:
        pos = source.tell()
        source.seek(0)
        head = source.read(3)
        source.seek(pos)
        return head == "ISA"
    except Exception:  # pragma: no cover - defensive
        return False
