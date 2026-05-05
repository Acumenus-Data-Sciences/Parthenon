"""Patient -> OMOP PERSON mapping."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict

from runtime.fhir_to_omop.concept_resolver import ConceptResolver

GENDER_CODE_MAP = {"male": "M", "female": "F", "other": "O", "unknown": "U"}

US_CORE_RACE_URL = "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race"
US_CORE_ETH_URL = "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity"


class PersonRow(BaseModel):
    """One OMOP PERSON row, ready to INSERT."""

    model_config = ConfigDict(extra="forbid")

    person_source_value: str
    gender_concept_id: int
    year_of_birth: int | None
    month_of_birth: int | None
    day_of_birth: int | None
    birth_datetime: str | None
    race_concept_id: int = 0
    ethnicity_concept_id: int = 0


def _parse_birth_date(
    value: str | None,
) -> tuple[int | None, int | None, int | None, str | None]:
    """Return (year, month, day, ISO datetime) from a FHIR birthDate."""
    if not value:
        return None, None, None, None
    parts = str(value).split("-")
    year = int(parts[0]) if len(parts) >= 1 and parts[0] else None
    month = int(parts[1]) if len(parts) >= 2 and parts[1] else None
    day = int(parts[2]) if len(parts) >= 3 and parts[2] else None
    dt = f"{year:04d}-{month:02d}-{day:02d}T00:00:00" if (year and month and day) else None
    return year, month, day, dt


def _extract_omb_code(ext_block: dict[str, Any]) -> tuple[str | None, str | None]:
    """Extract (system, code) from a US Core race/ethnicity extension."""
    for sub in ext_block.get("extension", []) or []:
        if sub.get("url") == "ombCategory":
            coding = sub.get("valueCoding") or {}
            return coding.get("system"), coding.get("code")
    return None, None


def map_patient(resource: dict[str, Any], resolver: ConceptResolver) -> PersonRow:
    """Project a FHIR Patient to a PersonRow."""
    if resource.get("resourceType") != "Patient":
        raise ValueError(f"expected Patient, got {resource.get('resourceType')!r}")

    gender_fhir = (resource.get("gender") or "").lower()
    gender_code = GENDER_CODE_MAP.get(gender_fhir)
    gender_concept_id = (
        resolver.resolve(system="http://hl7.org/fhir/administrative-gender", code=gender_code)
        if gender_code
        else 0
    )

    year, month, day, birth_dt = _parse_birth_date(resource.get("birthDate"))

    # The OMB OID urn:oid:2.16.840.1.113883.6.238 is used for both Race AND
    # Ethnicity codings, so we cannot disambiguate by system URI alone. Instead,
    # we route by which extension URL declared the coding — Race extension
    # always lookups in the Race vocabulary, Ethnicity extension always in
    # the Ethnicity vocabulary.
    race_concept_id = 0
    ethnicity_concept_id = 0
    for ext in resource.get("extension", []) or []:
        if ext.get("url") == US_CORE_RACE_URL:
            _, code = _extract_omb_code(ext)
            if code:
                race_concept_id = resolver.resolve_with_vocabulary(vocabulary_id="Race", code=code)
        elif ext.get("url") == US_CORE_ETH_URL:
            _, code = _extract_omb_code(ext)
            if code:
                ethnicity_concept_id = resolver.resolve_with_vocabulary(
                    vocabulary_id="Ethnicity", code=code
                )

    return PersonRow(
        person_source_value=str(resource.get("id", "")),
        gender_concept_id=gender_concept_id,
        year_of_birth=year,
        month_of_birth=month,
        day_of_birth=day,
        birth_datetime=birth_dt,
        race_concept_id=race_concept_id,
        ethnicity_concept_id=ethnicity_concept_id,
    )
