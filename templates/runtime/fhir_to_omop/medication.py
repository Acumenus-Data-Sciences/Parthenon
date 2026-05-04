"""MedicationRequest/Statement/Administration -> OMOP DRUG_EXPOSURE mapping.

The three FHIR resources differ in timing semantics and source-of-truth:
  - Request: prescription (intent to dispense), authoredOn -> start
  - Statement: patient-reported use, effectivePeriod -> start/end
  - Administration: actual administration event, effectiveDateTime -> start

All three map to OMOP's DRUG_EXPOSURE table with different drug_type_concept_id:
  - Request:        32839       — "EHR prescription"
  - Statement:      38000179    — "Patient self-reported medication"
  - Administration: 38000180    — "Inpatient administration"
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict

from runtime.fhir_to_omop.concept_resolver import ConceptResolver

DRUG_TYPE_REQUEST = 32839
DRUG_TYPE_STATEMENT = 38000179
DRUG_TYPE_ADMIN = 38000180


class DrugExposureRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    drug_source_value: str
    person_source_value: str
    visit_source_value: str | None
    drug_concept_id: int
    drug_source_concept_id: int = 0
    drug_exposure_start_date: str
    drug_exposure_start_datetime: str | None
    drug_exposure_end_date: str | None
    drug_exposure_end_datetime: str | None
    drug_type_concept_id: int


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


def _resolve_medication_concept(resource: dict[str, Any], resolver: ConceptResolver) -> int:
    """Resolve a medication concept from medicationCodeableConcept.

    medicationReference (pointing at a separate Medication resource) is not
    supported in Phase 1 — surface as 0; PR-C may add the lookup once
    Medication-resource ingestion is in scope.
    """
    cc = resource.get("medicationCodeableConcept") or {}
    for coding in cc.get("coding", []) or []:
        sys_, code = coding.get("system"), coding.get("code")
        if sys_ and code:
            cid = resolver.resolve(system=sys_, code=code)
            if cid != 0:
                return cid
    return 0


def _build_row(
    resource: dict[str, Any],
    resolver: ConceptResolver,
    *,
    encounter_field: str,
    drug_type_concept_id: int,
    start_value: str | None,
    end_value: str | None,
) -> DrugExposureRow:
    person_source_value = _ref_id(resource.get("subject"))
    if not person_source_value:
        raise ValueError(f"{resource.get('resourceType')} {resource.get('id')!r} missing subject")
    visit_source_value = _ref_id(resource.get(encounter_field))
    drug_cid = _resolve_medication_concept(resource, resolver)
    return DrugExposureRow(
        drug_source_value=str(resource.get("id", "")),
        person_source_value=person_source_value,
        visit_source_value=visit_source_value,
        drug_concept_id=drug_cid,
        drug_source_concept_id=drug_cid,
        drug_exposure_start_date=_date_only(start_value) or "1970-01-01",
        drug_exposure_start_datetime=(
            str(start_value) if start_value and "T" in str(start_value) else None
        ),
        drug_exposure_end_date=_date_only(end_value),
        drug_exposure_end_datetime=(
            str(end_value) if end_value and "T" in str(end_value) else None
        ),
        drug_type_concept_id=drug_type_concept_id,
    )


def map_medication_request(resource: dict[str, Any], resolver: ConceptResolver) -> DrugExposureRow:
    if resource.get("resourceType") != "MedicationRequest":
        raise ValueError(f"expected MedicationRequest, got {resource.get('resourceType')!r}")
    return _build_row(
        resource,
        resolver,
        encounter_field="encounter",
        drug_type_concept_id=DRUG_TYPE_REQUEST,
        start_value=resource.get("authoredOn"),
        end_value=None,
    )


def map_medication_statement(
    resource: dict[str, Any], resolver: ConceptResolver
) -> DrugExposureRow:
    if resource.get("resourceType") != "MedicationStatement":
        raise ValueError(f"expected MedicationStatement, got {resource.get('resourceType')!r}")
    period = resource.get("effectivePeriod") or {}
    start = period.get("start") or resource.get("effectiveDateTime")
    end = period.get("end")
    return _build_row(
        resource,
        resolver,
        encounter_field="context",
        drug_type_concept_id=DRUG_TYPE_STATEMENT,
        start_value=start,
        end_value=end,
    )


def map_medication_administration(
    resource: dict[str, Any], resolver: ConceptResolver
) -> DrugExposureRow:
    if resource.get("resourceType") != "MedicationAdministration":
        raise ValueError(f"expected MedicationAdministration, got {resource.get('resourceType')!r}")
    period = resource.get("effectivePeriod") or {}
    start = resource.get("effectiveDateTime") or period.get("start")
    end = period.get("end")
    return _build_row(
        resource,
        resolver,
        encounter_field="context",
        drug_type_concept_id=DRUG_TYPE_ADMIN,
        start_value=start,
        end_value=end,
    )
