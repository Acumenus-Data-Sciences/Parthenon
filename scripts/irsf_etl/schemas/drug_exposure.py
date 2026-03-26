"""Pandera schema for drug_exposure output validation.

Validates the staging CSV against OMOP CDM v5.4 drug_exposure requirements.
Used after medication ETL to ensure output conformance before loading.
"""

from __future__ import annotations

import pandera as pa

drug_exposure_schema = pa.DataFrameSchema(
    columns={
        "drug_exposure_id": pa.Column(
            int,
            nullable=False,
            unique=True,
            description="Auto-generated sequential drug exposure ID",
        ),
        "person_id": pa.Column(
            int,
            nullable=False,
            description="FK to person table via person_id_map",
        ),
        "drug_concept_id": pa.Column(
            int,
            nullable=False,
            description="Standard RxNorm concept ID (0 for unmapped)",
        ),
        "drug_exposure_start_date": pa.Column(
            str,
            nullable=False,
            checks=pa.Check.str_matches(
                r"^\d{4}-\d{2}-\d{2}$",
                error="drug_exposure_start_date must be ISO YYYY-MM-DD format",
            ),
            description="Drug exposure start date in ISO format",
        ),
        "drug_exposure_end_date": pa.Column(
            str,
            nullable=True,
            checks=pa.Check.str_matches(
                r"^\d{4}-\d{2}-\d{2}$",
                error="drug_exposure_end_date must be ISO YYYY-MM-DD format",
            ),
            description="Drug exposure end date in ISO format",
        ),
        "drug_type_concept_id": pa.Column(
            int,
            nullable=False,
            checks=pa.Check.equal_to(32882),
            description="32882 = Survey/registry data",
        ),
        "stop_reason": pa.Column(
            str,
            nullable=True,
            description="Reason for stopping medication (semicolon-separated)",
        ),
        "visit_occurrence_id": pa.Column(
            int,
            nullable=True,
            description="FK to visit_occurrence table",
        ),
        "drug_source_value": pa.Column(
            str,
            nullable=True,
            description="Original medication name and RxNorm code string",
        ),
        "drug_source_concept_id": pa.Column(
            int,
            nullable=True,
            description="Pre-mapped RxNorm concept ID before vocabulary validation",
        ),
        # Nullable OMOP columns not populated in IRSF data
        "drug_exposure_start_datetime": pa.Column(
            str,
            nullable=True,
            required=False,
            description="Start datetime (not available in IRSF)",
        ),
        "drug_exposure_end_datetime": pa.Column(
            str,
            nullable=True,
            required=False,
            description="End datetime (not available in IRSF)",
        ),
        "verbatim_end_date": pa.Column(
            str,
            nullable=True,
            required=False,
            description="Verbatim end date as recorded in source",
        ),
        "refills": pa.Column(
            int,
            nullable=True,
            required=False,
            description="Number of refills",
        ),
        "quantity": pa.Column(
            float,
            nullable=True,
            required=False,
            description="Quantity dispensed",
        ),
        "days_supply": pa.Column(
            int,
            nullable=True,
            required=False,
            description="Number of days of supply",
        ),
        "sig": pa.Column(
            str,
            nullable=True,
            required=False,
            description="Directions for use (sig)",
        ),
        "route_concept_id": pa.Column(
            int,
            nullable=True,
            required=False,
            description="Route of administration concept ID",
        ),
        "lot_number": pa.Column(
            str,
            nullable=True,
            required=False,
            description="Lot number",
        ),
        "provider_id": pa.Column(
            int,
            nullable=True,
            required=False,
            description="FK to provider table",
        ),
        "visit_detail_id": pa.Column(
            int,
            nullable=True,
            required=False,
            description="FK to visit_detail table",
        ),
        "route_source_value": pa.Column(
            str,
            nullable=True,
            required=False,
            description="Route of administration as recorded in source",
        ),
        "dose_unit_source_value": pa.Column(
            str,
            nullable=True,
            required=False,
            description="Dose unit as recorded in source",
        ),
    },
    coerce=True,
    strict=False,
    name="DrugExposure",
    description="Schema for OMOP CDM v5.4 drug_exposure staging output",
)
