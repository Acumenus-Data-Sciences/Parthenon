"""Observation -> OMOP MEASUREMENT or OBSERVATION (split by FHIR category)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict

from runtime.fhir_to_omop.concept_resolver import ConceptResolver, _ig_snapshot


class MeasurementRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    measurement_source_value: str
    person_source_value: str
    visit_source_value: str | None
    measurement_concept_id: int
    measurement_source_concept_id: int = 0
    measurement_date: str
    measurement_datetime: str | None
    value_as_number: float | None
    unit_concept_id: int = 0
    measurement_type_concept_id: int = 32817


class ObservationRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    observation_source_value: str
    person_source_value: str
    visit_source_value: str | None
    observation_concept_id: int
    observation_source_concept_id: int = 0
    observation_date: str
    observation_datetime: str | None
    value_as_number: float | None
    value_as_string: str | None
    value_as_concept_id: int = 0
    observation_type_concept_id: int = 32817


def _date_only(iso: str | None) -> str | None:
    if not iso:
        return None
    return str(iso).split("T", 1)[0]


def _ref_id(ref: dict[str, Any] | None) -> str | None:
    if not ref:
        return None
    s = ref.get("reference") or ""
    if "/" in s:
        return s.rsplit("/", 1)[-1]
    return s or None


def _routes_to_measurement(resource: dict[str, Any]) -> bool:
    measurement_categories = set(
        _ig_snapshot().get("observation_split_to_measurement_when_categories", []) or []
    )
    for cat in resource.get("category", []) or []:
        for coding in cat.get("coding", []) or []:
            if coding.get("code") in measurement_categories:
                return True
    return False


def map_observation(
    resource: dict[str, Any], resolver: ConceptResolver
) -> MeasurementRow | ObservationRow:
    if resource.get("resourceType") != "Observation":
        raise ValueError(f"expected Observation, got {resource.get('resourceType')!r}")

    person_source_value = _ref_id(resource.get("subject"))
    if not person_source_value:
        raise ValueError(f"Observation {resource.get('id')!r} missing subject reference")
    visit_source_value = _ref_id(resource.get("encounter"))

    code_coding_list = (resource.get("code") or {}).get("coding") or []
    concept_id = 0
    for coding in code_coding_list:
        sys_ = coding.get("system")
        code = coding.get("code")
        if not (sys_ and code):
            continue
        cid = resolver.resolve(system=sys_, code=code)
        if cid != 0:
            concept_id = cid
            break

    eff = resource.get("effectiveDateTime") or (resource.get("effectivePeriod") or {}).get("start")
    obs_date = _date_only(eff) or "1970-01-01"
    obs_dt = str(eff) if eff and "T" in str(eff) else None

    val_qty = resource.get("valueQuantity") or {}
    value_as_number = float(val_qty["value"]) if val_qty and "value" in val_qty else None
    value_as_string = resource.get("valueString")

    if _routes_to_measurement(resource):
        return MeasurementRow(
            measurement_source_value=str(resource.get("id", "")),
            person_source_value=person_source_value,
            visit_source_value=visit_source_value,
            measurement_concept_id=concept_id,
            measurement_source_concept_id=concept_id,
            measurement_date=obs_date,
            measurement_datetime=obs_dt,
            value_as_number=value_as_number,
        )
    return ObservationRow(
        observation_source_value=str(resource.get("id", "")),
        person_source_value=person_source_value,
        visit_source_value=visit_source_value,
        observation_concept_id=concept_id,
        observation_source_concept_id=concept_id,
        observation_date=obs_date,
        observation_datetime=obs_dt,
        value_as_number=value_as_number,
        value_as_string=value_as_string,
    )
