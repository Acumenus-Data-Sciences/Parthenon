"""Phase 3 Plan 4B Task 2 (T-022B): STSRecord typed model."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from runtime.commercial.registry.sts.types import STSRecord


def _kwargs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "record_id": "STS-0001",
        "patient_id": "PAT00001",
        "surgery_date": date(2024, 5, 15),
        "patient_age": 67,
        "gender": "M",
        "hospital_id": "STS-H001",
        "surgeon_id": "STS-S001",
        "ejection_fraction": Decimal("55.0"),
        "nyha_class": 2,
        "primary_diagnosis_icd10": "I25.10",
        "secondary_diagnoses_icd10": ["I50.32", "E11.9"],
        "procedure_category": "CABG",
        "primary_procedure_code": "33533",
        "secondary_procedure_codes": ["33510"],
        "postop_aki": False,
        "postop_stroke": False,
        "postop_reoperation": False,
        "postop_sepsis": False,
        "length_of_stay": 7,
        "discharge_disposition": "Home",
        "mortality_30day": False,
    }
    base.update(overrides)
    return base


def test_constructs_minimal_cabg_record() -> None:
    r = STSRecord(**_kwargs())
    assert r.record_id == "STS-0001"
    assert r.procedure_category == "CABG"
    assert r.length_of_stay == 7
    assert r.mortality_30day is False


def test_extra_fields_rejected() -> None:
    with pytest.raises(ValidationError):
        STSRecord(**_kwargs(unexpected_field="oops"))


def test_frozen_after_construction() -> None:
    r = STSRecord(**_kwargs())
    with pytest.raises(ValidationError):
        r.length_of_stay = 14  # type: ignore[misc]


def test_unknown_procedure_category_rejected() -> None:
    with pytest.raises(ValidationError):
        STSRecord(**_kwargs(procedure_category="Brain"))  # not a thoracic procedure


def test_unknown_gender_rejected() -> None:
    with pytest.raises(ValidationError):
        STSRecord(**_kwargs(gender="X"))


def test_nyha_out_of_range_rejected() -> None:
    with pytest.raises(ValidationError):
        STSRecord(**_kwargs(nyha_class=5))


def test_ef_out_of_range_rejected() -> None:
    with pytest.raises(ValidationError):
        STSRecord(**_kwargs(ejection_fraction=Decimal("150")))


def test_handles_postop_complications_and_mortality() -> None:
    r = STSRecord(
        **_kwargs(
            postop_aki=True,
            postop_stroke=True,
            mortality_30day=True,
            discharge_disposition="Death",
        )
    )
    assert r.postop_aki is True
    assert r.postop_stroke is True
    assert r.mortality_30day is True


def test_aortic_combined_categories_accepted() -> None:
    """v0.1 supports CABG / Valve / Aortic / Combined / Other."""
    for cat in ("Valve", "Aortic", "Combined", "Other"):
        r = STSRecord(**_kwargs(procedure_category=cat))
        assert r.procedure_category == cat
