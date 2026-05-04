"""Condition -> OMOP CONDITION_OCCURRENCE mapping."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict

from runtime.fhir_to_omop.concept_resolver import ConceptResolver


class ConditionRow(BaseModel):
    """One OMOP CONDITION_OCCURRENCE row."""

    model_config = ConfigDict(extra="forbid")

    condition_source_value: str
    person_source_value: str
    visit_source_value: str | None
    condition_concept_id: int
    condition_source_concept_id: int = 0
    condition_start_date: str
    condition_start_datetime: str | None
    condition_end_date: str | None
    condition_end_datetime: str | None
    condition_type_concept_id: int = 32817  # "EHR Condition" (OMOP standard)


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


def map_condition(resource: dict[str, Any], resolver: ConceptResolver) -> ConditionRow:
    if resource.get("resourceType") != "Condition":
        raise ValueError(f"expected Condition, got {resource.get('resourceType')!r}")

    person_source_value = _ref_id(resource.get("subject"))
    if not person_source_value:
        raise ValueError(f"Condition {resource.get('id')!r} missing subject reference")
    visit_source_value = _ref_id(resource.get("encounter"))

    coding_list = (resource.get("code") or {}).get("coding") or []
    condition_concept_id = 0
    condition_source_concept_id = 0
    for coding in coding_list:
        sys_ = coding.get("system")
        code = coding.get("code")
        if not (sys_ and code):
            continue
        cid = resolver.resolve(system=sys_, code=code)
        if cid != 0:
            condition_concept_id = cid
            condition_source_concept_id = cid
            break

    onset = resource.get("onsetDateTime")
    recorded = resource.get("recordedDate")
    start_iso = onset or recorded or "1970-01-01"
    abatement = resource.get("abatementDateTime")

    return ConditionRow(
        condition_source_value=str(resource.get("id", "")),
        person_source_value=person_source_value,
        visit_source_value=visit_source_value,
        condition_concept_id=condition_concept_id,
        condition_source_concept_id=condition_source_concept_id,
        condition_start_date=_date_only(start_iso) or "1970-01-01",
        condition_start_datetime=str(start_iso) if start_iso and "T" in str(start_iso) else None,
        condition_end_date=_date_only(abatement),
        condition_end_datetime=str(abatement) if abatement and "T" in str(abatement) else None,
    )
