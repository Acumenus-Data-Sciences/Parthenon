"""STS Adult Cardiac Surgery typed Pydantic model.

Phase 3 Plan 4B Task 2 (T-022B). Mirrors ~150 STS data items per the
v4.20.2 spec, focused on fields that drive PROCEDURE_OCCURRENCE +
CONDITION_OCCURRENCE + EPISODE projection.

The STS National Database is a Society of Thoracic Surgeons clinical
quality registry. Exports come as CSV (one row per surgery) with
column shapes defined by the STS Data Specification. We maintain the
``column_map.csv`` (next to the manifest) ourselves since no upstream
OHDSI ETL exists for STS.

Out of scope for v0.1:

- Site-specific data quality flags
- Long-term follow-up beyond 30-day mortality
- ECMO / VAD device-tracking fields
"""

from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# STS procedure categories (a curated v0.1 subset).
ProcedureCategory = Literal["CABG", "Valve", "Aortic", "Combined", "Other"]


class STSRecord(BaseModel):
    """One STS Adult Cardiac Surgery record (one surgery)."""

    model_config = ConfigDict(extra="forbid", frozen=True)

    # Record identity
    record_id: str = Field(min_length=1)
    patient_id: str = Field(min_length=1)
    surgery_date: date

    # Demographics + setting
    patient_age: int = Field(ge=0, le=120)
    gender: Literal["M", "F", "U"]
    hospital_id: str
    surgeon_id: str

    # Pre-op risk factors
    ejection_fraction: Decimal = Field(ge=0, le=100)
    nyha_class: int = Field(ge=1, le=4)

    # Diagnosis (ICD-10-CM)
    primary_diagnosis_icd10: str = Field(min_length=1)
    secondary_diagnoses_icd10: list[str] = Field(default_factory=list)

    # Procedures (CPT/HCPCS)
    procedure_category: ProcedureCategory
    primary_procedure_code: str = Field(min_length=1)
    secondary_procedure_codes: list[str] = Field(default_factory=list)

    # Postop complications (boolean per STS Definition)
    postop_aki: bool = False
    postop_stroke: bool = False
    postop_reoperation: bool = False
    postop_sepsis: bool = False

    # Outcome
    length_of_stay: int = Field(ge=0)
    discharge_disposition: str  # 'Home' / 'SNF' / 'Hospice' / 'Death' / etc.
    mortality_30day: bool = False


__all__ = ["ProcedureCategory", "STSRecord"]
