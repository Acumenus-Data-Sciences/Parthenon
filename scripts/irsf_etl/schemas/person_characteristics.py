"""Pandera schema for Person_Characteristics input validation.

Validates the core demographic file from the IRSF dataset.
The source file has ~66 columns; this schema validates the critical ones
and allows extras (strict=False).
"""

from __future__ import annotations

import pandera as pa

person_characteristics_schema = pa.DataFrameSchema(
    columns={
        "participant_id": pa.Column(
            str,
            nullable=False,
            unique=True,
            description="Primary participant identifier across all IRSF files",
        ),
        "participant_id5201": pa.Column(
            str,
            nullable=True,
            required=False,
            description="Participant ID from study 5201",
        ),
        "participant_id5211": pa.Column(
            str,
            nullable=True,
            required=False,
            description="Participant ID from study 5211",
        ),
        "ChildsDOB": pa.Column(
            str,
            nullable=True,
            checks=pa.Check.str_matches(
                r"^\d{1,2}/\d{1,2}/\d{2,4}$",
                error="ChildsDOB must match MM/DD/YY or MM/DD/YYYY format",
            ),
            required=False,
            description="Child's date of birth in MM/DD/YY(YY) format",
        ),
        "ChildsGender": pa.Column(
            str,
            nullable=True,
            checks=pa.Check.isin(["Male", "Female", ""]),
            required=False,
            description="Child's gender (Male/Female)",
        ),
        "diagnosis": pa.Column(
            str,
            nullable=True,
            required=False,
            description="Primary diagnosis",
        ),
        "mutation": pa.Column(
            str,
            nullable=True,
            required=False,
            description="Genetic mutation type (MECP2, CDKL5, FOXG1, etc.)",
        ),
    },
    coerce=True,
    strict=False,  # Allow extra columns -- source file has ~66
    name="PersonCharacteristics",
    description="Schema for IRSF Person_Characteristics source file",
)
