"""Phase 3 Plan 4A Task 2 (T-022A): NAACCRRecord typed model.

Curated ~80-column subset of NAACCR's 700+ data items, focused on the
fields that drive OMOP CONDITION_OCCURRENCE + EPISODE + EPISODE_EVENT
projection. Reference: NAACCR Data Dictionary v23.

The model is intentionally narrow — Phase 4 follow-up may extend it
with the full data dictionary if commercial customers need richer
projection (e.g., site-specific factors).
"""

from __future__ import annotations

from datetime import date

import pytest
from pydantic import ValidationError

from runtime.commercial.registry.naaccr.types import NAACCRRecord


def _kwargs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "patient_id_number": "PAT0001",
        "tumor_record_number": 1,
        "name_last": "DOE",
        "name_first": "JANE",
        "date_of_birth": date(1955, 3, 15),
        "sex": "2",  # NAACCR Item 220: 2 = Female
        "race_1": "01",  # NAACCR Item 160: 01 = White
        "spanish_hispanic_origin": "0",  # NAACCR Item 190: 0 = Non-Hispanic
        # Tumor-level fields:
        "primary_site": "C509",  # ICD-O-3 topography: breast, NOS
        "histologic_type_icdo3": "8500",  # ICD-O-3 morphology: ductal carcinoma
        "behavior_code_icdo3": "3",  # 3 = malignant, primary
        "grade": "2",  # NAACCR Item 440
        "date_of_diagnosis": date(2024, 3, 1),
        "diagnostic_confirmation": "1",  # 1 = positive histology
        # AJCC staging:
        "ajcc_stage_group": "IIA",
        "ajcc_t": "T2",
        "ajcc_n": "N0",
        "ajcc_m": "M0",
        # Treatment summary:
        "rx_summary_surgery": "30",  # NAACCR 1290: lumpectomy
        "rx_summary_chemo": "02",  # NAACCR 1390: multi-agent
        "rx_summary_radiation": "20",  # NAACCR 1360: external beam
        "rx_summary_hormone": "01",  # NAACCR 1410: hormone therapy
        # Outcome:
        "vital_status": "1",  # 1 = alive
        "date_of_last_contact": date(2025, 3, 1),
    }
    base.update(overrides)
    return base


def test_constructs_from_minimal_fields() -> None:
    record = NAACCRRecord(**_kwargs())
    assert record.patient_id_number == "PAT0001"
    assert record.primary_site == "C509"
    assert record.histologic_type_icdo3 == "8500"
    assert record.behavior_code_icdo3 == "3"
    assert record.ajcc_stage_group == "IIA"


def test_extra_fields_rejected() -> None:
    with pytest.raises(ValidationError):
        NAACCRRecord(**_kwargs(unexpected_field="oops"))


def test_frozen_after_construction() -> None:
    record = NAACCRRecord(**_kwargs())
    with pytest.raises(ValidationError):
        record.tumor_record_number = 2  # type: ignore[misc]


def test_negative_tumor_record_number_rejected() -> None:
    with pytest.raises(ValidationError):
        NAACCRRecord(**_kwargs(tumor_record_number=0))


def test_primary_site_must_be_4_chars() -> None:
    """NAACCR ICD-O-3 topography codes are exactly 4 chars (e.g. C509)."""
    with pytest.raises(ValidationError):
        NAACCRRecord(**_kwargs(primary_site="C50"))  # too short


def test_histologic_type_must_be_4_digits() -> None:
    """ICD-O-3 morphology codes are 4 digits."""
    with pytest.raises(ValidationError):
        NAACCRRecord(**_kwargs(histologic_type_icdo3="850"))


def test_behavior_code_must_be_one_of_known() -> None:
    with pytest.raises(ValidationError):
        NAACCRRecord(**_kwargs(behavior_code_icdo3="9"))  # not a valid code


def test_optional_fields_default_to_none() -> None:
    """Treatment + outcome fields are optional in v0.1; allow None."""
    record = NAACCRRecord(
        **_kwargs(
            rx_summary_chemo=None,
            rx_summary_radiation=None,
            rx_summary_hormone=None,
            vital_status=None,
            date_of_last_contact=None,
        )
    )
    assert record.rx_summary_chemo is None
    assert record.vital_status is None
