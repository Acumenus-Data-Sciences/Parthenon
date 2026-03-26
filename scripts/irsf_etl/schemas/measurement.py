"""Pandera schema for measurement output validation.

Validates the staging CSV against OMOP CDM v5.4 measurement requirements.
Used after measurement ETL to ensure output conformance before downstream use.
"""

from __future__ import annotations

import pandas as pd
import pandera as pa

# Use pandas nullable Int64 for columns that can contain None values
_NULLABLE_INT = pd.Int64Dtype()

measurement_schema = pa.DataFrameSchema(
    columns={
        "measurement_id": pa.Column(
            int,
            nullable=False,
            unique=True,
            description="Auto-generated sequential measurement ID",
        ),
        "person_id": pa.Column(
            int,
            nullable=False,
            description="FK to person table via person_id_map",
        ),
        "measurement_concept_id": pa.Column(
            int,
            nullable=False,
            description="Standard concept ID for this measurement (LOINC, custom IRSF)",
        ),
        "measurement_date": pa.Column(
            str,
            nullable=False,
            checks=pa.Check.str_matches(
                r"^\d{4}-\d{2}-\d{2}$",
                error="measurement_date must be ISO YYYY-MM-DD format",
            ),
            description="Measurement date in ISO format",
        ),
        "measurement_type_concept_id": pa.Column(
            int,
            nullable=False,
            checks=pa.Check.equal_to(32882),
            description="32882 = Survey/registry data",
        ),
        "operator_concept_id": pa.Column(
            _NULLABLE_INT,
            nullable=True,
            description="Operator concept (e.g., 4172703 = equals)",
        ),
        "value_as_number": pa.Column(
            float,
            nullable=True,
            description="Numeric measurement value",
        ),
        "value_as_concept_id": pa.Column(
            _NULLABLE_INT,
            nullable=True,
            description="Concept ID for categorical measurement values",
        ),
        "unit_concept_id": pa.Column(
            _NULLABLE_INT,
            nullable=True,
            description="Unit concept ID (e.g., 8582=cm, 9529=kg)",
        ),
        "range_low": pa.Column(
            float,
            nullable=True,
            description="Normal range lower bound",
        ),
        "range_high": pa.Column(
            float,
            nullable=True,
            description="Normal range upper bound",
        ),
        "provider_id": pa.Column(
            nullable=True,
            required=False,
            description="Not available in IRSF data",
        ),
        "visit_occurrence_id": pa.Column(
            _NULLABLE_INT,
            nullable=True,
            description="FK to visit_occurrence table",
        ),
        "visit_detail_id": pa.Column(
            nullable=True,
            required=False,
            description="Not available in IRSF data",
        ),
        "measurement_source_value": pa.Column(
            str,
            nullable=True,
            description="Original source column name and qualifiers",
        ),
        "measurement_source_concept_id": pa.Column(
            _NULLABLE_INT,
            nullable=True,
            description="Source concept ID (0 for unmapped)",
        ),
        "unit_source_value": pa.Column(
            str,
            nullable=True,
            description="Original unit string from source data",
        ),
        "unit_source_concept_id": pa.Column(
            _NULLABLE_INT,
            nullable=True,
            description="Source unit concept ID",
        ),
        "value_source_value": pa.Column(
            str,
            nullable=True,
            description="Original value string from source data",
        ),
    },
    coerce=True,
    strict=False,
    name="Measurement",
    description="Schema for OMOP CDM v5.4 measurement staging output",
)
