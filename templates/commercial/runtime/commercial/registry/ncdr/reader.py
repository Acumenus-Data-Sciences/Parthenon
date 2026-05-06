"""NCDR CathPCI CSV reader — materializes ``NCDRRecord`` per PCI procedure.

Phase 3 Plan 4C Task 3 (T-022C). Same general shape as the STS reader
(Plan 4B) — CSV with header, semicolon-delimited list columns for the
lesion + stent fans. PHI handling mirrors Plans 1-3 + 4A + 4B.
"""

from __future__ import annotations

import csv
import logging
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import TextIO

from pydantic import ValidationError

from runtime.commercial.registry.ncdr.types import NCDRRecord

_LOGGER = logging.getLogger(__name__)


class NCDRReadError(ValueError):
    """Raised when an NCDR CSV row cannot be parsed.

    Sanitized per HIGHSEC §7 — patient_id, procedure_date, operator_npi
    MUST never appear in error messages.
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


def _parse_date(value: str) -> object:
    value = (value or "").strip()
    if len(value) != 8 or not value.isdigit():
        raise NCDRReadError("invalid NCDR date")
    try:
        return datetime.strptime(value, "%Y%m%d").date()
    except ValueError as exc:
        raise NCDRReadError("unparseable NCDR date") from exc


def _parse_int(value: str, *, name: str) -> int:
    try:
        return int(value)
    except ValueError as exc:
        raise NCDRReadError(f"non-integer NCDR field {name}") from exc


def _parse_decimal(value: str, *, name: str) -> Decimal:
    try:
        return Decimal(value)
    except (InvalidOperation, ValueError) as exc:
        raise NCDRReadError(f"non-numeric NCDR field {name}") from exc


def _parse_bool(value: str) -> bool:
    s = (value or "").strip().lower()
    if s in {"yes", "y", "1", "true"}:
        return True
    if s in {"no", "n", "0", "false", ""}:
        return False
    raise NCDRReadError(f"unparseable NCDR boolean: {value!r}")


def _parse_delimited(value: str) -> list[str]:
    if not value:
        return []
    return [v.strip() for v in value.split(";") if v.strip()]


class NCDRReader:
    """Read an NCDR CathPCI CSV export."""

    type_name = "ncdr_reader"

    def __init__(self) -> None:
        self._filter = _RedactingFilter()
        if not any(isinstance(f, _RedactingFilter) for f in _LOGGER.filters):
            _LOGGER.addFilter(self._filter)

    def read(self, source: TextIO) -> list[NCDRRecord]:
        reader = csv.DictReader(source)
        if reader.fieldnames is None:
            raise NCDRReadError("NCDR CSV is missing the header row")

        out: list[NCDRRecord] = []
        for row in reader:
            try:
                out.append(self._materialize(row))
            except NCDRReadError:
                raise
            except ValidationError as exc:
                raise NCDRReadError("NCDR record validation failed") from exc
        return out

    def _materialize(self, row: dict[str, str]) -> NCDRRecord:
        # Stent UDIs and stent types must align in length when both
        # populated — the column-map convention treats them as parallel
        # lists.
        udis = _parse_delimited(row.get("StentUDIs", ""))
        types_raw = _parse_delimited(row.get("StentTypes", ""))
        if udis and types_raw and len(udis) != len(types_raw):
            raise NCDRReadError(
                f"stent UDI / type list length mismatch: {len(udis)} vs {len(types_raw)}"
            )

        return NCDRRecord(
            record_id=row["PCIRecordID"].strip(),
            patient_id=row["PatientID"].strip(),
            procedure_date=_parse_date(row["ProcedureDate"]),  # type: ignore[arg-type]
            patient_age=_parse_int(row["PatientAge"], name="PatientAge"),
            gender=row["Gender"].strip(),  # type: ignore[arg-type]
            hospital_id=row["HospitalID"].strip(),
            operator_npi=row["OperatorNPI"].strip(),
            preop_diagnosis_icd10=row["PreOpDiagnosis"].strip(),
            ejection_fraction=_parse_decimal(
                row["HemodynamicEjectionFraction"], name="HemodynamicEjectionFraction"
            ),
            cardiac_index=_parse_decimal(
                row["HemodynamicCardiacIndex"], name="HemodynamicCardiacIndex"
            ),
            lesion_count=_parse_int(row["LesionCount"], name="LesionCount"),
            lesion_segments=_parse_delimited(row.get("LesionSegments", "")),
            primary_procedure_code=row["PrimaryProcedureCode"].strip(),
            stent_count=_parse_int(row["StentCount"], name="StentCount"),
            stent_udis=udis,
            stent_types=types_raw,  # type: ignore[arg-type]
            postop_bleeding=_parse_bool(row.get("PostOpComplication_Bleeding", "")),
            postop_aki=_parse_bool(row.get("PostOpComplication_AKI", "")),
            postop_stroke=_parse_bool(row.get("PostOpComplication_Stroke", "")),
            length_of_stay=_parse_int(row["LengthOfStay"], name="LengthOfStay"),
            mortality_in_hospital=_parse_bool(row.get("Mortality_InHospital", "")),
        )


__all__ = ["NCDRReadError", "NCDRReader"]
