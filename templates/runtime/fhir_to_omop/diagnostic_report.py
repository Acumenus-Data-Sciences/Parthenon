"""DiagnosticReport -> OMOP OBSERVATION (summary row, conclusion as value_as_string)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict

from runtime.fhir_to_omop.concept_resolver import ConceptResolver


class DiagnosticReportRow(BaseModel):
    """One OMOP OBSERVATION row summarizing a DiagnosticReport.

    The linked ``result[]`` Observations are mapped separately by the
    Observation mapper (Plan 5) — this row is the panel-level summary so
    cohort definitions can find "patient X had LDL panel".
    """

    model_config = ConfigDict(extra="forbid")
    observation_source_value: str
    person_source_value: str
    visit_source_value: str | None
    observation_concept_id: int
    observation_source_concept_id: int = 0
    observation_date: str
    observation_datetime: str | None
    value_as_string: str | None
    observation_type_concept_id: int = 32856  # OMOP "Diagnostic Report"


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


def map_diagnostic_report(
    resource: dict[str, Any], resolver: ConceptResolver
) -> DiagnosticReportRow:
    if resource.get("resourceType") != "DiagnosticReport":
        raise ValueError(f"expected DiagnosticReport, got {resource.get('resourceType')!r}")
    person_source_value = _ref_id(resource.get("subject"))
    if not person_source_value:
        raise ValueError(f"DiagnosticReport {resource.get('id')!r} missing subject")
    visit_source_value = _ref_id(resource.get("encounter"))

    coding_list = (resource.get("code") or {}).get("coding") or []
    cid = 0
    for coding in coding_list:
        sys_, code = coding.get("system"), coding.get("code")
        if sys_ and code:
            resolved = resolver.resolve(system=sys_, code=code)
            if resolved != 0:
                cid = resolved
                break

    when = resource.get("effectiveDateTime") or (resource.get("effectivePeriod") or {}).get("start")
    obs_date = _date_only(when) or "1970-01-01"
    obs_dt = str(when) if when and "T" in str(when) else None
    conclusion = resource.get("conclusion")

    return DiagnosticReportRow(
        observation_source_value=str(resource.get("id", "")),
        person_source_value=person_source_value,
        visit_source_value=visit_source_value,
        observation_concept_id=cid,
        observation_source_concept_id=cid,
        observation_date=obs_date,
        observation_datetime=obs_dt,
        value_as_string=conclusion,
    )
