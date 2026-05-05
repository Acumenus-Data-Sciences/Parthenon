"""Shared logic for PRO instrument templates.

Each instrument-specific manifest (EQ-5D-5L, EQ-5D-3L, PHQ-9, ...) defines
a ``ProInstrumentDefinition`` and uses ``parse_questionnaire_response`` to
project each FHIR ``QuestionnaireResponse.item`` to one OMOP MEASUREMENT row.

Devplan T-011 calls this the ``_shared/pro_base.yaml`` partial; in
implementation we keep the shared logic as a Python module — more testable,
no manifest-loader changes needed. Each PRO template's manifest invokes
this module from a PythonNode ``code:`` block.
"""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ConfigDict, Field


class ProBaseError(ValueError):
    """Raised when an instrument definition or QR shape is malformed."""


class ItemMapping(BaseModel):
    """One item in a PRO instrument: maps a FHIR linkId to an OMOP concept."""

    model_config = ConfigDict(extra="forbid")

    item_code: str = Field(min_length=1)
    measurement_concept_id: int = Field(ge=0)
    value_unit_concept_id: int = Field(default=8512)  # "score" by default
    value_as_concept_id: int | None = None
    description: str = ""


class ProInstrumentDefinition(BaseModel):
    """Per-instrument config: item mappings + optional VAS + utility lookup."""

    model_config = ConfigDict(extra="forbid")

    instrument_id: str = Field(min_length=1)
    items: list[ItemMapping]
    vas_item_code: str | None = None
    vas_measurement_concept_id: int | None = None
    vas_unit_concept_id: int = 8595  # "millimeter" — typical for VAS scales
    utility_index_lookup: str | None = None  # name of value-set CSV (Tasks 2/6)


@dataclass(frozen=True)
class MeasurementRow:
    """One row destined for omop.measurement.

    person_source_value carries the FHIR Patient reference; downstream
    cross-mapping resolves it to person_id (Phase 2 link template). For
    Phase 1 we leave person_id NULL.
    """

    person_source_value: str | None
    measurement_date: str  # ISO date, e.g. "2026-05-03"
    measurement_concept_id: int
    value_as_number: float | None
    value_as_concept_id: int | None
    unit_concept_id: int
    item_code: str
    measurement_source_value: str  # the FHIR linkId


def _extract_patient_ref(qr: dict[str, Any]) -> str | None:
    subject = qr.get("subject") or {}
    ref = subject.get("reference")
    if not ref:
        return None
    if "/" in ref:
        return str(ref.rsplit("/", 1)[-1])
    return str(ref)


def _extract_authored_date(qr: dict[str, Any]) -> str:
    authored = qr.get("authored") or qr.get("authoredOn") or ""
    return str(authored).split("T", 1)[0] if authored else "1970-01-01"


def _extract_value(answer_obj: dict[str, Any]) -> float | None:
    if "valueInteger" in answer_obj:
        return float(answer_obj["valueInteger"])
    if "valueDecimal" in answer_obj:
        return float(answer_obj["valueDecimal"])
    if "valueQuantity" in answer_obj:
        q = answer_obj["valueQuantity"]
        if "value" in q:
            return float(q["value"])
    return None


def parse_questionnaire_response(
    qr: dict[str, Any], definition: ProInstrumentDefinition
) -> Iterator[MeasurementRow]:
    """Yield one MeasurementRow per (item_code, answer) pair in the QR.

    Items not in the instrument definition are silently skipped.
    QRs without a subject reference yield rows with ``person_source_value=None``.
    """
    if qr.get("resourceType") != "QuestionnaireResponse":
        raise ProBaseError(
            f"expected resourceType=QuestionnaireResponse, got {qr.get('resourceType')!r}"
        )

    by_code = {item.item_code: item for item in definition.items}
    patient_ref = _extract_patient_ref(qr)
    measurement_date = _extract_authored_date(qr)

    for fhir_item in qr.get("item", []) or []:
        link_id = fhir_item.get("linkId")
        if not link_id:
            continue
        if (
            definition.vas_item_code
            and link_id == definition.vas_item_code
            and definition.vas_measurement_concept_id is not None
        ):
            for answer in fhir_item.get("answer", []) or []:
                value = _extract_value(answer)
                yield MeasurementRow(
                    person_source_value=patient_ref,
                    measurement_date=measurement_date,
                    measurement_concept_id=definition.vas_measurement_concept_id,
                    value_as_number=value,
                    value_as_concept_id=None,
                    unit_concept_id=definition.vas_unit_concept_id,
                    item_code=link_id,
                    measurement_source_value=link_id,
                )
            continue

        mapping = by_code.get(link_id)
        if mapping is None:
            continue
        for answer in fhir_item.get("answer", []) or []:
            value = _extract_value(answer)
            yield MeasurementRow(
                person_source_value=patient_ref,
                measurement_date=measurement_date,
                measurement_concept_id=mapping.measurement_concept_id,
                value_as_number=value,
                value_as_concept_id=mapping.value_as_concept_id,
                unit_concept_id=mapping.value_unit_concept_id,
                item_code=link_id,
                measurement_source_value=link_id,
            )
