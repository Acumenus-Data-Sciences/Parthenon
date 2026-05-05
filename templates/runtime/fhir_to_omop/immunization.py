"""Immunization -> OMOP DRUG_EXPOSURE mapping."""

from __future__ import annotations

from typing import Any

from runtime.fhir_to_omop.concept_resolver import ConceptResolver
from runtime.fhir_to_omop.medication import DrugExposureRow

DRUG_TYPE_IMMUNIZATION = 581452


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


def map_immunization(resource: dict[str, Any], resolver: ConceptResolver) -> DrugExposureRow:
    if resource.get("resourceType") != "Immunization":
        raise ValueError(f"expected Immunization, got {resource.get('resourceType')!r}")
    person_source_value = _ref_id(resource.get("patient"))
    if not person_source_value:
        raise ValueError(f"Immunization {resource.get('id')!r} missing patient")
    visit_source_value = _ref_id(resource.get("encounter"))
    coding_list = (resource.get("vaccineCode") or {}).get("coding") or []
    cid = 0
    for coding in coding_list:
        sys_, code = coding.get("system"), coding.get("code")
        if sys_ and code:
            resolved = resolver.resolve(system=sys_, code=code)
            if resolved != 0:
                cid = resolved
                break
    when = resource.get("occurrenceDateTime")
    return DrugExposureRow(
        drug_source_value=str(resource.get("id", "")),
        person_source_value=person_source_value,
        visit_source_value=visit_source_value,
        drug_concept_id=cid,
        drug_source_concept_id=cid,
        drug_exposure_start_date=_date_only(when) or "1970-01-01",
        drug_exposure_start_datetime=str(when) if when and "T" in str(when) else None,
        drug_exposure_end_date=None,
        drug_exposure_end_datetime=None,
        drug_type_concept_id=DRUG_TYPE_IMMUNIZATION,
    )
