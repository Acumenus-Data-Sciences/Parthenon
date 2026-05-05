"""Encounter -> OMOP VISIT_OCCURRENCE mapping."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict

from runtime.fhir_to_omop.concept_resolver import ConceptResolver, _ig_snapshot


class VisitRow(BaseModel):
    """One OMOP VISIT_OCCURRENCE row, ready to INSERT (after person_id resolution)."""

    model_config = ConfigDict(extra="forbid")

    visit_source_value: str
    person_source_value: str
    visit_concept_id: int
    visit_start_date: str
    visit_start_datetime: str | None
    visit_end_date: str
    visit_end_datetime: str | None
    visit_source_concept_id: int = 0
    visit_type_concept_id: int = 32035  # "Visit derived from EHR" (OMOP standard)


def _date_only(iso: str | None) -> str | None:
    if not iso:
        return None
    return str(iso).split("T", 1)[0]


def map_encounter(resource: dict[str, Any], resolver: ConceptResolver) -> VisitRow:
    """Project a FHIR Encounter to a VisitRow."""
    if resource.get("resourceType") != "Encounter":
        raise ValueError(f"expected Encounter, got {resource.get('resourceType')!r}")

    subject = resource.get("subject") or {}
    ref = subject.get("reference") or ""
    if "/" not in ref:
        raise ValueError(f"Encounter {resource.get('id')!r} missing or malformed subject reference")
    person_source_value = ref.rsplit("/", 1)[-1]

    cls = resource.get("class") or {}
    cls_code = str(cls.get("code", ""))
    class_map = _ig_snapshot().get("encounter_class_to_visit_concept", {}) or {}
    visit_concept_id = int(class_map.get(cls_code, 0))

    period = resource.get("period") or {}
    start = period.get("start")
    end = period.get("end") or start
    visit_start_date = _date_only(start) or "1970-01-01"
    visit_end_date = _date_only(end) or visit_start_date

    visit_source_concept_id = 0
    types = resource.get("type") or []
    if types:
        codings = types[0].get("coding") or []
        if codings:
            sys_ = codings[0].get("system")
            code = codings[0].get("code")
            if sys_ and code:
                visit_source_concept_id = resolver.resolve(system=sys_, code=code)

    return VisitRow(
        visit_source_value=str(resource.get("id", "")),
        person_source_value=person_source_value,
        visit_concept_id=visit_concept_id,
        visit_start_date=visit_start_date,
        visit_start_datetime=str(start) if start and "T" in str(start) else None,
        visit_end_date=visit_end_date,
        visit_end_datetime=str(end) if end and "T" in str(end) else None,
        visit_source_concept_id=visit_source_concept_id,
    )
