"""HL7 v2.x ORU^R01 lab result reader — emits ``OruR01Message`` per MSH-rooted block.

Phase 3 Plan 5 Task 3 (T-023). Community-tier (AGPLv3); the
MEASUREMENT mapper (Task 6) consumes the emitted messages and the
T-024 commercial harmonizer (Plan 6) reads the unmapped-code queue
populated by the SQL stage (Task 7).

Task 3 covers ORU^R01 (the bulk of the lab volume); Task 4 will add
ORU^R30 (unsolicited point-of-care) and ORU^R31 (encounter-tied)
trigger-event variants.

PHI handling per HIGHSEC §7 — patient_id, message_control_id, and
specimen identifiers MUST never appear in error messages or logs.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Iterable, Iterator
from datetime import UTC, datetime

import hl7
from pydantic import ValidationError

from runtime.lab.types import OruObservation, OruR01Message

_LOGGER = logging.getLogger(__name__)


class Hl7v2ParseError(ValueError):
    """Raised when an HL7 v2 message can't be parsed.

    Sanitized per HIGHSEC §7 — patient identifiers, message control IDs,
    and specimen IDs MUST never surface in the message.
    """


class _RedactingFilter(logging.Filter):
    _ID_TOKEN = re.compile(r"\b[A-Z0-9]{6,15}\b")

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            msg = record.getMessage()
        except Exception:  # pragma: no cover - defensive
            return True
        record.msg = self._ID_TOKEN.sub("***REDACTED***", msg)
        record.args = ()
        return True


def _normalize(text: str) -> str:
    """HL7 segments are CR-delimited; tolerate CRLF/LF input from real EHRs."""
    return text.replace("\r\n", "\r").replace("\n", "\r")


def _split_messages(text: str) -> list[str]:
    """Split a multi-message blob into individual MSH-rooted blocks."""
    blocks: list[list[str]] = []
    current: list[str] = []
    for line in _normalize(text).split("\r"):
        if not line:
            continue
        if line.startswith("MSH|"):
            if current:
                blocks.append(current)
            current = [line]
        else:
            current.append(line)
    if current:
        blocks.append(current)
    return ["\r".join(b) for b in blocks]


def _field(seg: hl7.Segment, idx: int) -> str:
    """Return the n-th field of a segment as a string, '' if missing."""
    try:
        return str(seg[idx])
    except (IndexError, KeyError):
        return ""


def _components(value: str) -> list[str]:
    """Split an HL7 CWE-style field on ``^`` (component separator)."""
    return value.split("^")


def _parse_hl7_ts(raw: str) -> datetime:
    """HL7 TS format: YYYYMMDD[HHMM[SS]] — parse to a tz-aware UTC datetime.

    HL7 v2 timestamps technically allow trailing fractional seconds and an
    explicit timezone offset; v0.1 of the reader treats unqualified TS as UTC.
    """
    cleaned = raw.strip()
    if not cleaned:
        raise Hl7v2ParseError("empty HL7 timestamp")
    for fmt in ("%Y%m%d%H%M%S", "%Y%m%d%H%M", "%Y%m%d"):
        try:
            return datetime.strptime(cleaned, fmt).replace(tzinfo=UTC)
        except ValueError:
            continue
    raise Hl7v2ParseError("unparseable HL7 timestamp")


def _first_ts(candidates: list[str]) -> datetime:
    """Walk a fallback chain of HL7 TS strings; return the first that parses."""
    for raw in candidates:
        if raw and raw.strip():
            return _parse_hl7_ts(raw)
    raise Hl7v2ParseError("OBX has no timestamp and no OBR/MSH fallback timestamps were present")


class Hl7v2OruReader:
    """Read HL7 v2.x ORU^R01 lab result messages."""

    type_name = "hl7v2_oru_reader"

    def __init__(self) -> None:
        self._filter = _RedactingFilter()
        if not any(isinstance(f, _RedactingFilter) for f in _LOGGER.filters):
            _LOGGER.addFilter(self._filter)

    def read(self, text: str) -> Iterable[OruR01Message]:
        """Parse a (potentially multi-message) HL7 v2 blob into OruR01Messages.

        Returns an iterator that yields one message per MSH-rooted block.
        """
        return self._iter(text)

    def _iter(self, text: str) -> Iterator[OruR01Message]:
        blocks = _split_messages(text)
        if not blocks:
            raise Hl7v2ParseError("input contains no MSH-rooted HL7 message")
        for block in blocks:
            yield self._parse_one(block)

    @staticmethod
    def _require_segment(msg: hl7.Message, segment_id: str) -> hl7.Segment:
        try:
            return next(iter(msg.segments(segment_id)))
        except (KeyError, StopIteration) as exc:
            raise Hl7v2ParseError(f"HL7 ORU message missing {segment_id} segment") from exc

    @staticmethod
    def _optional_segment(msg: hl7.Message, segment_id: str) -> hl7.Segment | None:
        try:
            return next(iter(msg.segments(segment_id)))
        except (KeyError, StopIteration):
            return None

    def _parse_one(self, msg_text: str) -> OruR01Message:
        try:
            msg = hl7.parse(msg_text)
        except Exception as exc:  # python-hl7 raises ValueError variants
            raise Hl7v2ParseError("HL7 v2 parse failed") from exc

        msh = self._require_segment(msg, "MSH")
        pid = self._require_segment(msg, "PID")
        obr = self._require_segment(msg, "OBR")
        pv1 = self._optional_segment(msg, "PV1")

        encounter_id = _field(pv1, 19) if pv1 is not None else ""

        # OBX-14 (per-observation timestamp) is often missing in real HL7
        # batches; fall back to OBR-7 (observation date/time) and finally
        # MSH-7 (message timestamp) so observation_date is always populated.
        ts_fallbacks = [_field(obr, 7), _field(msh, 7)]

        try:
            obx_segments = list(msg.segments("OBX"))
        except KeyError:
            obx_segments = []
        observations = [self._parse_obx(obx, ts_fallbacks=ts_fallbacks) for obx in obx_segments]

        try:
            return OruR01Message(
                message_control_id=_field(msh, 10),
                sending_application=_field(msh, 3),
                sending_facility=_field(msh, 4),
                patient_id=_field(pid, 3),
                encounter_id=encounter_id or None,
                order_control_code=_field(obr, 11),
                universal_service_id=_field(obr, 4),
                observations=observations,
            )
        except ValidationError as exc:
            raise Hl7v2ParseError("HL7 ORU message validation failed") from exc

    def _parse_obx(
        self, obx: hl7.Segment, *, ts_fallbacks: list[str] | None = None
    ) -> OruObservation:
        try:
            set_id = int(_field(obx, 1) or "0")
        except ValueError as exc:
            raise Hl7v2ParseError("OBX segment has non-integer set_id") from exc

        obs_id_components = _components(_field(obx, 3))
        observation_id = obs_id_components[0] if obs_id_components else ""
        observation_id_text = obs_id_components[1] if len(obs_id_components) > 1 else ""
        coding_system = obs_id_components[2] if len(obs_id_components) > 2 else ""

        units = _field(obx, 6) or None
        abnormal_flag = _field(obx, 8) or None
        ts_candidates = [_field(obx, 14), *(ts_fallbacks or [])]
        observation_date = _first_ts(ts_candidates)

        try:
            return OruObservation(
                set_id=set_id,
                value_type=_field(obx, 2),
                observation_id=observation_id,
                observation_id_text=observation_id_text,
                coding_system=coding_system,
                observation_value=_field(obx, 5),
                units=units,
                observation_date=observation_date,
                abnormal_flag=abnormal_flag,
            )
        except ValidationError as exc:
            raise Hl7v2ParseError("OBX validation failed") from exc


__all__ = ["Hl7v2OruReader", "Hl7v2ParseError"]
