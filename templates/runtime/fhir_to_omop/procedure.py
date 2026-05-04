"""Procedure -> OMOP PROCEDURE_OCCURRENCE mapping."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict

from runtime.fhir_to_omop.concept_resolver import ConceptResolver


class ProcedureRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    procedure_source_value: str
    person_source_value: str
    visit_source_value: str | None
    procedure_concept_id: int
    procedure_source_concept_id: int = 0
    procedure_date: str
    procedure_datetime: str | None
    procedure_type_concept_id: int = 32817  # "EHR Procedure"


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


def map_procedure(resource: dict[str, Any], resolver: ConceptResolver) -> ProcedureRow:
    if resource.get("resourceType") != "Procedure":
        raise ValueError(f"expected Procedure, got {resource.get('resourceType')!r}")
    person_source_value = _ref_id(resource.get("subject"))
    if not person_source_value:
        raise ValueError(f"Procedure {resource.get('id')!r} missing subject")
    visit_source_value = _ref_id(resource.get("encounter"))

    coding_list = (resource.get("code") or {}).get("coding") or []
    proc_concept_id = 0
    for coding in coding_list:
        sys_, code = coding.get("system"), coding.get("code")
        if sys_ and code:
            cid = resolver.resolve(system=sys_, code=code)
            if cid != 0:
                proc_concept_id = cid
                break

    when = resource.get("performedDateTime") or (resource.get("performedPeriod") or {}).get(
        "start"
    )
    proc_date = _date_only(when) or "1970-01-01"
    proc_dt = str(when) if when and "T" in str(when) else None

    return ProcedureRow(
        procedure_source_value=str(resource.get("id", "")),
        person_source_value=person_source_value,
        visit_source_value=visit_source_value,
        procedure_concept_id=proc_concept_id,
        procedure_source_concept_id=proc_concept_id,
        procedure_date=proc_date,
        procedure_datetime=proc_dt,
    )
