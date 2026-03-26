"""Pandera schema for condition_occurrence output validation.

Validates the staging CSV against OMOP CDM v5.4 condition_occurrence requirements.
Used after condition extraction to ensure output conformance before downstream use.
"""

from __future__ import annotations

import pandera as pa

condition_occurrence_schema = pa.DataFrameSchema(
    columns={
        "condition_occurrence_id": pa.Column(
            int,
            nullable=False,
            unique=True,
            description="Auto-generated sequential condition occurrence ID",
        ),
        "person_id": pa.Column(
            int,
            nullable=False,
            description="FK to person table via person_id_map",
        ),
        "condition_concept_id": pa.Column(
            int,
            nullable=False,
            description="SNOMED concept_id (0 for unmapped conditions)",
        ),
        "condition_start_date": pa.Column(
            str,
            nullable=False,
            checks=pa.Check.str_matches(
                r"^\d{4}-\d{2}-\d{2}$",
                error="condition_start_date must be ISO YYYY-MM-DD format",
            ),
            description="Condition start date in ISO format",
        ),
        "condition_end_date": pa.Column(
            str,
            nullable=True,
            checks=pa.Check.str_matches(
                r"^\d{4}-\d{2}-\d{2}$",
                error="condition_end_date must be ISO YYYY-MM-DD format",
            ),
            description="Condition end date in ISO format (nullable)",
        ),
        "condition_type_concept_id": pa.Column(
            int,
            nullable=False,
            checks=pa.Check.equal_to(32879),
            description="32879 = Registry data type",
        ),
        "condition_status_concept_id": pa.Column(
            int,
            nullable=True,
            description="Condition status concept (0 for not specified)",
        ),
        "stop_reason": pa.Column(
            str,
            nullable=True,
            description="Reason condition stopped (from Resolved column in Infections)",
        ),
        "provider_id": pa.Column(
            nullable=True,
            required=False,
            description="Not available in IRSF data",
        ),
        "visit_occurrence_id": pa.Column(
            "Int64",
            nullable=True,
            description="FK to visit_occurrence via VisitResolver",
        ),
        "visit_detail_id": pa.Column(
            nullable=True,
            required=False,
            description="Not available in IRSF data",
        ),
        "condition_source_value": pa.Column(
            str,
            nullable=False,
            description="Original diagnosis text preserving source traceability",
        ),
        "condition_source_concept_id": pa.Column(
            int,
            nullable=True,
            description="Raw pre-mapped SNOMED code before validation (0 if none)",
        ),
    },
    coerce=True,
    strict=False,
    name="ConditionOccurrence",
    description="Schema for OMOP CDM v5.4 condition_occurrence staging output",
)
