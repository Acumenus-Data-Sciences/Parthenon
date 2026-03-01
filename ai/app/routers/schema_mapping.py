"""Schema mapping router — rule-based column-to-CDM mapping suggestions.

Provides an endpoint for suggesting CDM table/column mappings based on
source column names using pattern matching heuristics.
"""

import logging
import re
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()


# ------------------------------------------------------------------ #
#  Request / Response models
# ------------------------------------------------------------------ #


class ColumnInfo(BaseModel):
    source_table: str
    column_name: str
    inferred_type: str | None = None
    sample_values: list[str] | None = None


class SchemaMappingRequest(BaseModel):
    columns: list[ColumnInfo]


class MappingSuggestion(BaseModel):
    source_table: str
    source_column: str
    cdm_table: str | None = None
    cdm_column: str | None = None
    confidence: float = 0.0
    mapping_logic: str = "direct"


class SchemaMappingResponse(BaseModel):
    suggestions: list[MappingSuggestion]


# ------------------------------------------------------------------ #
#  Pattern rules: (regex, cdm_table, cdm_column, confidence, logic)
# ------------------------------------------------------------------ #

_PATTERNS: list[tuple[str, str, str, float, str]] = [
    # Person identifiers
    (r"(?i)^(patient_id|pat_id|person_id|subject_id|mrn|medical_record)$", "person", "person_source_value", 0.90, "direct"),
    (r"(?i)(patient|person|subject).*id", "person", "person_source_value", 0.75, "direct"),

    # Demographics
    (r"(?i)^(gender|sex)$", "person", "gender_source_value", 0.90, "direct"),
    (r"(?i)^(gender|sex).*code$", "person", "gender_source_value", 0.85, "direct"),
    (r"(?i)^(year_of_birth|birth_year|yob)$", "person", "year_of_birth", 0.95, "direct"),
    (r"(?i)^(month_of_birth|birth_month|mob)$", "person", "month_of_birth", 0.90, "direct"),
    (r"(?i)^(day_of_birth|birth_day|dob_day)$", "person", "day_of_birth", 0.90, "direct"),
    (r"(?i)^(date_of_birth|dob|birth_date|birthdate)$", "person", "birth_datetime", 0.85, "transform"),
    (r"(?i)^race$", "person", "race_source_value", 0.90, "direct"),
    (r"(?i)^(ethnicity|ethnic)$", "person", "ethnicity_source_value", 0.90, "direct"),

    # Condition / Diagnosis
    (r"(?i)^(diagnosis_code|diag_code|dx_code|icd_code|icd10|icd9)$", "condition_occurrence", "condition_source_value", 0.90, "direct"),
    (r"(?i)(diagnosis|condition|dx).*code", "condition_occurrence", "condition_source_value", 0.80, "direct"),
    (r"(?i)^(diagnosis_date|diag_date|dx_date|condition_date)$", "condition_occurrence", "condition_start_date", 0.85, "direct"),
    (r"(?i)(diagnosis|condition|dx).*start.*date", "condition_occurrence", "condition_start_date", 0.80, "direct"),
    (r"(?i)(diagnosis|condition|dx).*end.*date", "condition_occurrence", "condition_end_date", 0.80, "direct"),

    # Drug / Medication
    (r"(?i)^(drug_code|medication_code|med_code|ndc|ndc_code|rx_code)$", "drug_exposure", "drug_source_value", 0.90, "direct"),
    (r"(?i)(drug|medication|med|rx).*code", "drug_exposure", "drug_source_value", 0.80, "direct"),
    (r"(?i)^(drug_name|medication_name|med_name)$", "drug_exposure", "drug_source_value", 0.75, "direct"),
    (r"(?i)(drug|medication|med).*start.*date", "drug_exposure", "drug_exposure_start_date", 0.80, "direct"),
    (r"(?i)(drug|medication|med).*end.*date", "drug_exposure", "drug_exposure_end_date", 0.80, "direct"),
    (r"(?i)^(prescription_date|rx_date|med_date)$", "drug_exposure", "drug_exposure_start_date", 0.80, "direct"),
    (r"(?i)^(days_supply|supply_days)$", "drug_exposure", "days_supply", 0.90, "direct"),
    (r"(?i)^(quantity|qty|drug_quantity)$", "drug_exposure", "quantity", 0.75, "direct"),
    (r"(?i)^(refills|num_refills)$", "drug_exposure", "refills", 0.90, "direct"),
    (r"(?i)^(route|admin_route|route_of_admin)$", "drug_exposure", "route_source_value", 0.85, "direct"),
    (r"(?i)^(dose_unit|dosage_unit)$", "drug_exposure", "dose_unit_source_value", 0.85, "direct"),
    (r"(?i)^(sig|directions|instructions)$", "drug_exposure", "sig", 0.80, "direct"),

    # Procedure
    (r"(?i)^(procedure_code|proc_code|cpt_code|cpt|hcpcs)$", "procedure_occurrence", "procedure_source_value", 0.90, "direct"),
    (r"(?i)(procedure|proc).*code", "procedure_occurrence", "procedure_source_value", 0.80, "direct"),
    (r"(?i)^(procedure_date|proc_date|surgery_date)$", "procedure_occurrence", "procedure_date", 0.85, "direct"),
    (r"(?i)(procedure|proc).*date", "procedure_occurrence", "procedure_date", 0.75, "direct"),

    # Measurement / Lab
    (r"(?i)^(lab_code|loinc|loinc_code|test_code)$", "measurement", "measurement_source_value", 0.90, "direct"),
    (r"(?i)(lab|test|measurement).*code", "measurement", "measurement_source_value", 0.80, "direct"),
    (r"(?i)^(lab_name|test_name|measurement_name)$", "measurement", "measurement_source_value", 0.75, "direct"),
    (r"(?i)^(result_value|lab_value|test_result|value|result_numeric)$", "measurement", "value_as_number", 0.80, "direct"),
    (r"(?i)^(result_unit|lab_unit|unit|units)$", "measurement", "unit_source_value", 0.85, "direct"),
    (r"(?i)^(lab_date|test_date|measurement_date|result_date)$", "measurement", "measurement_date", 0.85, "direct"),
    (r"(?i)^(range_low|ref_range_low|normal_low)$", "measurement", "range_low", 0.85, "direct"),
    (r"(?i)^(range_high|ref_range_high|normal_high)$", "measurement", "range_high", 0.85, "direct"),

    # Observation
    (r"(?i)^(observation_code|obs_code)$", "observation", "observation_source_value", 0.85, "direct"),
    (r"(?i)^(observation_date|obs_date)$", "observation", "observation_date", 0.85, "direct"),
    (r"(?i)^(observation_value|obs_value)$", "observation", "value_as_string", 0.80, "direct"),

    # Visit
    (r"(?i)^(visit_id|encounter_id|enc_id|admission_id)$", "visit_occurrence", "visit_source_value", 0.85, "direct"),
    (r"(?i)^(visit_type|encounter_type|visit_class)$", "visit_occurrence", "visit_source_value", 0.75, "direct"),
    (r"(?i)^(admit_date|admission_date|visit_start|encounter_date|visit_date)$", "visit_occurrence", "visit_start_date", 0.85, "direct"),
    (r"(?i)^(discharge_date|visit_end|visit_end_date)$", "visit_occurrence", "visit_end_date", 0.85, "direct"),
    (r"(?i)^(admitted_from|admit_source)$", "visit_occurrence", "admitted_from_source_value", 0.80, "direct"),
    (r"(?i)^(discharged_to|discharge_disposition)$", "visit_occurrence", "discharged_to_source_value", 0.80, "direct"),

    # Provider
    (r"(?i)^(provider_id|attending_id|physician_id|doctor_id)$", "person", "provider_id", 0.70, "lookup"),
]


