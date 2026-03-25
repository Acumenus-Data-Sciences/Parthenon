#!/usr/bin/env python3
"""
Generate OMOP CDM v5.4 schema definition files for Parthenon Aqueduct ETL Mapping Designer.

Fetches the official OHDSI CDM v5.4 CSV specs from GitHub. If the fetch fails,
falls back to hardcoded core table definitions.

Outputs:
  - frontend/src/features/etl/lib/cdm-schema-v54.ts
  - backend/config/cdm-schema-v54.php
"""

import csv
import io
import json
import os
import sys
import urllib.request
from collections import OrderedDict
from typing import Any

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

TABLE_CSV_URL = (
    "https://raw.githubusercontent.com/OHDSI/CommonDataModel/v5.4"
    "/inst/csv/OMOP_CDMv5.4_Table_Level.csv"
)
FIELD_CSV_URL = (
    "https://raw.githubusercontent.com/OHDSI/CommonDataModel/v5.4"
    "/inst/csv/OMOP_CDMv5.4_Field_Level.csv"
)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
TS_OUTPUT = os.path.join(
    PROJECT_ROOT, "frontend", "src", "features", "etl", "lib", "cdm-schema-v54.ts"
)
PHP_OUTPUT = os.path.join(PROJECT_ROOT, "backend", "config", "cdm-schema-v54.php")

# Domain mapping: table name -> domain label
DOMAIN_MAP: dict[str, str] = {
    "person": "Person",
    "visit_occurrence": "Visit",
    "visit_detail": "Visit",
    "condition_occurrence": "Condition",
    "condition_era": "Condition",
    "drug_exposure": "Drug",
    "drug_era": "Drug",
    "dose_era": "Drug",
    "drug_strength": "Drug",
    "procedure_occurrence": "Procedure",
    "measurement": "Measurement",
    "observation": "Observation",
    "observation_period": "Observation",
    "device_exposure": "Device",
    "death": "Death",
    "note": "Note",
    "note_nlp": "Note",
    "specimen": "Specimen",
    "cost": "Cost",
    "payer_plan_period": "Cost",
    "location": "Location",
    "care_site": "Location",
    "provider": "Location",
    "concept": "Vocabulary",
    "vocabulary": "Vocabulary",
    "domain": "Vocabulary",
    "concept_class": "Vocabulary",
    "concept_relationship": "Vocabulary",
    "relationship": "Vocabulary",
    "concept_synonym": "Vocabulary",
    "concept_ancestor": "Vocabulary",
    "cohort": "Cohort",
    "cohort_definition": "Cohort",
}


# ---------------------------------------------------------------------------
# Data fetching
# ---------------------------------------------------------------------------


