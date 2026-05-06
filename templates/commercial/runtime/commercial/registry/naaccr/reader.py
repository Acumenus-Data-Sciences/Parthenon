"""NAACCR fixed-width flat-file reader.

Phase 3 Plan 4A Task 3 (T-022A). Reads NAACCR layout files line by
line, extracting the curated 80-column subset declared by
``NAACCRRecord`` via the column map in ``layout.py``.

NAACCR data is fixed-width: each line carries the patient + tumor +
treatment + outcome fields at known column offsets. The reader
extracts each column, strips trailing whitespace, and materializes a
typed ``NAACCRRecord``. Pydantic ``ValidationError`` is wrapped in
``NAACCRReadError`` so callers see a single stable exception type.

PHI handling: NAACCR records contain patient name + DOB + addresses.
The reader's logger uses a ``_RedactingFilter`` mirroring Plans 1-3's
pattern; production deployments must operate against de-identified
NAACCR exports per HIGHSEC §7.
"""

from __future__ import annotations

import logging
import re
from collections.abc import Iterable
from datetime import date, datetime
from typing import TextIO

from pydantic import ValidationError

from runtime.commercial.registry.naaccr.layout import COLUMNS
from runtime.commercial.registry.naaccr.types import NAACCRRecord

_LOGGER = logging.getLogger(__name__)


class NAACCRReadError(ValueError):
    """Raised when a NAACCR fixed-width line cannot be parsed.

    Sanitized per HIGHSEC §7 — patient names, DOBs, addresses MUST never
    appear in error messages.
    """


class _RedactingFilter(logging.Filter):
    """HIGHSEC §7: scrub patient identifiers from NAACCR log records.

    Mirrors Plans 1-3's pattern. The filter is broad — false positives
    in log output are acceptable; false negatives violate HIGHSEC §7.
    """

    # Common NAACCR patient-id shapes + 8-digit dates.
    _ID_TOKEN = re.compile(r"\b[A-Z0-9]{6,15}\b")

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            msg = record.getMessage()
        except Exception:  # pragma: no cover - defensive
            return True
        record.msg = self._ID_TOKEN.sub("***REDACTED***", msg)
        record.args = ()
        return True


def _extract(line: str, name: str) -> str:
    """Slice the column for ``name`` and strip trailing spaces."""
    col = COLUMNS[name]
    if len(line) < col.start + col.length:
        return ""
    return line[col.start : col.start + col.length].rstrip()


def _parse_date_field(value: str, *, name: str) -> date:
    if not value or len(value) != 8 or not value.isdigit():
        raise NAACCRReadError(f"invalid NAACCR date in {name}")
    try:
        return datetime.strptime(value, "%Y%m%d").date()
    except ValueError as exc:
        raise NAACCRReadError(f"unparseable NAACCR date in {name}") from exc


def _opt(value: str) -> str | None:
    """None for blank/empty, the stripped value otherwise."""
    return value if value else None


def _opt_date(value: str, *, name: str) -> date | None:
    if not value:
        return None
    return _parse_date_field(value, name=name)


