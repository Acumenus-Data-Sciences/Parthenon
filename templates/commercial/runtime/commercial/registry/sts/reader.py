"""STS CSV reader — materializes ``STSRecord`` per surgery.

Phase 3 Plan 4B Task 3 (T-022B). STS National Database exports are
CSV files with column shapes defined by the v4.20.2 spec; the reader
parses each row per the column-map convention documented at
``templates/commercial/manifests/registry_to_omop_sts/column_map.csv``.

PHI handling: STS records contain patient-id + DOB (via age) + site
identifiers. The reader's logger uses ``_RedactingFilter`` mirroring
Plans 1-3 + 4A's pattern.

CSV input shape: header row required, one surgery per data row.
Diagnoses + procedure-codes columns hold semicolon-delimited lists
(STS export convention) for secondary entries.
"""

from __future__ import annotations

import csv
import logging
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import TextIO

from pydantic import ValidationError

from runtime.commercial.registry.sts.types import STSRecord

_LOGGER = logging.getLogger(__name__)


class STSReadError(ValueError):
    """Raised when an STS CSV row cannot be parsed.

    Sanitized per HIGHSEC §7 — patient_id, surgery_date, surgeon_id
    MUST never appear in error messages.
    """


class _RedactingFilter(logging.Filter):
    """HIGHSEC §7: scrub identifiers from STS log records."""

    _ID_TOKEN = re.compile(r"\b[A-Z0-9]{6,15}\b")

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            msg = record.getMessage()
        except Exception:  # pragma: no cover - defensive
            return True
        record.msg = self._ID_TOKEN.sub("***REDACTED***", msg)
        record.args = ()
        return True


def _parse_date(value: str) -> object:
    """STS dates are CCYYMMDD when 8 chars."""
    value = (value or "").strip()
    if len(value) != 8 or not value.isdigit():
        raise STSReadError("invalid STS date")
    try:
        return datetime.strptime(value, "%Y%m%d").date()
    except ValueError as exc:
        raise STSReadError("unparseable STS date") from exc


def _parse_int(value: str, *, name: str) -> int:
    try:
        return int(value)
    except ValueError as exc:
        raise STSReadError(f"non-integer STS field {name}") from exc


def _parse_decimal(value: str, *, name: str) -> Decimal:
    try:
        return Decimal(value)
    except (InvalidOperation, ValueError) as exc:
        raise STSReadError(f"non-numeric STS field {name}") from exc


def _parse_bool(value: str) -> bool:
    """STS booleans: 'yes'/'no' (case-insensitive) or '1'/'0'."""
    s = (value or "").strip().lower()
    if s in {"yes", "y", "1", "true"}:
        return True
    if s in {"no", "n", "0", "false", ""}:
        return False
    raise STSReadError(f"unparseable STS boolean: {value!r}")


def _parse_delimited(value: str) -> list[str]:
    """STS delimited lists are semicolon-separated."""
    if not value:
        return []
    return [v.strip() for v in value.split(";") if v.strip()]


class STSReader:
    """Read an STS CSV export."""

    type_name = "sts_reader"

    def __init__(self) -> None:
        self._filter = _RedactingFilter()
        if not any(isinstance(f, _RedactingFilter) for f in _LOGGER.filters):
            _LOGGER.addFilter(self._filter)

    def read(self, source: TextIO) -> list[STSRecord]:
        """Parse an STS CSV (header row required) into typed records."""
        reader = csv.DictReader(source)
        if reader.fieldnames is None:
            raise STSReadError("STS CSV is missing the header row")

        out: list[STSRecord] = []
        for row in reader:
            try:
                out.append(self._materialize(row))
            except STSReadError:
                raise
            except ValidationError as exc:
                raise STSReadError("STS record validation failed") from exc
        return out

    def _materialize(self, row: dict[str, str]) -> STSRecord:
        return STSRecord(
            record_id=row["RecordID"].strip(),
            patient_id=row["PatientID"].strip(),
            surgery_date=_parse_date(row["SurgeryDate"]),  # type: ignore[arg-type]
            patient_age=_parse_int(row["PatientAge"], name="PatientAge"),
            gender=row["Gender"].strip(),  # type: ignore[arg-type]
            hospital_id=row["HospitalID"].strip(),
            surgeon_id=row["SurgeonID"].strip(),
            ejection_fraction=_parse_decimal(row["EjectionFraction"], name="EjectionFraction"),
            nyha_class=_parse_int(row["NyhaClass"], name="NyhaClass"),
            primary_diagnosis_icd10=row["PrimaryDiagnosis"].strip(),
            secondary_diagnoses_icd10=_parse_delimited(row.get("SecondaryDiagnoses", "")),
            procedure_category=row["ProcedureID"].strip(),  # type: ignore[arg-type]
            primary_procedure_code=row["ProcedureCode_Primary"].strip(),
            secondary_procedure_codes=_parse_delimited(row.get("ProcedureCode_Secondary", "")),
            postop_aki=_parse_bool(row.get("PostOpComplication_AKI", "")),
            postop_stroke=_parse_bool(row.get("PostOpComplication_Stroke", "")),
            postop_reoperation=_parse_bool(row.get("PostOpComplication_Reoperation", "")),
            postop_sepsis=_parse_bool(row.get("PostOpComplication_Sepsis", "")),
            length_of_stay=_parse_int(row["LengthOfStay"], name="LengthOfStay"),
            discharge_disposition=row["DischargeDisposition"].strip(),
            mortality_30day=_parse_bool(row.get("Mortality_30Day", "")),
        )


__all__ = ["STSReadError", "STSReader"]
