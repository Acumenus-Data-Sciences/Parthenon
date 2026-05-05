"""Consent -> OMOP OBSERVATION mapping + ConsentDecision side-channel.

Phase 1 policy: never silently drop a Consent. Malformed resources raise
``MalformedConsentError`` because losing a consent decision in the ETL is a
clinical/legal hazard.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from pydantic import BaseModel, ConfigDict

from runtime.fhir_to_omop.concept_resolver import ConceptResolver
from runtime.fhir_to_omop.errors import FhirToOmopError


class MalformedConsentError(FhirToOmopError):
    """Raised when a Consent resource is missing required fields or has invalid provision.type."""


class ConsentRow(BaseModel):
    model_config = ConfigDict(extra="forbid")
    observation_source_value: str
    person_source_value: str
    visit_source_value: str | None
    observation_concept_id: int
    observation_source_concept_id: int = 0
    observation_date: str
    observation_datetime: str | None
    # OMOP "Diagnostic Report" — Phase 2 may add a Consent-specific type concept.
    observation_type_concept_id: int = 32856


@dataclass(frozen=True)
class ConsentDecision:
    """Side-channel decision row for downstream cohort filtering."""

    person_source_value: str
    decision: str  # "permit" | "deny"
    consent_id: str


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


def map_consent(
    resource: dict[str, Any],
    resolver: ConceptResolver,
    *,
    permit_concept_id: int,
    deny_concept_id: int,
) -> tuple[ConsentRow, ConsentDecision]:
    if resource.get("resourceType") != "Consent":
        raise MalformedConsentError(f"expected Consent, got {resource.get('resourceType')!r}")
    person_source_value = _ref_id(resource.get("patient"))
    if not person_source_value:
        raise MalformedConsentError(
            f"Consent {resource.get('id')!r} missing or malformed patient reference"
        )

    provision = resource.get("provision") or {}
    ptype = provision.get("type")
    if ptype == "permit":
        concept_id = permit_concept_id
        decision_str = "permit"
    elif ptype == "deny":
        concept_id = deny_concept_id
        decision_str = "deny"
    else:
        raise MalformedConsentError(
            f"Consent {resource.get('id')!r} provision.type must be 'permit' or 'deny', "
            f"got {ptype!r}"
        )

    when = resource.get("dateTime")
    obs_date = _date_only(when) or "1970-01-01"
    obs_dt = str(when) if when and "T" in str(when) else None

    row = ConsentRow(
        observation_source_value=str(resource.get("id", "")),
        person_source_value=person_source_value,
        visit_source_value=None,  # Consent is patient-level, not encounter-level
        observation_concept_id=concept_id,
        observation_source_concept_id=concept_id,
        observation_date=obs_date,
        observation_datetime=obs_dt,
    )
    # ConceptResolver is unused here (provision.type drives the concept) but
    # kept in the signature so the manifest's PythonNode can pass the resolver
    # uniformly across all PR-C mappers.
    _ = resolver
    return row, ConsentDecision(
        person_source_value=person_source_value,
        decision=decision_str,
        consent_id=str(resource.get("id", "")),
    )