def fetch_csv(url: str) -> list[dict[str, str]]:
    """Fetch a CSV from a URL and return list of row dicts."""
    print(f"  Fetching {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "Parthenon-CDM-Generator/1.0"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        text = resp.read().decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text))
    return list(reader)


def normalize_type(raw: str) -> str:
    """Normalize CDM datatype strings to simple type names."""
    raw = raw.strip().lower()
    if raw.startswith("integer") or raw == "bigint":
        return "integer"
    if raw.startswith("float") or raw == "numeric" or raw.startswith("numeric"):
        return "float"
    if raw.startswith("varchar") or raw == "text" or raw.startswith("character varying"):
        return "varchar"
    if raw == "date":
        return "date"
    if raw.startswith("datetime") or raw.startswith("timestamp"):
        return "datetime"
    return raw if raw else "varchar"


def parse_fields(rows: list[dict[str, str]]) -> dict[str, list[dict[str, Any]]]:
    """Parse field-level CSV rows into a dict of table_name -> columns."""
    tables: dict[str, list[dict[str, Any]]] = OrderedDict()
    for row in rows:
        table = row.get("cdmTableName", "").strip().lower()
        field = row.get("cdmFieldName", "").strip().lower()
        if not table or not field:
            continue
        required_raw = row.get("isRequired", "No").strip()
        required = required_raw.upper() in ("YES", "TRUE", "1")
        dtype = normalize_type(row.get("cdmDatatype", "varchar"))
        description = row.get("userGuidance", "").strip()
        if not description:
            description = row.get("etlConventions", "").strip()
        # Truncate very long descriptions
        if len(description) > 300:
            description = description[:297] + "..."

        col = {
            "name": field,
            "type": dtype,
            "required": required,
            "description": description,
        }
        tables.setdefault(table, []).append(col)
    return tables


# ---------------------------------------------------------------------------
# Hardcoded fallback (core clinical tables only)
# ---------------------------------------------------------------------------

FALLBACK_TABLES: dict[str, list[dict[str, Any]]] = OrderedDict(
    [
        (
            "person",
            [
                {"name": "person_id", "type": "integer", "required": True, "description": "A unique identifier for each person."},
                {"name": "gender_concept_id", "type": "integer", "required": True, "description": "A foreign key that refers to an identifier in the CONCEPT table for the unique gender of the person."},
                {"name": "year_of_birth", "type": "integer", "required": True, "description": "The year of birth of the person."},
                {"name": "month_of_birth", "type": "integer", "required": False, "description": "The month of birth of the person."},
                {"name": "day_of_birth", "type": "integer", "required": False, "description": "The day of the month of birth of the person."},
                {"name": "birth_datetime", "type": "datetime", "required": False, "description": "The date and time of birth of the person."},
                {"name": "race_concept_id", "type": "integer", "required": True, "description": "A foreign key that refers to an identifier in the CONCEPT table for the unique race of the person."},
                {"name": "ethnicity_concept_id", "type": "integer", "required": True, "description": "A foreign key that refers to the standard concept identifier in the Standardized Vocabularies for the ethnicity of the person."},
                {"name": "location_id", "type": "integer", "required": False, "description": "A foreign key to the place of residency for the person in the location table."},
                {"name": "provider_id", "type": "integer", "required": False, "description": "A foreign key to the primary care provider the person is seeing in the provider table."},
                {"name": "care_site_id", "type": "integer", "required": False, "description": "A foreign key to the site of primary care in the care_site table."},
                {"name": "person_source_value", "type": "varchar", "required": False, "description": "An encrypted key derived from the person identifier in the source data."},
                {"name": "gender_source_value", "type": "varchar", "required": False, "description": "The source code for the gender of the person as it appears in the source data."},
                {"name": "gender_source_concept_id", "type": "integer", "required": False, "description": "A foreign key to the gender concept that refers to the code used in the source."},
                {"name": "race_source_value", "type": "varchar", "required": False, "description": "The source code for the race of the person as it appears in the source data."},
                {"name": "race_source_concept_id", "type": "integer", "required": False, "description": "A foreign key to the race concept that refers to the code used in the source."},
                {"name": "ethnicity_source_value", "type": "varchar", "required": False, "description": "The source code for the ethnicity of the person as it appears in the source data."},
                {"name": "ethnicity_source_concept_id", "type": "integer", "required": False, "description": "A foreign key to the ethnicity concept that refers to the code used in the source."},
            ],
        ),
        (
            "observation_period",
            [
                {"name": "observation_period_id", "type": "integer", "required": True, "description": "A unique identifier for each observation period."},
                {"name": "person_id", "type": "integer", "required": True, "description": "A foreign key identifier to the person for whom the observation period is defined."},
                {"name": "observation_period_start_date", "type": "date", "required": True, "description": "The start date of the observation period."},
                {"name": "observation_period_end_date", "type": "date", "required": True, "description": "The end date of the observation period."},
                {"name": "period_type_concept_id", "type": "integer", "required": True, "description": "A foreign key identifier to the predefined concept in the Standardized Vocabularies reflecting the source of the observation period."},
            ],
        ),
        (
            "visit_occurrence",
            [
                {"name": "visit_occurrence_id", "type": "integer", "required": True, "description": "A unique identifier for each person's visit or encounter at a healthcare provider."},
                {"name": "person_id", "type": "integer", "required": True, "description": "A foreign key identifier to the person for whom the visit is recorded."},
                {"name": "visit_concept_id", "type": "integer", "required": True, "description": "A foreign key that refers to a visit concept identifier in the Standardized Vocabularies."},
                {"name": "visit_start_date", "type": "date", "required": True, "description": "The start date of the visit."},
                {"name": "visit_start_datetime", "type": "datetime", "required": False, "description": "The date and time of the visit started."},
                {"name": "visit_end_date", "type": "date", "required": True, "description": "The end date of the visit."},
                {"name": "visit_end_datetime", "type": "datetime", "required": False, "description": "The date and time of the visit end."},
                {"name": "visit_type_concept_id", "type": "integer", "required": True, "description": "A foreign key to the predefined concept identifier in the Standardized Vocabularies reflecting the type of visit."},
                {"name": "provider_id", "type": "integer", "required": False, "description": "A foreign key to the provider in the provider table who was associated with the visit."},
                {"name": "care_site_id", "type": "integer", "required": False, "description": "A foreign key to the care site in the care site table."},
                {"name": "visit_source_value", "type": "varchar", "required": False, "description": "The source code for the visit as it appears in the source data."},
                {"name": "visit_source_concept_id", "type": "integer", "required": False, "description": "A foreign key to a concept that refers to the code used in the source."},
                {"name": "admitted_from_concept_id", "type": "integer", "required": False, "description": "A foreign key to the predefined concept in the Standardized Vocabularies reflecting the admitting source."},
                {"name": "admitted_from_source_value", "type": "varchar", "required": False, "description": "The source code for the admitting source as it appears in the source data."},
                {"name": "discharged_to_concept_id", "type": "integer", "required": False, "description": "A foreign key to the predefined concept in the Standardized Vocabularies reflecting the discharge disposition."},
                {"name": "discharged_to_source_value", "type": "varchar", "required": False, "description": "The source code for the discharge disposition as it appears in the source data."},
                {"name": "preceding_visit_occurrence_id", "type": "integer", "required": False, "description": "A foreign key to the visit_occurrence table of the visit immediately preceding this visit."},
            ],
        ),
        (
            "visit_detail",
            [
                {"name": "visit_detail_id", "type": "integer", "required": True, "description": "A unique identifier for each person's visit or encounter at a healthcare provider."},
                {"name": "person_id", "type": "integer", "required": True, "description": "A foreign key identifier to the person for whom the visit is recorded."},
                {"name": "visit_detail_concept_id", "type": "integer", "required": True, "description": "A foreign key that refers to a visit concept identifier in the Standardized Vocabularies."},
                {"name": "visit_detail_start_date", "type": "date", "required": True, "description": "The start date of the visit."},
                {"name": "visit_detail_start_datetime", "type": "datetime", "required": False, "description": "The date and time of the visit started."},
                {"name": "visit_detail_end_date", "type": "date", "required": True, "description": "The end date of the visit."},
                {"name": "visit_detail_end_datetime", "type": "datetime", "required": False, "description": "The date and time of the visit end."},
                {"name": "visit_detail_type_concept_id", "type": "integer", "required": True, "description": "A foreign key to the predefined concept identifier reflecting the type of visit detail."},
                {"name": "provider_id", "type": "integer", "required": False, "description": "A foreign key to the provider in the provider table."},
                {"name": "care_site_id", "type": "integer", "required": False, "description": "A foreign key to the care site in the care site table."},
                {"name": "visit_detail_source_value", "type": "varchar", "required": False, "description": "The source code for the visit detail as it appears in the source data."},
                {"name": "visit_detail_source_concept_id", "type": "integer", "required": False, "description": "A foreign key to a concept that refers to the code used in the source."},
                {"name": "admitted_from_concept_id", "type": "integer", "required": False, "description": "A foreign key to the predefined concept reflecting the admitting source."},
                {"name": "admitted_from_source_value", "type": "varchar", "required": False, "description": "The source code for the admitting source as it appears in the source data."},
                {"name": "discharged_to_concept_id", "type": "integer", "required": False, "description": "A foreign key to the predefined concept reflecting the discharge disposition."},
                {"name": "discharged_to_source_value", "type": "varchar", "required": False, "description": "The source code for the discharge disposition."},
                {"name": "preceding_visit_detail_id", "type": "integer", "required": False, "description": "A foreign key to the visit_detail table of the visit immediately preceding this visit."},
                {"name": "parent_visit_detail_id", "type": "integer", "required": False, "description": "A foreign key to the visit_detail table for the higher level visit detail."},
                {"name": "visit_occurrence_id", "type": "integer", "required": True, "description": "A foreign key that refers to the record in the visit_occurrence table."},
            ],
        ),
        (
            "condition_occurrence",
            [
                {"name": "condition_occurrence_id", "type": "integer", "required": True, "description": "A unique identifier for each condition occurrence event."},
                {"name": "person_id", "type": "integer", "required": True, "description": "A foreign key identifier to the person who experienced the condition."},
                {"name": "condition_concept_id", "type": "integer", "required": True, "description": "A foreign key that refers to a Standard Concept identifier in the Standardized Vocabularies for the condition."},
                {"name": "condition_start_date", "type": "date", "required": True, "description": "The date when the instance of the condition is recorded."},
                {"name": "condition_start_datetime", "type": "datetime", "required": False, "description": "The date and time when the instance of the condition is recorded."},
                {"name": "condition_end_date", "type": "date", "required": False, "description": "The date when the instance of the condition is considered to have ended."},
                {"name": "condition_end_datetime", "type": "datetime", "required": False, "description": "The date and time when the instance of the condition is considered to have ended."},
                {"name": "condition_type_concept_id", "type": "integer", "required": True, "description": "A foreign key to the predefined concept identifier in the Standardized Vocabularies reflecting the source data from which the condition was recorded."},
                {"name": "condition_status_concept_id", "type": "integer", "required": False, "description": "A foreign key that refers to a Standard Concept identifier in the Standardized Vocabularies reflecting the point of care at which the condition was diagnosed."},
                {"name": "stop_reason", "type": "varchar", "required": False, "description": "The reason that the condition was no longer present."},
                {"name": "provider_id", "type": "integer", "required": False, "description": "A foreign key to the provider in the provider table who was responsible for capturing the condition."},
                {"name": "visit_occurrence_id", "type": "integer", "required": False, "description": "A foreign key to the visit in the visit table during which the condition was determined."},
                {"name": "visit_detail_id", "type": "integer", "required": False, "description": "A foreign key to the visit detail in the visit_detail table."},
                {"name": "condition_source_value", "type": "varchar", "required": False, "description": "The source code for the condition as it appears in the source data."},
                {"name": "condition_source_concept_id", "type": "integer", "required": False, "description": "A foreign key to a condition concept that refers to the code used in the source."},
                {"name": "condition_status_source_value", "type": "varchar", "required": False, "description": "The source code for the condition status as it appears in the source data."},
            ],
        ),
        (
            "drug_exposure",
            [
                {"name": "drug_exposure_id", "type": "integer", "required": True, "description": "A system-generated unique identifier for each drug exposure."},
                {"name": "person_id", "type": "integer", "required": True, "description": "A foreign key identifier to the person who is subjected to the drug."},
                {"name": "drug_concept_id", "type": "integer", "required": True, "description": "A foreign key that refers to a Standard Concept identifier in the Standardized Vocabularies for the drug concept."},
                {"name": "drug_exposure_start_date", "type": "date", "required": True, "description": "The start date for the current instance of drug utilization."},
                {"name": "drug_exposure_start_datetime", "type": "datetime", "required": False, "description": "The start date and time for the current instance of drug utilization."},
                {"name": "drug_exposure_end_date", "type": "date", "required": True, "description": "The end date for the current instance of drug utilization."},
                {"name": "drug_exposure_end_datetime", "type": "datetime", "required": False, "description": "The end date and time for the current instance of drug utilization."},
                {"name": "verbatim_end_date", "type": "date", "required": False, "description": "The known end date of a drug exposure as provided by the source."},
                {"name": "drug_type_concept_id", "type": "integer", "required": True, "description": "A foreign key to the predefined concept identifier in the Standardized Vocabularies reflecting the type of drug exposure."},
                {"name": "stop_reason", "type": "varchar", "required": False, "description": "The reason the drug was stopped."},
                {"name": "refills", "type": "integer", "required": False, "description": "The number of refills after the initial prescription."},
                {"name": "quantity", "type": "float", "required": False, "description": "The quantity of drug as recorded in the original prescription or dispensing record."},
                {"name": "days_supply", "type": "integer", "required": False, "description": "The number of days of supply of the medication as prescribed."},
                {"name": "sig", "type": "varchar", "required": False, "description": "The directions on the drug prescription as recorded in the original prescription."},
                {"name": "route_concept_id", "type": "integer", "required": False, "description": "A foreign key that refers to a Standard Concept identifier in the Standardized Vocabularies designating the route of administration."},
                {"name": "lot_number", "type": "varchar", "required": False, "description": "An identifier to determine where the product originated."},
                {"name": "provider_id", "type": "integer", "required": False, "description": "A foreign key to the provider in the provider table who initiated the drug exposure."},
                {"name": "visit_occurrence_id", "type": "integer", "required": False, "description": "A foreign key to the visit in the visit table during which the drug exposure was initiated."},
                {"name": "visit_detail_id", "type": "integer", "required": False, "description": "A foreign key to the visit detail record in the visit_detail table."},
                {"name": "drug_source_value", "type": "varchar", "required": False, "description": "The source code for the drug as it appears in the source data."},
                {"name": "drug_source_concept_id", "type": "integer", "required": False, "description": "A foreign key to a drug concept that refers to the code used in the source."},
                {"name": "route_source_value", "type": "varchar", "required": False, "description": "The information about the route of administration as detailed in the source."},
                {"name": "dose_unit_source_value", "type": "varchar", "required": False, "description": "The information about the dose unit as detailed in the source."},
            ],
        ),
        (
            "procedure_occurrence",
            [
                {"name": "procedure_occurrence_id", "type": "integer", "required": True, "description": "A system-generated unique identifier for each procedure occurrence."},
                {"name": "person_id", "type": "integer", "required": True, "description": "A foreign key identifier to the person who is subjected to the procedure."},
                {"name": "procedure_concept_id", "type": "integer", "required": True, "description": "A foreign key that refers to a Standard Concept identifier in the Standardized Vocabularies for the procedure."},
                {"name": "procedure_date", "type": "date", "required": True, "description": "The date on which the procedure was performed."},
                {"name": "procedure_datetime", "type": "datetime", "required": False, "description": "The date and time on which the procedure was performed."},
                {"name": "procedure_end_date", "type": "date", "required": False, "description": "The date on which the procedure ended."},
                {"name": "procedure_end_datetime", "type": "datetime", "required": False, "description": "The date and time on which the procedure ended."},
                {"name": "procedure_type_concept_id", "type": "integer", "required": True, "description": "A foreign key to the predefined concept identifier reflecting the type of the procedure."},
                {"name": "modifier_concept_id", "type": "integer", "required": False, "description": "A foreign key to a Standard Concept identifier for a modifier to the procedure."},
                {"name": "quantity", "type": "integer", "required": False, "description": "The quantity of procedures ordered or administered."},
                {"name": "provider_id", "type": "integer", "required": False, "description": "A foreign key to the provider in the provider table who was responsible for carrying out the procedure."},
                {"name": "visit_occurrence_id", "type": "integer", "required": False, "description": "A foreign key to the visit in the visit table during which the procedure was carried out."},
                {"name": "visit_detail_id", "type": "integer", "required": False, "description": "A foreign key to the visit detail record in the visit_detail table."},
                {"name": "procedure_source_value", "type": "varchar", "required": False, "description": "The source code for the procedure as it appears in the source data."},
                {"name": "procedure_source_concept_id", "type": "integer", "required": False, "description": "A foreign key to a procedure concept that refers to the code used in the source."},
                {"name": "modifier_source_value", "type": "varchar", "required": False, "description": "The source code for the qualifier as it appears in the source data."},
            ],
        ),
        (
            "measurement",
            [
                {"name": "measurement_id", "type": "integer", "required": True, "description": "A unique identifier for each measurement."},
                {"name": "person_id", "type": "integer", "required": True, "description": "A foreign key identifier to the person about whom the measurement was recorded."},
                {"name": "measurement_concept_id", "type": "integer", "required": True, "description": "A foreign key to the standard measurement concept identifier in the Standardized Vocabularies."},
                {"name": "measurement_date", "type": "date", "required": True, "description": "The date of the measurement."},
                {"name": "measurement_datetime", "type": "datetime", "required": False, "description": "The date and time of the measurement."},
                {"name": "measurement_time", "type": "varchar", "required": False, "description": "The time of the measurement."},
                {"name": "measurement_type_concept_id", "type": "integer", "required": True, "description": "A foreign key to the predefined concept in the Standardized Vocabularies reflecting the provenance from which the measurement record was recorded."},
                {"name": "operator_concept_id", "type": "integer", "required": False, "description": "A foreign key identifier to the predefined concept in the Standardized Vocabularies reflecting the mathematical operator that is applied to the value_as_number."},
                {"name": "value_as_number", "type": "float", "required": False, "description": "A measurement result where the result is expressed as a numeric value."},
                {"name": "value_as_concept_id", "type": "integer", "required": False, "description": "A foreign key to a measurement result represented as a concept from the Standardized Vocabularies."},
                {"name": "unit_concept_id", "type": "integer", "required": False, "description": "A foreign key to a Standard Concept ID of measurement units in the Standardized Vocabularies."},
                {"name": "range_low", "type": "float", "required": False, "description": "The lower limit of the normal range of the measurement."},
                {"name": "range_high", "type": "float", "required": False, "description": "The upper limit of the normal range of the measurement."},
                {"name": "provider_id", "type": "integer", "required": False, "description": "A foreign key to the provider in the provider table who was responsible for initiating or obtaining the measurement."},
                {"name": "visit_occurrence_id", "type": "integer", "required": False, "description": "A foreign key to the visit in the visit table during which the measurement was recorded."},
                {"name": "visit_detail_id", "type": "integer", "required": False, "description": "A foreign key to the visit detail record in the visit_detail table."},
                {"name": "measurement_source_value", "type": "varchar", "required": False, "description": "The measurement name as it appears in the source data."},
                {"name": "measurement_source_concept_id", "type": "integer", "required": False, "description": "A foreign key to a concept that refers to the code used in the source."},
                {"name": "unit_source_value", "type": "varchar", "required": False, "description": "The source code for the unit as it appears in the source data."},
                {"name": "unit_source_concept_id", "type": "integer", "required": False, "description": "A foreign key to a concept that refers to the code used in the source for the unit."},
                {"name": "value_source_value", "type": "varchar", "required": False, "description": "The source value associated with the content of the value_as_number or value_as_concept_id."},
                {"name": "measurement_event_id", "type": "integer", "required": False, "description": "A foreign key to an event table."},
                {"name": "meas_event_field_concept_id", "type": "integer", "required": False, "description": "A foreign key that refers to a Standard Concept identifier for the field of the event being measured."},
            ],
        ),
        (
            "observation",
            [
                {"name": "observation_id", "type": "integer", "required": True, "description": "A unique identifier for each observation."},
                {"name": "person_id", "type": "integer", "required": True, "description": "A foreign key identifier to the person about whom the observation was recorded."},
                {"name": "observation_concept_id", "type": "integer", "required": True, "description": "A foreign key to the standard observation concept identifier in the Standardized Vocabularies."},
                {"name": "observation_date", "type": "date", "required": True, "description": "The date of the observation."},
                {"name": "observation_datetime", "type": "datetime", "required": False, "description": "The date and time of the observation."},
                {"name": "observation_type_concept_id", "type": "integer", "required": True, "description": "A foreign key to the predefined concept identifier in the Standardized Vocabularies reflecting the type of the observation."},
                {"name": "value_as_number", "type": "float", "required": False, "description": "The observation result stored as a number."},
                {"name": "value_as_string", "type": "varchar", "required": False, "description": "The observation result stored as a string."},
                {"name": "value_as_concept_id", "type": "integer", "required": False, "description": "A foreign key to an observation result stored as a concept identifier."},
                {"name": "qualifier_concept_id", "type": "integer", "required": False, "description": "A foreign key to a Standard Concept ID for a qualifier."},
                {"name": "unit_concept_id", "type": "integer", "required": False, "description": "A foreign key to a Standard Concept ID of the measurement units."},
                {"name": "provider_id", "type": "integer", "required": False, "description": "A foreign key to the provider in the provider table who was responsible for making the observation."},
                {"name": "visit_occurrence_id", "type": "integer", "required": False, "description": "A foreign key to the visit in the visit table during which the observation was recorded."},
                {"name": "visit_detail_id", "type": "integer", "required": False, "description": "A foreign key to the visit detail record in the visit_detail table."},
                {"name": "observation_source_value", "type": "varchar", "required": False, "description": "The observation code as it appears in the source data."},
                {"name": "observation_source_concept_id", "type": "integer", "required": False, "description": "A foreign key to a concept that refers to the code used in the source."},
                {"name": "unit_source_value", "type": "varchar", "required": False, "description": "The source code for the unit as it appears in the source data."},
                {"name": "qualifier_source_value", "type": "varchar", "required": False, "description": "The source value associated with a qualifier to characterize the observation."},
                {"name": "value_source_value", "type": "varchar", "required": False, "description": "The source value associated with the observation result."},
                {"name": "observation_event_id", "type": "integer", "required": False, "description": "A foreign key to an event table."},
                {"name": "obs_event_field_concept_id", "type": "integer", "required": False, "description": "A foreign key that refers to a Standard Concept identifier for the field of the event."},
            ],
        ),
        (
            "death",
            [
                {"name": "person_id", "type": "integer", "required": True, "description": "A foreign key identifier to the deceased person."},
                {"name": "death_date", "type": "date", "required": True, "description": "The date the person was deceased."},
                {"name": "death_datetime", "type": "datetime", "required": False, "description": "The date and time the person was deceased."},
                {"name": "death_type_concept_id", "type": "integer", "required": False, "description": "A foreign key referring to the predefined concept identifier in the Standardized Vocabularies reflecting the type of death."},
                {"name": "cause_concept_id", "type": "integer", "required": False, "description": "A foreign key referring to a standard concept identifier in the Standardized Vocabularies for conditions."},
                {"name": "cause_source_value", "type": "varchar", "required": False, "description": "The source code for the cause of death as it appears in the source data."},
                {"name": "cause_source_concept_id", "type": "integer", "required": False, "description": "A foreign key to the concept that refers to the code used in the source."},
            ],
        ),
        (
            "device_exposure",
            [
                {"name": "device_exposure_id", "type": "integer", "required": True, "description": "A system-generated unique identifier for each device exposure."},
                {"name": "person_id", "type": "integer", "required": True, "description": "A foreign key identifier to the person who is subjected to the device."},
                {"name": "device_concept_id", "type": "integer", "required": True, "description": "A foreign key that refers to a Standard Concept identifier in the Standardized Vocabularies for the device."},
                {"name": "device_exposure_start_date", "type": "date", "required": True, "description": "The date the device was applied or used."},
                {"name": "device_exposure_start_datetime", "type": "datetime", "required": False, "description": "The date and time the device was applied or used."},
                {"name": "device_exposure_end_date", "type": "date", "required": False, "description": "The date use of the device was completed."},
                {"name": "device_exposure_end_datetime", "type": "datetime", "required": False, "description": "The date and time use of the device was completed."},
                {"name": "device_type_concept_id", "type": "integer", "required": True, "description": "A foreign key to the predefined concept identifier reflecting the type of device exposure."},
                {"name": "unique_device_id", "type": "varchar", "required": False, "description": "A UDI or equivalent identifying the instance of the device used."},
                {"name": "production_id", "type": "varchar", "required": False, "description": "The production identifier of the device."},
                {"name": "quantity", "type": "integer", "required": False, "description": "The number of devices."},
                {"name": "provider_id", "type": "integer", "required": False, "description": "A foreign key to the provider in the provider table who initiated the device exposure."},
                {"name": "visit_occurrence_id", "type": "integer", "required": False, "description": "A foreign key to the visit in the visit table during which the device was used."},
                {"name": "visit_detail_id", "type": "integer", "required": False, "description": "A foreign key to the visit detail record in the visit_detail table."},
                {"name": "device_source_value", "type": "varchar", "required": False, "description": "The source code for the device as it appears in the source data."},
                {"name": "device_source_concept_id", "type": "integer", "required": False, "description": "A foreign key to a concept that refers to the code used in the source."},
                {"name": "unit_concept_id", "type": "integer", "required": False, "description": "A foreign key to a Standard Concept ID of the unit."},
                {"name": "unit_source_value", "type": "varchar", "required": False, "description": "The source code for the unit as it appears in the source data."},
                {"name": "unit_source_concept_id", "type": "integer", "required": False, "description": "A foreign key to a concept that refers to the code used in the source for the unit."},
            ],
        ),
        (
            "note",
            [
                {"name": "note_id", "type": "integer", "required": True, "description": "A unique identifier for each note."},
                {"name": "person_id", "type": "integer", "required": True, "description": "A foreign key identifier to the person about whom the note was recorded."},
                {"name": "note_date", "type": "date", "required": True, "description": "The date the note was recorded."},
                {"name": "note_datetime", "type": "datetime", "required": False, "description": "The date and time the note was recorded."},
                {"name": "note_type_concept_id", "type": "integer", "required": True, "description": "A foreign key to the predefined concept in the Standardized Vocabularies reflecting the type of the note."},
                {"name": "note_class_concept_id", "type": "integer", "required": True, "description": "A foreign key to the predefined concept in the Standardized Vocabularies reflecting the class of the note."},
                {"name": "note_title", "type": "varchar", "required": False, "description": "The title of the note as it appears in the source."},
                {"name": "note_text", "type": "varchar", "required": True, "description": "The content of the note."},
                {"name": "encoding_concept_id", "type": "integer", "required": True, "description": "A foreign key to the predefined concept in the Standardized Vocabularies reflecting the note encoding."},
                {"name": "language_concept_id", "type": "integer", "required": True, "description": "A foreign key to the predefined concept in the Standardized Vocabularies reflecting the language of the note."},
                {"name": "provider_id", "type": "integer", "required": False, "description": "A foreign key to the provider in the provider table who took the note."},
                {"name": "visit_occurrence_id", "type": "integer", "required": False, "description": "A foreign key to the visit in the visit table when the note was taken."},
                {"name": "visit_detail_id", "type": "integer", "required": False, "description": "A foreign key to the visit detail record in the visit_detail table."},
                {"name": "note_source_value", "type": "varchar", "required": False, "description": "The source value associated with the origin of the note."},
                {"name": "note_event_id", "type": "integer", "required": False, "description": "A foreign key to an event table."},
                {"name": "note_event_field_concept_id", "type": "integer", "required": False, "description": "A foreign key that refers to a Standard Concept identifier for the field of the event."},
            ],
        ),
        (
            "note_nlp",
            [
                {"name": "note_nlp_id", "type": "integer", "required": True, "description": "A unique identifier for each NLP extraction."},
                {"name": "note_id", "type": "integer", "required": True, "description": "A foreign key to the note from which the NLP extraction was made."},
                {"name": "section_concept_id", "type": "integer", "required": False, "description": "A foreign key to the predefined concept in the Standardized Vocabularies representing the section of the note."},
                {"name": "snippet", "type": "varchar", "required": False, "description": "A small window of text surrounding the NLP term."},
                {"name": "offset", "type": "varchar", "required": False, "description": "Character offset of the extracted term in the note."},
                {"name": "lexical_variant", "type": "varchar", "required": True, "description": "The raw text extracted from the note."},
                {"name": "note_nlp_concept_id", "type": "integer", "required": False, "description": "A foreign key to the predefined concept in the Standardized Vocabularies reflecting the normalized concept for the extracted term."},
                {"name": "note_nlp_source_concept_id", "type": "integer", "required": False, "description": "A foreign key to a concept that refers to the code used in the NLP system."},
                {"name": "nlp_system", "type": "varchar", "required": False, "description": "The name of the NLP system that extracted the term."},
                {"name": "nlp_date", "type": "date", "required": True, "description": "The date of the NLP extraction."},
                {"name": "nlp_datetime", "type": "datetime", "required": False, "description": "The date and time of the NLP extraction."},
                {"name": "term_exists", "type": "varchar", "required": False, "description": "A term indicating if the extracted term is negated or affirmed."},
                {"name": "term_temporal", "type": "varchar", "required": False, "description": "A term indicating the temporal context of the extracted term."},
                {"name": "term_modifiers", "type": "varchar", "required": False, "description": "A term indicating additional modifiers."},
            ],
        ),
        (
            "specimen",
            [
                {"name": "specimen_id", "type": "integer", "required": True, "description": "A unique identifier for each specimen."},
                {"name": "person_id", "type": "integer", "required": True, "description": "A foreign key identifier to the person for whom the specimen is recorded."},
                {"name": "specimen_concept_id", "type": "integer", "required": True, "description": "A foreign key referring to a Standard Concept identifier in the Standardized Vocabularies for the specimen."},
                {"name": "specimen_type_concept_id", "type": "integer", "required": True, "description": "A foreign key referring to the predefined concept identifier reflecting the system of record from which the specimen was recorded."},
                {"name": "specimen_date", "type": "date", "required": True, "description": "The date the specimen was obtained."},
                {"name": "specimen_datetime", "type": "datetime", "required": False, "description": "The date and time the specimen was obtained."},
                {"name": "quantity", "type": "float", "required": False, "description": "The amount of specimen collected."},
                {"name": "unit_concept_id", "type": "integer", "required": False, "description": "A foreign key to a Standard Concept ID of the unit."},
                {"name": "anatomic_site_concept_id", "type": "integer", "required": False, "description": "A foreign key to a Standard Concept ID for the anatomic location of specimen collection."},
                {"name": "disease_status_concept_id", "type": "integer", "required": False, "description": "A foreign key to a Standard Concept ID for the disease status of specimen collection."},
                {"name": "specimen_source_id", "type": "varchar", "required": False, "description": "The identifier for the specimen as it appeared in the source data."},
                {"name": "specimen_source_value", "type": "varchar", "required": False, "description": "The source code for the specimen as it appears in the source data."},
                {"name": "unit_source_value", "type": "varchar", "required": False, "description": "The source code for the unit as it appears in the source data."},
                {"name": "anatomic_site_source_value", "type": "varchar", "required": False, "description": "The source code for the anatomic site as it appears in the source data."},
                {"name": "disease_status_source_value", "type": "varchar", "required": False, "description": "The source code for the disease status as it appears in the source data."},
            ],
        ),
        (
            "location",
            [
                {"name": "location_id", "type": "integer", "required": True, "description": "A unique identifier for each geographic location."},
                {"name": "address_1", "type": "varchar", "required": False, "description": "The address field 1, typically used for the street address."},
                {"name": "address_2", "type": "varchar", "required": False, "description": "The address field 2, typically used for additional detail."},
                {"name": "city", "type": "varchar", "required": False, "description": "The city field as part of the address."},
                {"name": "state", "type": "varchar", "required": False, "description": "The state field as part of the address."},
                {"name": "zip", "type": "varchar", "required": False, "description": "The zip or postal code."},
                {"name": "county", "type": "varchar", "required": False, "description": "The county."},
                {"name": "location_source_value", "type": "varchar", "required": False, "description": "The verbatim information that is used to uniquely identify the location."},
                {"name": "country_concept_id", "type": "integer", "required": False, "description": "A foreign key to a concept that refers to the country."},
                {"name": "country_source_value", "type": "varchar", "required": False, "description": "The source code for the country as it appears in the source data."},
                {"name": "latitude", "type": "float", "required": False, "description": "The geocoded latitude."},
                {"name": "longitude", "type": "float", "required": False, "description": "The geocoded longitude."},
            ],
        ),
        (
            "care_site",
            [
                {"name": "care_site_id", "type": "integer", "required": True, "description": "A unique identifier for each care site."},
                {"name": "care_site_name", "type": "varchar", "required": False, "description": "The verbatim description or name of the care site."},
                {"name": "place_of_service_concept_id", "type": "integer", "required": False, "description": "A foreign key that refers to a concept identifier in the Standardized Vocabularies reflecting the type of the care site."},
                {"name": "location_id", "type": "integer", "required": False, "description": "A foreign key to the geographic location in the location table."},
                {"name": "care_site_source_value", "type": "varchar", "required": False, "description": "The identifier for the care site in the source data."},
                {"name": "place_of_service_source_value", "type": "varchar", "required": False, "description": "The source code for the place of service as it appears in the source data."},
            ],
        ),
        (
            "provider",
            [
                {"name": "provider_id", "type": "integer", "required": True, "description": "A unique identifier for each provider."},
                {"name": "provider_name", "type": "varchar", "required": False, "description": "A description of the provider."},
                {"name": "npi", "type": "varchar", "required": False, "description": "The National Provider Identifier (NPI)."},
                {"name": "dea", "type": "varchar", "required": False, "description": "The Drug Enforcement Administration (DEA) number."},
                {"name": "specialty_concept_id", "type": "integer", "required": False, "description": "A foreign key to a Standard Concept ID for the provider specialty."},
                {"name": "care_site_id", "type": "integer", "required": False, "description": "A foreign key to the main care site where the provider is practicing."},
                {"name": "year_of_birth", "type": "integer", "required": False, "description": "The year of birth of the provider."},
                {"name": "gender_concept_id", "type": "integer", "required": False, "description": "The gender of the provider."},
                {"name": "provider_source_value", "type": "varchar", "required": False, "description": "The identifier used for the provider in the source data."},
                {"name": "specialty_source_value", "type": "varchar", "required": False, "description": "The source code for the provider specialty as it appears in the source data."},
                {"name": "specialty_source_concept_id", "type": "integer", "required": False, "description": "A foreign key to a concept that refers to the code used in the source for the specialty."},
                {"name": "gender_source_value", "type": "varchar", "required": False, "description": "The gender code for the provider as it appears in the source data."},
                {"name": "gender_source_concept_id", "type": "integer", "required": False, "description": "A foreign key to a concept that refers to the code used in the source for the gender."},
            ],
        ),
        (
            "cost",
            [
                {"name": "cost_id", "type": "integer", "required": True, "description": "A unique identifier for each cost record."},
                {"name": "cost_event_id", "type": "integer", "required": True, "description": "A foreign key identifier to the event (e.g. drug exposure, procedure) for which the cost is recorded."},
                {"name": "cost_domain_id", "type": "varchar", "required": True, "description": "The concept representing the domain of the cost event."},
                {"name": "cost_type_concept_id", "type": "integer", "required": True, "description": "A foreign key identifier to a concept in the Standardized Vocabularies reflecting the type of cost."},
                {"name": "currency_concept_id", "type": "integer", "required": False, "description": "A foreign key identifier to the concept representing the three-letter code used to delineate international currencies."},
                {"name": "total_charge", "type": "float", "required": False, "description": "The total amount charged by some organization for the items and services provided."},
                {"name": "total_cost", "type": "float", "required": False, "description": "The cost incurred by the provider of goods or services."},
                {"name": "total_paid", "type": "float", "required": False, "description": "The total amount actually paid from all payers."},
                {"name": "paid_by_payer", "type": "float", "required": False, "description": "The amount paid by the payer."},
                {"name": "paid_by_patient", "type": "float", "required": False, "description": "The total amount paid by the person as a share of the expenses."},
                {"name": "paid_patient_copay", "type": "float", "required": False, "description": "The amount paid by the person as a fixed contribution to the expenses."},
                {"name": "paid_patient_coinsurance", "type": "float", "required": False, "description": "The amount paid by the person as a joint assumption of risk."},
                {"name": "paid_patient_deductible", "type": "float", "required": False, "description": "The amount paid by the person that is counted toward the deductible defined by the payer plan."},
                {"name": "paid_by_primary", "type": "float", "required": False, "description": "The amount paid by a primary payer through the coordination of benefits."},
                {"name": "paid_ingredient_cost", "type": "float", "required": False, "description": "The amount paid by the payer to a pharmacy for the drug ingredient."},
                {"name": "paid_dispensing_fee", "type": "float", "required": False, "description": "The amount paid by the payer to a pharmacy for the dispensing of the drug."},
                {"name": "payer_plan_period_id", "type": "integer", "required": False, "description": "A foreign key to the payer_plan_period table."},
                {"name": "amount_allowed", "type": "float", "required": False, "description": "The contracted amount agreed between the payer and provider."},
                {"name": "revenue_code_concept_id", "type": "integer", "required": False, "description": "A foreign key referring to a Standard Concept ID for the Revenue Code."},
                {"name": "revenue_code_source_value", "type": "varchar", "required": False, "description": "The source code for the Revenue Code as it appears in the source data."},
                {"name": "drg_concept_id", "type": "integer", "required": False, "description": "A foreign key referring to a Standard Concept ID for the DRG."},
                {"name": "drg_source_value", "type": "varchar", "required": False, "description": "The source code for the DRG as it appears in the source data."},
            ],
        ),
        (
            "payer_plan_period",
            [
                {"name": "payer_plan_period_id", "type": "integer", "required": True, "description": "A identifier for each unique combination of payer, plan, family code, and target of the payer plan."},
                {"name": "person_id", "type": "integer", "required": True, "description": "A foreign key identifier to the person covered by the payer."},
                {"name": "payer_plan_period_start_date", "type": "date", "required": True, "description": "The start date of the payer plan period."},
                {"name": "payer_plan_period_end_date", "type": "date", "required": True, "description": "The end date of the payer plan period."},
                {"name": "payer_concept_id", "type": "integer", "required": False, "description": "A foreign key that refers to a Standard Concept identifier for the payer."},
                {"name": "payer_source_value", "type": "varchar", "required": False, "description": "The source code for the payer as it appears in the source data."},
                {"name": "payer_source_concept_id", "type": "integer", "required": False, "description": "A foreign key to a concept that refers to the code used in the source for the payer."},
                {"name": "plan_concept_id", "type": "integer", "required": False, "description": "A foreign key that refers to a Standard Concept identifier for the plan."},
                {"name": "plan_source_value", "type": "varchar", "required": False, "description": "The source code for the plan as it appears in the source data."},
                {"name": "plan_source_concept_id", "type": "integer", "required": False, "description": "A foreign key to a concept that refers to the code used in the source for the plan."},
                {"name": "sponsor_concept_id", "type": "integer", "required": False, "description": "A foreign key that refers to a Standard Concept identifier for the sponsor."},
                {"name": "sponsor_source_value", "type": "varchar", "required": False, "description": "The source code for the sponsor as it appears in the source data."},
                {"name": "sponsor_source_concept_id", "type": "integer", "required": False, "description": "A foreign key to a concept that refers to the code used in the source for the sponsor."},
                {"name": "family_source_value", "type": "varchar", "required": False, "description": "The source code for the family as it appears in the source data."},
                {"name": "stop_reason_concept_id", "type": "integer", "required": False, "description": "A foreign key that refers to a Standard Concept identifier for the stop reason."},
                {"name": "stop_reason_source_value", "type": "varchar", "required": False, "description": "The source code for the stop reason as it appears in the source data."},
                {"name": "stop_reason_source_concept_id", "type": "integer", "required": False, "description": "A foreign key to a concept that refers to the code used in the source for the stop reason."},
            ],
        ),
        (
            "condition_era",
            [
                {"name": "condition_era_id", "type": "integer", "required": True, "description": "A unique identifier for each condition era."},
                {"name": "person_id", "type": "integer", "required": True, "description": "A foreign key identifier to the person who is experiencing the condition during the condition era."},
                {"name": "condition_concept_id", "type": "integer", "required": True, "description": "A foreign key that refers to a Standard Concept identifier in the Standardized Vocabularies for the condition."},
                {"name": "condition_era_start_date", "type": "date", "required": True, "description": "The start date for the condition era constructed from the individual instances of condition occurrences."},
                {"name": "condition_era_end_date", "type": "date", "required": True, "description": "The end date for the condition era constructed from the individual instances of condition occurrences."},
                {"name": "condition_occurrence_count", "type": "integer", "required": False, "description": "The number of individual condition occurrences used to construct the condition era."},
            ],
        ),
        (
            "drug_era",
            [
                {"name": "drug_era_id", "type": "integer", "required": True, "description": "A unique identifier for each drug era."},
                {"name": "person_id", "type": "integer", "required": True, "description": "A foreign key identifier to the person who is subjected to the drug during the drug era."},
                {"name": "drug_concept_id", "type": "integer", "required": True, "description": "A foreign key that refers to a Standard Concept identifier in the Standardized Vocabularies for the ingredient concept."},
                {"name": "drug_era_start_date", "type": "date", "required": True, "description": "The start date for the drug era constructed from the individual instances of drug exposures."},
                {"name": "drug_era_end_date", "type": "date", "required": True, "description": "The end date for the drug era constructed from the individual instances of drug exposures."},
                {"name": "drug_exposure_count", "type": "integer", "required": False, "description": "The number of individual drug exposure occurrences used to construct the drug era."},
                {"name": "gap_days", "type": "integer", "required": False, "description": "The number of days that are not covered by DRUG_EXPOSURE records that were used to make up the era record."},
            ],
        ),
        (
            "dose_era",
            [
                {"name": "dose_era_id", "type": "integer", "required": True, "description": "A unique identifier for each dose era."},
                {"name": "person_id", "type": "integer", "required": True, "description": "A foreign key identifier to the person who is subjected to the drug during the dose era."},
                {"name": "drug_concept_id", "type": "integer", "required": True, "description": "A foreign key that refers to a Standard Concept identifier in the Standardized Vocabularies for the active ingredient concept."},
                {"name": "unit_concept_id", "type": "integer", "required": True, "description": "A foreign key that refers to a Standard Concept identifier in the Standardized Vocabularies for the unit concept."},
                {"name": "dose_value", "type": "float", "required": True, "description": "The numeric value of the dose."},
                {"name": "dose_era_start_date", "type": "date", "required": True, "description": "The start date for the dose era."},
                {"name": "dose_era_end_date", "type": "date", "required": True, "description": "The end date for the dose era."},
            ],
        ),
        (
            "drug_strength",
            [
                {"name": "drug_concept_id", "type": "integer", "required": True, "description": "A foreign key to the concept in the concept table representing the identifier for the marketed product."},
                {"name": "ingredient_concept_id", "type": "integer", "required": True, "description": "A foreign key to the concept in the concept table representing the identifier for the drug ingredient."},
                {"name": "amount_value", "type": "float", "required": False, "description": "The numeric value associated with the amount of active ingredient."},
                {"name": "amount_unit_concept_id", "type": "integer", "required": False, "description": "A foreign key to the concept in the concept table representing the identifier for the unit for the absolute amount."},
                {"name": "numerator_value", "type": "float", "required": False, "description": "The numeric value associated with the content of the active ingredient."},
                {"name": "numerator_unit_concept_id", "type": "integer", "required": False, "description": "A foreign key to the concept in the concept table representing the identifier for the numerator unit."},
                {"name": "denominator_value", "type": "float", "required": False, "description": "The numeric value associated with the denominator of the content of the active ingredient."},
                {"name": "denominator_unit_concept_id", "type": "integer", "required": False, "description": "A foreign key to the concept in the concept table representing the identifier for the denominator unit."},
                {"name": "box_size", "type": "integer", "required": False, "description": "The number of units of clinical drug or quantified clinical drug contained in a box."},
                {"name": "valid_start_date", "type": "date", "required": True, "description": "The date when the concept was first recorded."},
                {"name": "valid_end_date", "type": "date", "required": True, "description": "The date when the concept became invalid."},
                {"name": "invalid_reason", "type": "varchar", "required": False, "description": "Reason the concept was invalidated."},
            ],
        ),
        (
            "concept",
            [
                {"name": "concept_id", "type": "integer", "required": True, "description": "A unique identifier for each concept across all domains."},
                {"name": "concept_name", "type": "varchar", "required": True, "description": "An unambiguous, meaningful and descriptive name for the concept."},
                {"name": "domain_id", "type": "varchar", "required": True, "description": "A foreign key to the domain table the concept belongs to."},
                {"name": "vocabulary_id", "type": "varchar", "required": True, "description": "A foreign key to the vocabulary table indicating from which source the concept has been adapted."},
                {"name": "concept_class_id", "type": "varchar", "required": True, "description": "The attribute or concept class of the concept."},
                {"name": "standard_concept", "type": "varchar", "required": False, "description": "This flag determines where a concept is a Standard Concept."},
                {"name": "concept_code", "type": "varchar", "required": True, "description": "The concept code represents the identifier of the concept in the source vocabulary."},
                {"name": "valid_start_date", "type": "date", "required": True, "description": "The date when the concept was first recorded."},
                {"name": "valid_end_date", "type": "date", "required": True, "description": "The date when the concept became invalid."},
                {"name": "invalid_reason", "type": "varchar", "required": False, "description": "Reason the concept was invalidated."},
            ],
        ),
        (
            "vocabulary",
            [
                {"name": "vocabulary_id", "type": "varchar", "required": True, "description": "A unique identifier for each vocabulary."},
                {"name": "vocabulary_name", "type": "varchar", "required": True, "description": "The name describing the vocabulary."},
                {"name": "vocabulary_reference", "type": "varchar", "required": True, "description": "External reference to documentation or available download of the vocabulary knowledge base."},
                {"name": "vocabulary_version", "type": "varchar", "required": False, "description": "Version of the vocabulary."},
                {"name": "vocabulary_concept_id", "type": "integer", "required": True, "description": "A foreign key that refers to a standard concept identifier in the concept table for the vocabulary."},
            ],
        ),
        (
            "domain",
            [
                {"name": "domain_id", "type": "varchar", "required": True, "description": "A unique key for each domain."},
                {"name": "domain_name", "type": "varchar", "required": True, "description": "The name describing the domain."},
                {"name": "domain_concept_id", "type": "integer", "required": True, "description": "A foreign key that refers to a concept identifier in the concept table for the domain."},
            ],
        ),
        (
            "concept_class",
            [
                {"name": "concept_class_id", "type": "varchar", "required": True, "description": "A unique key for each class."},
                {"name": "concept_class_name", "type": "varchar", "required": True, "description": "The name describing the concept class."},
                {"name": "concept_class_concept_id", "type": "integer", "required": True, "description": "A foreign key that refers to a concept identifier in the concept table for the concept class."},
            ],
        ),
        (
            "concept_relationship",
            [
                {"name": "concept_id_1", "type": "integer", "required": True, "description": "A foreign key to a concept in the concept table associated with the relationship."},
                {"name": "concept_id_2", "type": "integer", "required": True, "description": "A foreign key to a concept in the concept table associated with the relationship."},
                {"name": "relationship_id", "type": "varchar", "required": True, "description": "A unique identifier to the type or nature of the relationship."},
                {"name": "valid_start_date", "type": "date", "required": True, "description": "The date when the relationship was first recorded."},
                {"name": "valid_end_date", "type": "date", "required": True, "description": "The date when the relationship became invalid."},
                {"name": "invalid_reason", "type": "varchar", "required": False, "description": "Reason the relationship was invalidated."},
            ],
        ),
        (
            "relationship",
            [
                {"name": "relationship_id", "type": "varchar", "required": True, "description": "The type of relationship captured by the relationship record."},
                {"name": "relationship_name", "type": "varchar", "required": True, "description": "The text that describes the relationship type."},
                {"name": "is_hierarchical", "type": "varchar", "required": True, "description": "Defines whether a relationship defines concepts into classes or hierarchies."},
                {"name": "defines_ancestry", "type": "varchar", "required": True, "description": "Defines whether a hierarchical relationship contributes to the concept_ancestor table."},
                {"name": "reverse_relationship_id", "type": "varchar", "required": True, "description": "The identifier for the relationship used to define the reverse relationship between two concepts."},
                {"name": "relationship_concept_id", "type": "integer", "required": True, "description": "A foreign key that refers to an identifier in the concept table for the unique relationship concept."},
            ],
        ),
        (
            "concept_synonym",
            [
                {"name": "concept_id", "type": "integer", "required": True, "description": "A foreign key to the concept in the concept table."},
                {"name": "concept_synonym_name", "type": "varchar", "required": True, "description": "The alternative name for the concept."},
                {"name": "language_concept_id", "type": "integer", "required": True, "description": "A foreign key to a concept representing the language."},
            ],
        ),
        (
            "concept_ancestor",
            [
                {"name": "ancestor_concept_id", "type": "integer", "required": True, "description": "A foreign key to the concept in the concept table for the higher-level concept."},
                {"name": "descendant_concept_id", "type": "integer", "required": True, "description": "A foreign key to the concept in the concept table for the lower-level concept."},
                {"name": "min_levels_of_separation", "type": "integer", "required": True, "description": "The minimum separation in number of levels of hierarchy between ancestor and descendant concepts."},
                {"name": "max_levels_of_separation", "type": "integer", "required": True, "description": "The maximum separation in number of levels of hierarchy between ancestor and descendant concepts."},
            ],
        ),
        (
            "cohort",
            [
                {"name": "cohort_definition_id", "type": "integer", "required": True, "description": "A foreign key to a record in the cohort_definition table containing relevant cohort definition information."},
                {"name": "subject_id", "type": "integer", "required": True, "description": "A foreign key to the subject in the cohort."},
                {"name": "cohort_start_date", "type": "date", "required": True, "description": "The date when the cohort definition criteria for the person, provider or visit first match."},
                {"name": "cohort_end_date", "type": "date", "required": True, "description": "The date when the cohort definition criteria for the person, provider or visit no longer match or the cohort membership was terminated."},
            ],
        ),
        (
            "cohort_definition",
            [
                {"name": "cohort_definition_id", "type": "integer", "required": True, "description": "A unique identifier for each cohort."},
                {"name": "cohort_definition_name", "type": "varchar", "required": True, "description": "A short description of the cohort."},
                {"name": "cohort_definition_description", "type": "varchar", "required": False, "description": "A complete description of the cohort definition."},
                {"name": "definition_type_concept_id", "type": "integer", "required": True, "description": "Type defining what kind of cohort definition the record represents."},
                {"name": "cohort_definition_syntax", "type": "varchar", "required": False, "description": "Syntax or code to operationalize the cohort definition."},
                {"name": "subject_concept_id", "type": "integer", "required": True, "description": "A foreign key to the concept to which the cohort applies."},
                {"name": "cohort_initiation_date", "type": "date", "required": False, "description": "A date to indicate when the cohort was initiated in the cdm."},
            ],
        ),
    ]
)


# ---------------------------------------------------------------------------
# Output generators
# ---------------------------------------------------------------------------


def escape_ts_string(s: str) -> str:
    """Escape a string for TypeScript template literal or string."""
    return s.replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ").replace("\r", "")


def escape_php_string(s: str) -> str:
    """Escape a string for PHP single-quoted string."""
    return s.replace("\\", "\\\\").replace("'", "\\'").replace("\n", " ").replace("\r", "")


def generate_ts(schema: list[dict[str, Any]]) -> str:
    """Generate TypeScript source for the CDM schema."""
    lines: list[str] = []
    lines.append("// GENERATED — do not edit manually. Run scripts/generate-cdm-schema.py")
    lines.append("")
    lines.append("export interface CdmColumn {")
    lines.append("  name: string;")
    lines.append("  type: string;")
    lines.append("  required: boolean;")
    lines.append("  description: string;")
    lines.append("}")
    lines.append("")
    lines.append("export interface CdmTable {")
    lines.append("  name: string;")
    lines.append("  domain: string;")
    lines.append("  columns: CdmColumn[];")
    lines.append("}")
    lines.append("")
    lines.append("export const CDM_SCHEMA_V54: CdmTable[] = [")

    for table in schema:
        lines.append("  {")
        lines.append(f'    name: "{table["name"]}",')
        lines.append(f'    domain: "{table["domain"]}",')
        lines.append("    columns: [")
        for col in table["columns"]:
            req = "true" if col["required"] else "false"
            desc = escape_ts_string(col["description"])
            lines.append(
                f'      {{ name: "{col["name"]}", type: "{col["type"]}", '
                f'required: {req}, description: "{desc}" }},'
            )
        lines.append("    ],")
        lines.append("  },")

    lines.append("];")
    lines.append("")
    return "\n".join(lines)


def generate_php(schema: list[dict[str, Any]]) -> str:
    """Generate PHP source for the CDM schema."""
    lines: list[str] = []
    lines.append("<?php")
    lines.append("")
    lines.append("// GENERATED — do not edit manually. Run scripts/generate-cdm-schema.py")
    lines.append("")
    lines.append("return [")

    for table in schema:
        lines.append("    [")
        lines.append(f"        'name' => '{table['name']}',")
        lines.append(f"        'domain' => '{table['domain']}',")
        lines.append("        'columns' => [")
        for col in table["columns"]:
            req = "true" if col["required"] else "false"
            desc = escape_php_string(col["description"])
            lines.append(
                f"            ['name' => '{col['name']}', 'type' => '{col['type']}', "
                f"'required' => {req}, 'description' => '{desc}'],"
            )
        lines.append("        ],")
        lines.append("    ],")

    lines.append("];")
    lines.append("")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def build_schema(tables_dict: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    """Convert a dict of table_name -> columns into the final schema list."""
    schema: list[dict[str, Any]] = []
    for table_name, columns in tables_dict.items():
        domain = DOMAIN_MAP.get(table_name, "Other")
        schema.append({"name": table_name, "domain": domain, "columns": columns})
    return schema


def main() -> None:
    print("CDM v5.4 Schema Generator")
    print("=" * 50)

    tables_dict: dict[str, list[dict[str, Any]]] | None = None

    # Try fetching from GitHub
    try:
        print("\nStep 1: Fetching CDM v5.4 CSV specs from OHDSI GitHub...")
        field_rows = fetch_csv(FIELD_CSV_URL)
        tables_dict = parse_fields(field_rows)
        print(f"  Parsed {len(tables_dict)} tables from CSV")
    except Exception as e:
        print(f"  WARNING: Failed to fetch CSV ({e})")
        print("  Falling back to hardcoded core table definitions...")

    if not tables_dict:
        tables_dict = FALLBACK_TABLES
        print(f"  Using {len(tables_dict)} hardcoded tables")

    # Build schema
    schema = build_schema(tables_dict)
    total_cols = sum(len(t["columns"]) for t in schema)
    print(f"\nSchema: {len(schema)} tables, {total_cols} total columns")

    # Generate outputs
    print(f"\nStep 2: Generating TypeScript output -> {TS_OUTPUT}")
    ts_content = generate_ts(schema)
    os.makedirs(os.path.dirname(TS_OUTPUT), exist_ok=True)
    with open(TS_OUTPUT, "w", encoding="utf-8") as f:
        f.write(ts_content)
    print(f"  Written {len(ts_content)} bytes")

    print(f"\nStep 3: Generating PHP output -> {PHP_OUTPUT}")
    php_content = generate_php(schema)
    os.makedirs(os.path.dirname(PHP_OUTPUT), exist_ok=True)
    with open(PHP_OUTPUT, "w", encoding="utf-8") as f:
        f.write(php_content)
    print(f"  Written {len(php_content)} bytes")

    print("\nDone!")


if __name__ == "__main__":
    main()