class NAACCRReader:
    """Read a NAACCR fixed-width flat file."""

    type_name = "naaccr_reader"

    def __init__(self) -> None:
        self._filter = _RedactingFilter()
        if not any(isinstance(f, _RedactingFilter) for f in _LOGGER.filters):
            _LOGGER.addFilter(self._filter)

    def read(self, source: TextIO) -> list[NAACCRRecord]:
        """Parse ``source`` (TextIO yielding NAACCR fixed-width lines).

        Returns one ``NAACCRRecord`` per non-blank line. Raises
        ``NAACCRReadError`` on the first malformed line; we fail-closed
        for cancer-registry data because partial loads are operationally
        worse than a hard fail.
        """
        records: list[NAACCRRecord] = []
        for raw_line in self._iter_lines(source):
            if not raw_line.strip():
                continue
            try:
                records.append(self._parse_line(raw_line))
            except NAACCRReadError:
                raise
            except ValidationError as exc:
                raise NAACCRReadError("NAACCR record validation failed") from exc
        return records

    def _iter_lines(self, source: TextIO) -> Iterable[str]:
        # readlines() handles both '\n' and '\r\n' line endings; strip
        # the trailing newline so column offsets line up.
        for raw in source.readlines():
            yield raw.rstrip("\r\n")

    def _parse_line(self, line: str) -> NAACCRRecord:
        # Required fields ---------------------------------------------
        patient_id = _extract(line, "patient_id_number")
        tumor_no = _extract(line, "tumor_record_number")
        name_last = _extract(line, "name_last")
        name_first = _extract(line, "name_first")
        dob_raw = _extract(line, "date_of_birth")
        sex = _extract(line, "sex")
        race_1 = _extract(line, "race_1")
        hispanic = _extract(line, "spanish_hispanic_origin")
        primary_site = _extract(line, "primary_site")
        histology = _extract(line, "histologic_type_icdo3")
        behavior = _extract(line, "behavior_code_icdo3")
        dx_date_raw = _extract(line, "date_of_diagnosis")
        dx_confirm = _extract(line, "diagnostic_confirmation")

        # Optional ---------------------------------------------------
        grade = _opt(_extract(line, "grade"))
        ajcc_stage = _opt(_extract(line, "ajcc_stage_group"))
        ajcc_t = _opt(_extract(line, "ajcc_t"))
        ajcc_n = _opt(_extract(line, "ajcc_n"))
        ajcc_m = _opt(_extract(line, "ajcc_m"))
        rx_surgery = _opt(_extract(line, "rx_summary_surgery"))
        rx_chemo = _opt(_extract(line, "rx_summary_chemo"))
        rx_rad = _opt(_extract(line, "rx_summary_radiation"))
        rx_hormone = _opt(_extract(line, "rx_summary_hormone"))
        vital = _opt(_extract(line, "vital_status"))
        last_contact_raw = _extract(line, "date_of_last_contact")
        cause = _opt(_extract(line, "cause_of_death"))

        if not patient_id:
            raise NAACCRReadError("missing required NAACCR field patient_id_number")
        if not tumor_no:
            raise NAACCRReadError("missing required NAACCR field tumor_record_number")
        try:
            tumor_record_number = int(tumor_no)
        except ValueError as exc:
            raise NAACCRReadError("non-integer NAACCR tumor_record_number") from exc

        date_of_birth = _parse_date_field(dob_raw, name="date_of_birth")
        date_of_diagnosis = _parse_date_field(dx_date_raw, name="date_of_diagnosis")
        date_of_last_contact = _opt_date(last_contact_raw, name="date_of_last_contact")

        return NAACCRRecord(
            patient_id_number=patient_id,
            tumor_record_number=tumor_record_number,
            name_last=name_last,
            name_first=name_first,
            date_of_birth=date_of_birth,
            sex=sex,
            race_1=race_1,
            spanish_hispanic_origin=hispanic,
            primary_site=primary_site,
            histologic_type_icdo3=histology,
            behavior_code_icdo3=behavior,  # type: ignore[arg-type]
            grade=grade,
            date_of_diagnosis=date_of_diagnosis,
            diagnostic_confirmation=dx_confirm,
            ajcc_stage_group=ajcc_stage,
            ajcc_t=ajcc_t,
            ajcc_n=ajcc_n,
            ajcc_m=ajcc_m,
            rx_summary_surgery=rx_surgery,
            rx_summary_chemo=rx_chemo,
            rx_summary_radiation=rx_rad,
            rx_summary_hormone=rx_hormone,
            vital_status=vital,
            date_of_last_contact=date_of_last_contact,
            cause_of_death=cause,
        )


__all__ = ["NAACCRReadError", "NAACCRReader"]
