"""NCDR CathPCI v5.0 typed Pydantic model.

Phase 3 Plan 4C Task 2 (T-022C). One PCI procedure per row, with
nested lesion + stent lists. The CathPCI v5.0 spec defines ~150 data
items; we curate the subset that drives PROCEDURE_OCCURRENCE +
MEASUREMENT + DEVICE_EXPOSURE + CONDITION_OCCURRENCE + EPISODE
projection.
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# Stent type per ACC Definitions: DES = drug-eluting, BMS = bare-metal,
# BVS = bioresorbable vascular scaffold (rare in v5.0 but accepted).
StentType = Literal["DES", "BMS", "BVS"]


class NCDRRecord(BaseModel):
    """One CathPCI procedure record."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    # Identity
    record_id: str = Field(min_length=1)
    patient_id: str = Field(min_length=1)
    procedure_date: date

    # Demographics + setting
    patient_age: int = Field(ge=0, le=120)
    gender: Literal["M", "F", "U"]
    hospital_id: str
    operator_npi: str = Field(min_length=10, max_length=10)

    # Pre-op
    preop_diagnosis_icd10: str
    ejection_fraction: Decimal = Field(ge=0, le=100)
    cardiac_index: Decimal = Field(ge=0, le=10)

    # Procedure
    lesion_count: int = Field(ge=0)
    lesion_segments: list[str] = Field(default_factory=list)
    primary_procedure_code: str = Field(min_length=1)

    # Devices
    stent_count: int = Field(ge=0)
    stent_udis: list[str] = Field(default_factory=list)
    stent_types: list[StentType] = Field(default_factory=list)

    # Postop complications
    postop_bleeding: bool = False
    postop_aki: bool = False
    postop_stroke: bool = False

    # Outcome
    length_of_stay: int = Field(ge=0)
    mortality_in_hospital: bool = False


__all__ = ["NCDRRecord", "StentType"]