# ------------------------------------------------------------------ #
#  Endpoint
# ------------------------------------------------------------------ #


@router.post("/suggest", response_model=SchemaMappingResponse)
async def suggest_schema_mapping(
    request: SchemaMappingRequest,
) -> SchemaMappingResponse:
    """Suggest CDM table/column mappings for source columns.

    Uses rule-based pattern matching on column names to produce
    mapping suggestions with confidence scores.
    """
    suggestions: list[MappingSuggestion] = []

    for col in request.columns:
        best_match = _find_best_match(col)
        suggestions.append(best_match)

    return SchemaMappingResponse(suggestions=suggestions)


def _find_best_match(col: ColumnInfo) -> MappingSuggestion:
    """Find the best matching CDM column for a source column."""
    best: MappingSuggestion | None = None

    for pattern, cdm_table, cdm_column, confidence, logic in _PATTERNS:
        if re.search(pattern, col.column_name):
            suggestion = MappingSuggestion(
                source_table=col.source_table,
                source_column=col.column_name,
                cdm_table=cdm_table,
                cdm_column=cdm_column,
                confidence=confidence,
                mapping_logic=logic,
            )
            if best is None or suggestion.confidence > best.confidence:
                best = suggestion

    if best is not None:
        return best

    # No pattern match — return unmapped suggestion
    return MappingSuggestion(
        source_table=col.source_table,
        source_column=col.column_name,
        cdm_table=None,
        cdm_column=None,
        confidence=0.0,
        mapping_logic="direct",
    )
