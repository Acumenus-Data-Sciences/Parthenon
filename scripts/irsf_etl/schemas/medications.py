"""Pandera schema for Medications input validation.

Validates the medications file from the IRSF dataset.
"""

from __future__ import annotations

import pandera as pa

medications_schema = pa.DataFrameSchema(
    columns={
        "participant_id": pa.Column(
            str,
            nullable=False,
            description="Participant identifier linking to Person_Characteristics",
        ),
        "MedName": pa.Column(
            str,
            nullable=True,
            required=False,
            description="Medication name as recorded",
        ),
        "MedRxNormCode": pa.Column(
            str,
            nullable=True,
            required=False,
            description="RxNorm concept code for the medication",
        ),
    },
    coerce=True,
    strict=False,  # Allow extra columns
    name="Medications",
    description="Schema for IRSF Medications source file",
)
