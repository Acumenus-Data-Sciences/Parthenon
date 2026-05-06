"""NAACCR cancer-registry typed Pydantic model.

Phase 3 Plan 4A Task 2 (T-022A). A curated ~80-item subset of NAACCR's
700+ data items, focused on the fields that drive OMOP
CONDITION_OCCURRENCE + EPISODE + EPISODE_EVENT projection.

Reference: NAACCR Data Dictionary v23. Field names use the NAACCR
Item Name (in snake_case) for stability — these names are stable
across NAACCR versions; the Item Numbers occasionally renumber.

Out of scope for v0.1:

- Site-specific factors (NAACCR Items 2880-2999)
- Full address fields beyond county/state
- Special-handling fields for specific cancer types

Phase 4 may extend this set if commercial customers need richer
projection.
"""

from __future__ import annotations

from datetime import date
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field

# ICD-O-3 behavior code values relevant for OMOP projection.
# 0 = benign, 1 = uncertain, 2 = in-situ, 3 = malignant primary,
# 6 = malignant metastatic. EPISODE projection focuses on 3.
BehaviorCode = Literal["0", "1", "2", "3", "6"]


class NAACCRRecord(BaseModel):
    """One NAACCR patient-tumor record.

    NAACCR data is fixed-width per the Layout — the reader
    (Task 3) extracts each field by column position. The model is
    intentionally domain-shape, not layout-shape, so the field set
    can evolve without renumbering test fixtures.
    """

    model_config = ConfigDict(extra="forbid", frozen=True)

    # ---- Patient identity (Items 20-30, 2230-2240) ---------------------
    patient_id_number: str = Field(min_length=1)
    tumor_record_number: int = Field(ge=1)
    name_last: str
    name_first: str
    date_of_birth: date
    sex: str  # NAACCR 220: 1=Male, 2=Female, 3-9=other / unknown
    race_1: str  # NAACCR 160: 01=White, 02=Black, etc.
    spanish_hispanic_origin: str  # NAACCR 190: 0=Non, 1-8=Hispanic subtypes

    # ---- Tumor identity / diagnosis (Items 400-500) --------------------
    primary_site: str = Field(min_length=4, max_length=4)  # ICD-O-3 topog
    histologic_type_icdo3: str = Field(min_length=4, max_length=4)
    behavior_code_icdo3: BehaviorCode
    grade: str | None = None  # NAACCR 440: 1-4 = differentiation
    date_of_diagnosis: date
    diagnostic_confirmation: str  # NAACCR 490: 1=histology, 7=clinical, etc.

    # ---- AJCC staging (Items 940-1040) ---------------------------------
    ajcc_stage_group: str | None = None  # 0, I, IIA, IIB, III, IV, OC
    ajcc_t: str | None = None
    ajcc_n: str | None = None
    ajcc_m: str | None = None

    # ---- First-course treatment summary (Items 1290-1410) --------------
    rx_summary_surgery: str | None = None  # NAACCR 1290
    rx_summary_chemo: str | None = None  # NAACCR 1390
    rx_summary_radiation: str | None = None  # NAACCR 1360
    rx_summary_hormone: str | None = None  # NAACCR 1410

    # ---- Vital status / follow-up (Items 1750-1760) --------------------
    vital_status: str | None = None  # 1=alive, 0=dead
    date_of_last_contact: date | None = None
    cause_of_death: str | None = None  # ICD-10 code


__all__ = ["BehaviorCode", "NAACCRRecord"]
