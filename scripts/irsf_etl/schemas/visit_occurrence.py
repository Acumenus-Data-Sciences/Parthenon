"""Pandera schema for visit_occurrence output validation.

Validates the staging CSV against OMOP CDM v5.4 visit_occurrence requirements.
Used after visit derivation to ensure output conformance before downstream use.
"""

from __future__ import annotations

import pandera as pa

visit_occurrence_schema = pa.DataFrameSchema(
    columns={
        "visit_occurrence_id": pa.Column(
            int,
            nullable=False,
            unique=True,
            description="Auto-generated sequential visit ID",
        ),
        "person_id": pa.Column(
            int,
            nullable=False,
            description="FK to person table via person_id_map",
        ),
        "visit_concept_id": pa.Column(
            int,
            nullable=False,
            checks=pa.Check.isin([9201, 9202, 9203]),
            description="9201=Inpatient, 9202=Outpatient, 9203=ER",
        ),
        "visit_start_date": pa.Column(
            str,
            nullable=False,
            checks=pa.Check.str_matches(
                r"^\d{4}-\d{2}-\d{2}$",
                error="visit_start_date must be ISO YYYY-MM-DD format",
            ),
            description="Visit start date in ISO format",
        ),
        "visit_end_date": pa.Column(
            str,
            nullable=False,
            checks=pa.Check.str_matches(
                r"^\d{4}-\d{2}-\d{2}$",
                error="visit_end_date must be ISO YYYY-MM-DD format",
            ),
            description="Visit end date in ISO format",
        ),
        "visit_type_concept_id": pa.Column(
            int,
            nullable=False,
            checks=pa.Check.equal_to(32882),
            description="32882 = Survey/registry data",
        ),
        "visit_source_value": pa.Column(
            str,
            nullable=True,
            description="Original visit label (Baseline, 2 years, Hospital, ER, etc.)",
        ),
        "visit_source_concept_id": pa.Column(
            int,
            nullable=True,
            description="Source concept ID (0 for unmapped)",
        ),
        "provider_id": pa.Column(
            nullable=True,
            required=False,
            description="Not available in IRSF data",
        ),
        "care_site_id": pa.Column(
            nullable=True,
            required=False,
            description="Not available in IRSF data",
        ),
        "admitted_from_concept_id": pa.Column(
            nullable=True,
            required=False,
            description="Admitted from concept",
        ),
        "admitted_from_source_value": pa.Column(
            nullable=True,
            required=False,
            description="Admitted from source value",
        ),
        "discharged_to_concept_id": pa.Column(
            nullable=True,
            required=False,
            description="Discharged to concept",
        ),
        "discharged_to_source_value": pa.Column(
            nullable=True,
            required=False,
            description="Discharged to source value",
        ),
        "preceding_visit_occurrence_id": pa.Column(
            nullable=True,
            required=False,
            description="FK to preceding visit (populated in post-processing)",
        ),
    },
    coerce=True,
    strict=False,
    name="VisitOccurrence",
    description="Schema for OMOP CDM v5.4 visit_occurrence staging output",
)
