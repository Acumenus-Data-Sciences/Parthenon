"""Pandera schema for observation output validation.

Validates the staging CSV against OMOP CDM v5.4 observation table requirements.
Used after MBA, CSS, and other observation transforms to ensure output conformance.
"""

from __future__ import annotations

import pandera as pa

observation_schema = pa.DataFrameSchema(
    columns={
        "observation_id": pa.Column(
            int,
            nullable=False,
            unique=True,
            checks=pa.Check.greater_than(0),
            description="Auto-generated sequential observation ID",
        ),
        "person_id": pa.Column(
            int,
            nullable=False,
            checks=pa.Check.greater_than(0),
            description="FK to person table via person_id_map",
        ),
        "observation_concept_id": pa.Column(
            int,
            nullable=False,
            checks=pa.Check.greater_than_or_equal_to(0),
            description="OMOP concept_id for the observation (custom IRSF or standard)",
        ),
        "observation_date": pa.Column(
            str,
            nullable=False,
            checks=pa.Check.str_matches(
                r"^\d{4}-\d{2}-\d{2}$",
                error="observation_date must be ISO YYYY-MM-DD format",
            ),
            description="Observation date in ISO format",
        ),
        "observation_type_concept_id": pa.Column(
            int,
            nullable=False,
            checks=pa.Check.greater_than(0),
            description="Type concept (32883 = Survey for IRSF data)",
        ),
        "value_as_number": pa.Column(
            float,
            nullable=True,
            description="Numeric value (e.g., score for MBA/CSS items)",
        ),
        "value_as_string": pa.Column(
            str,
            nullable=True,
            description="String value (used for free-text observations)",
        ),
        "value_as_concept_id": pa.Column(
            int,
            nullable=True,
            description="Concept ID for coded values",
        ),
        "observation_source_value": pa.Column(
            str,
            nullable=False,
            checks=pa.Check(
                lambda s: s.str.len() > 0,
                error="observation_source_value must be non-empty",
            ),
            description="Original source column name or value",
        ),
        "observation_source_concept_id": pa.Column(
            int,
            nullable=False,
            checks=pa.Check.greater_than_or_equal_to(0),
            description="Source concept ID (equals observation_concept_id for custom IRSF)",
        ),
        "visit_occurrence_id": pa.Column(
            int,
            nullable=True,
            description="FK to visit_occurrence via visit_id_map",
        ),
        "qualifier_source_value": pa.Column(
            str,
            nullable=True,
            description="Qualifier source value (e.g., visit label)",
        ),
    },
    coerce=True,
    strict=False,
    name="Observation",
    description="Schema for OMOP CDM v5.4 observation staging output",
)
