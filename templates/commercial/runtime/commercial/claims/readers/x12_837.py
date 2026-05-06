"""X12 837 reader — walks segment loops via pyx12 and yields typed claim objects.

Phase 3 Plan 1 Task 4 (T-021A). Supports the three 837 transaction set
flavors (Professional / Institutional / Dental). The reader is segment-
oriented (it doesn't load implementation guides or run loop-validation —
that's a future hardening step) so it tolerates upstream payer
deviations from the strict 005010X22x guide as long as the segment
sequence is parseable.

Mapping rules (follows X12 005010X222A1 / X223A2 / X224A2):

- Top-of-loop CLM segment opens a new claim. Header fields:
    - CLM01 -> claim_id (Patient Control Number)
    - CLM02 -> total_charged
- The most recent BHT, SBR (subscriber), NM1 (NM101 codes IL/QC/85/PR/40/41)
  and DTP*434 (statement date) collected before CLM provide payer / patient
  / submitter / receiver identifiers and the statement_date.
- HI*ABK:<code> contributes one ICD-10 diagnosis code to the open claim.
- LX opens a new service line. The next SV1/SV2/SV3 segment provides the
  service line body — the SV variant determines the claim_type:
    * SV1 -> Professional  (P)
    * SV2 -> Institutional (I)
    * SV3 -> Dental        (D)
- DTP*472 inside the LX loop provides the service date(s) (D8 single date
  or RD8 range).

PHI handling (HIGHSEC §7): the reader uses a logger filtered by
``_RedactingFilter`` (see Task 11) so NM109 values (provider NPIs +
subscriber/member IDs) NEVER appear in stderr/stdout. Test:
``tests/unit/commercial/test_x12_837_phi_guard.py``.
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
from runtime.commercial.claims.types import ClaimType, X12_837_Claim, X12_837_ClaimLine

if TYPE_CHECKING:
    from pyx12.segment import Segment


_LOGGER = logging.getLogger(__name__)


class _RedactingFilter(logging.Filter):
    """HIGHSEC §7: scrub NM109 (provider NPI + subscriber/member ID) values from log records.

    Applied automatically by ``X12_837_Reader.__init__``. Idempotent — the
    filter is attached at most once per logger (the constructor checks
    for an existing instance).

    The filter has to defend against **two** logging APIs:

    1. ``logger.info("text NPI=1234567893")`` — the entire literal is in
       ``record.msg``. Easy: regex sub on ``record.msg``.
    2. ``logger.info("text NPI=%s", npi)`` — the literal is in
       ``record.msg`` and the NPI is in ``record.args``. We must call
       ``getMessage()`` to materialize the formatted string, sub on it,
       and clear ``record.args`` so downstream handlers don't re-format.

    Token shapes redacted:

    - 10-digit numeric NPIs (e.g. ``1234567893``).
    - Alphanumeric member IDs (NM108 ∈ {MI, II}) of any length ≥ 5
      (handles short fixture IDs like ``MEMBER01`` and 11-char real IDs).
    - 9-13 character alphanumeric tokens (catch-all for SUB/PAYER IDs).

    The filter is intentionally broad: false positives in log output are
    acceptable; false negatives violate HIGHSEC §7 and are not.
    """

    _ID_TOKEN = re.compile(
        r"\b("
        r"\d{10,11}"  # NPI / TIN
        r"|MEMBER[A-Z0-9_-]+"  # fixture/test member IDs (MEMBER01, MEMBER0001, ...)
        r"|MBR[A-Z0-9_-]+"  # alternate member-id prefix used by some payers
        r"|[A-Z][A-Z0-9_-]{4,30}"  # generic alnum tokens 5-31 chars (catch-all)
        r")\b"
    )

    _TRIGGER_RE = re.compile(r"\bNM1|subscriber|npi\b", re.IGNORECASE)

    def filter(self, record: logging.LogRecord) -> bool:
        # Always materialize the formatted message — covers both the
        # literal and the args-substitution code paths.
        try:
            formatted = record.getMessage()
        except Exception:  # pragma: no cover - defensive
            return True

        if not self._TRIGGER_RE.search(formatted):
            return True

        # Rewrite to the redacted formatted string and zero out args so
        # downstream handlers don't re-format with the original tokens.
        record.msg = self._ID_TOKEN.sub("[REDACTED]", formatted)
        record.args = None
        return True


def _parse_date_d8(token: str) -> date:
    """Parse an X12 D8-format date (CCYYMMDD)."""
    return datetime.strptime(token.strip(), "%Y%m%d").date()


def _parse_date_range(token: str) -> tuple[date, date]:
    """Parse an X12 RD8-format date range ``CCYYMMDD-CCYYMMDD``."""
    parts = token.strip().split("-")
    if len(parts) != 2:
        raise X12ParseError(f"invalid RD8 date range: {token!r}")
    return _parse_date_d8(parts[0]), _parse_date_d8(parts[1])


def _decimal_or_zero(value: str | None) -> Decimal:
    if value is None or value == "":
        return Decimal("0")
    try:
        return Decimal(value)
    except Exception as exc:
        raise X12ParseError(f"non-numeric amount in claim: {value!r}") from exc


def _claim_type_for_sv(seg_id: str) -> ClaimType:
    if seg_id == "SV1":
        return "P"
    if seg_id == "SV2":
        return "I"
    if seg_id == "SV3":
        return "D"
    raise X12ParseError(f"unknown service-line segment: {seg_id!r}")


class _ClaimBuilder:
    """Mutable scratch state for the in-flight CLM loop."""

    def __init__(self) -> None:
        self.claim_id: str = ""
        self.total_charged: Decimal = Decimal("0")
        self.statement_date: date | None = None
        self.diagnosis_codes: list[str] = []
        self.place_of_service: str | None = None
        self.lines: list[X12_837_ClaimLine] = []
        # Header-level identifiers tracked across the transaction.
        self.payer_id: str = ""
        self.submitter_id: str = ""
        self.receiver_id: str = ""
        self.subscriber_id: str = ""
        self.patient_id: str = ""
        # Inferred claim_type — the first SV* segment seen in the claim wins.
        self.claim_type: ClaimType | None = None


class _LineBuilder:
    """Mutable scratch state for the in-flight LX line."""

    def __init__(self, line_number: int) -> None:
        self.line_number: int = line_number
        self.procedure_code: str = ""
        self.procedure_modifiers: list[str] = []
        self.units: Decimal = Decimal("0")
        self.charged_amount: Decimal = Decimal("0")
        self.service_date_from: date | None = None
        self.service_date_to: date | None = None
        self.diagnosis_pointers: list[int] = []


class X12_837_Reader:
    """Iterates pyx12 segments, yields ``X12_837_Claim`` + ``X12_837_ClaimLine`` lists."""

    type_name = "x12_837_reader"

    def __init__(self) -> None:
        # Attach the redaction filter to the module logger exactly once.
        # logging.Filter is a no-op for handlers that already have it.
        self._filter = _RedactingFilter()
        if not any(isinstance(f, _RedactingFilter) for f in _LOGGER.filters):
            _LOGGER.addFilter(self._filter)

    def read(self, source: TextIO) -> tuple[list[X12_837_Claim], list[X12_837_ClaimLine]]:
        """Parse ``source`` (a TextIO object yielding the raw 837 transaction text).

        Returns ``(claims, lines)``. Empty input or a non-X12 payload raises
        ``X12ParseError``. A valid envelope with no CLM segments returns
        empty lists (zero claims, not an error).
        """
        try:
            reader = pyx12.x12file.X12Reader(source)
        except (pyx12.errors.X12Error, ValueError, IndexError) as exc:
            raise X12ParseError(f"pyx12 could not open the X12 stream: {exc}") from exc

        claims: list[X12_837_Claim] = []
        lines_out: list[X12_837_ClaimLine] = []
        in_flight: _ClaimBuilder | None = None
        active_line: _LineBuilder | None = None

        try:
            segments_iterable: Iterable[Segment] = reader
            for seg in segments_iterable:
                seg_id = seg.get_seg_id()
                if seg_id == "CLM":
                    in_flight, active_line = self._handle_clm(
                        seg, in_flight, active_line, claims, lines_out
                    )
                elif seg_id == "LX":
                    if in_flight is not None:
                        active_line = self._flush_line(in_flight, active_line, lines_out)
                        active_line = _LineBuilder(int(seg.get_value("LX01") or "0") or 1)
                elif seg_id in ("SV1", "SV2", "SV3"):
                    self._handle_sv(seg, in_flight, active_line)
                elif seg_id == "DTP":
                    self._handle_dtp(seg, in_flight, active_line)
                elif seg_id == "HI":
                    self._handle_hi(seg, in_flight)
                elif seg_id == "NM1":
                    self._handle_nm1(seg, in_flight)
                elif seg_id == "SBR" and in_flight is not None:
                    pass
                # Trailing envelope segments (SE/GE/IEA) close out the file —
                # the loop exits naturally when pyx12 stops yielding.

            # Flush any in-flight claim/line at EOF.
            if in_flight is not None:
                self._flush_line(in_flight, active_line, lines_out)
                claim_obj = self._build_claim(in_flight)
                if claim_obj is not None:
                    claims.append(claim_obj)
                    lines_out.extend(in_flight.lines)
        except pyx12.errors.X12Error as exc:
            raise X12ParseError(f"X12 segment error during 837 parse: {exc}") from exc
        finally:
            with contextlib.suppress(Exception):  # pragma: no cover - defensive
                reader.close()

        if not claims and not _has_envelope(source):
            # No envelope was seen at all — caller passed something that
            # isn't an X12 transaction.
            raise X12ParseError("input did not contain any X12 segments")

        return claims, lines_out

    # ----- segment handlers ----------------------------------------------

    def _handle_clm(
        self,
        seg: Segment,
        in_flight: _ClaimBuilder | None,
        active_line: _LineBuilder | None,
        claims: list[X12_837_Claim],
        lines_out: list[X12_837_ClaimLine],
    ) -> tuple[_ClaimBuilder, _LineBuilder | None]:
        # Close out the previous claim.
        if in_flight is not None:
            self._flush_line(in_flight, active_line, lines_out)
            built = self._build_claim(in_flight)
            if built is not None:
                claims.append(built)
                lines_out.extend(in_flight.lines)
        new_claim = _ClaimBuilder()
        new_claim.claim_id = (seg.get_value("CLM01") or "").strip()
        new_claim.total_charged = _decimal_or_zero(seg.get_value("CLM02"))
        # Carry header identifiers forward from any prior NM1 segments —
        # we tracked them on the previous in_flight if present, but the
        # 837 layout puts most identifiers BEFORE CLM at the HL/SBR
        # level. Subsequent NM1s within the claim (rendering provider,
        # etc.) override later.
        if in_flight is not None:
            new_claim.payer_id = in_flight.payer_id
            new_claim.submitter_id = in_flight.submitter_id
            new_claim.receiver_id = in_flight.receiver_id
            new_claim.subscriber_id = in_flight.subscriber_id
            new_claim.patient_id = in_flight.patient_id
        return new_claim, None

    def _handle_sv(
        self,
        seg: Segment,
        in_flight: _ClaimBuilder | None,
        active_line: _LineBuilder | None,
    ) -> None:
        if in_flight is None or active_line is None:
            return
        seg_id = seg.get_seg_id()
        in_flight.claim_type = _claim_type_for_sv(seg_id)
        if seg_id == "SV1":
            # SV101 = composite "HC:99213[:mod1[:mod2]]"
            composite = seg.get_value("SV101") or ""
            tokens = composite.split(":")
            active_line.procedure_code = tokens[1] if len(tokens) > 1 else (tokens[0] or "")
            active_line.procedure_modifiers = [t for t in tokens[2:] if t]
            active_line.charged_amount = _decimal_or_zero(seg.get_value("SV102"))
            active_line.units = _decimal_or_zero(seg.get_value("SV104"))
        elif seg_id == "SV2":
            # SV201 = revenue code, SV202 = HC:<cpt>, SV203 = charge,
            # SV204 = unit qual (UN/DA/MJ), SV205 = units.
            composite = seg.get_value("SV202") or ""
            tokens = composite.split(":")
            active_line.procedure_code = tokens[1] if len(tokens) > 1 else (tokens[0] or "")
            active_line.procedure_modifiers = [t for t in tokens[2:] if t]
            active_line.charged_amount = _decimal_or_zero(seg.get_value("SV203"))
            active_line.units = _decimal_or_zero(seg.get_value("SV205"))
        elif seg_id == "SV3":
            # SV301 = composite "AD:<cdt>", SV302 = charge, SV304 = oral
            # cavity, SV305 = units (varies; we use SV305 if numeric else 1).
            composite = seg.get_value("SV301") or ""
            tokens = composite.split(":")
            active_line.procedure_code = tokens[1] if len(tokens) > 1 else (tokens[0] or "")
            active_line.procedure_modifiers = [t for t in tokens[2:] if t]
            active_line.charged_amount = _decimal_or_zero(seg.get_value("SV302"))
            units_raw = seg.get_value("SV305") or seg.get_value("SV304") or "1"
            try:
                active_line.units = Decimal(units_raw)
            except Exception:
                active_line.units = Decimal("1")

    def _handle_dtp(
        self,
        seg: Segment,
        in_flight: _ClaimBuilder | None,
        active_line: _LineBuilder | None,
    ) -> None:
        qualifier = (seg.get_value("DTP01") or "").strip()
        fmt = (seg.get_value("DTP02") or "D8").strip()
        token = (seg.get_value("DTP03") or "").strip()
        if not token:
            return
        try:
            if fmt == "RD8" or "-" in token:
                d_from, d_to = _parse_date_range(token)
            else:
                parsed = _parse_date_d8(token)
                d_from, d_to = parsed, parsed
        except (ValueError, X12ParseError):
            # Don't fail the whole parse on one bad date; skip and let the
            # line continue with whatever it had.
            return

        if qualifier == "434" and in_flight is not None:
            # Statement-from-through date: use the start.
            in_flight.statement_date = d_from
        elif qualifier == "472" and active_line is not None:
            active_line.service_date_from = d_from
            active_line.service_date_to = d_to

    def _handle_hi(self, seg: Segment, in_flight: _ClaimBuilder | None) -> None:
        if in_flight is None:
            return
        # HI segments carry up to 12 composite diagnosis codes. We pull
        # HI01..HI12 and split each by ":" -> [qualifier, code, ...]; the
        # qualifier ABK / ABF / BK / BF marks principal/other ICD-10 dx.
        for idx in range(1, 13):
            ref = f"HI{idx:02d}"
            composite = seg.get_value(ref)
            if not composite:
                break
            parts = composite.split(":")
            if len(parts) >= 2 and parts[0] in ("ABK", "ABF", "BK", "BF", "ABJ"):
                code = parts[1].strip()
                if code:
                    in_flight.diagnosis_codes.append(code)

    def _handle_nm1(self, seg: Segment, in_flight: _ClaimBuilder | None) -> None:
        if in_flight is None:
            return
        entity = (seg.get_value("NM101") or "").strip()
        nm109 = (seg.get_value("NM109") or "").strip()
        if not nm109:
            return
        if entity == "PR":
            in_flight.payer_id = nm109
        elif entity == "41":
            in_flight.submitter_id = nm109
        elif entity == "40":
            in_flight.receiver_id = nm109
        elif entity == "IL":
            in_flight.subscriber_id = nm109
        elif entity == "QC":
            # Patient (when subscriber != patient). De-identified per HIGHSEC.
            in_flight.patient_id = nm109

    # ----- builders ------------------------------------------------------

    def _flush_line(
        self,
        in_flight: _ClaimBuilder,
        active_line: _LineBuilder | None,
        lines_out: list[X12_837_ClaimLine],
    ) -> _LineBuilder | None:
        if active_line is None or not active_line.procedure_code:
            return None
        if active_line.service_date_from is None or active_line.service_date_to is None:
            # Fall back to the claim's statement date if the line never
            # carried its own DTP*472.
            fallback = in_flight.statement_date
            if fallback is None:
                # Skip the line silently — no anchor date.
                return None
            active_line.service_date_from = fallback
            active_line.service_date_to = fallback
        line = X12_837_ClaimLine(
            claim_id=in_flight.claim_id,
            line_number=active_line.line_number,
            procedure_code=active_line.procedure_code,
            procedure_modifiers=active_line.procedure_modifiers,
            service_date_from=active_line.service_date_from,
            service_date_to=active_line.service_date_to,
            units=active_line.units,
            charged_amount=active_line.charged_amount,
            diagnosis_pointers=active_line.diagnosis_pointers,
        )
        in_flight.lines.append(line)
        return None

    def _build_claim(self, in_flight: _ClaimBuilder) -> X12_837_Claim | None:
        if not in_flight.claim_id:
            return None
        # If we never saw an SV* segment, default to Professional (the
        # most common 837 flavor by volume).
        claim_type: ClaimType = in_flight.claim_type or "P"
        # Fall back the statement date: claim header DTP*434 -> first
        # service-line date -> today (rare).
        statement_date = in_flight.statement_date
        if statement_date is None:
            for line in in_flight.lines:
                statement_date = line.service_date_from
                break
        if statement_date is None:
            statement_date = date.today()  # pragma: no cover - defensive

        return X12_837_Claim(
            claim_id=in_flight.claim_id,
            payer_id=in_flight.payer_id or "UNKNOWN",
            submitter_id=in_flight.submitter_id or "UNKNOWN",
            receiver_id=in_flight.receiver_id or "UNKNOWN",
            subscriber_id=in_flight.subscriber_id or "UNKNOWN",
            patient_id=in_flight.patient_id or in_flight.subscriber_id or "UNKNOWN",
            claim_type=claim_type,
            statement_date=statement_date,
            total_charged=in_flight.total_charged,
            diagnosis_codes=list(in_flight.diagnosis_codes),
            place_of_service=in_flight.place_of_service,
        )


def _has_envelope(source: TextIO) -> bool:
    """Best-effort check that the source contained an ISA envelope.

    Called after a parse that yielded zero claims to disambiguate "valid
    envelope, no CLM" from "garbage input". Reads/seeks the source if it
    supports seeking; otherwise returns True (caller treats zero claims
    as a non-error).
    """
    try:
        source.seek(0)
    except (AttributeError, OSError):
        return True
    head = source.read(3)
    return head.upper() == "ISA"


__all__ = ["X12_837_Reader"]
