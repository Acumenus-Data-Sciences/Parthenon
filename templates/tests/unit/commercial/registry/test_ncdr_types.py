"""Phase 3 Plan 4C Task 2 (T-022C): NCDRRecord typed model."""

from __future__ import annotations

from datetime import date
from decimal import Decimal

import pytest
from pydantic import ValidationError

from runtime.commercial.registry.ncdr.types import NCDRRecord


def _kwargs(**overrides: object) -> dict[str, object]:
    base: dict[str, object] = {
        "record_id": "PCI-0001",
        "patient_id": "PAT00001",
        "procedure_date": date(2024, 6, 1),
        "patient_age": 65,
        "gender": "M",
        "hospital_id": "NCDR-H001",
        "operator_npi": "1234567893",
        "preop_diagnosis_icd10": "I21.4",
        "ejection_fraction": Decimal("45.0"),
        "cardiac_index": Decimal("2.4"),
        "lesion_count": 1,
        "lesion_segments": ["6"],
        "primary_procedure_code": "92928",
        "stent_count": 1,
        "stent_udis": ["08714729123456"],
        "stent_types": ["DES"],
        "postop_bleeding": False,
        "postop_aki": False,
        "postop_stroke": False,
        "length_of_stay": 2,
        "mortality_in_hospital": False,
    }
    base.update(overrides)
    return base


def test_constructs_minimal_pci() -> None:
    r = NCDRRecord(**_kwargs())
    assert r.record_id == "PCI-0001"
    assert r.lesion_count == 1
    assert r.stent_types == ["DES"]


def test_extra_fields_rejected() -> None:
    with pytest.raises(ValidationError):
        NCDRRecord(**_kwargs(unexpected_field="x"))


def test_frozen_after_construction() -> None:
    r = NCDRRecord(**_kwargs())
    with pytest.raises(ValidationError):
        r.length_of_stay = 5  # type: ignore[misc]


def test_npi_must_be_10_chars() -> None:
    with pytest.raises(ValidationError):
        NCDRRecord(**_kwargs(operator_npi="123"))


def test_unknown_stent_type_rejected() -> None:
    with pytest.raises(ValidationError):
        NCDRRecord(**_kwargs(stent_types=["BAD"]))


def test_ef_out_of_range_rejected() -> None:
    with pytest.raises(ValidationError):
        NCDRRecord(**_kwargs(ejection_fraction=Decimal("200")))


def test_lesion_count_zero_allowed() -> None:
    """Diagnostic-only cath (no PCI) carries lesion_count=0."""
    r = NCDRRecord(**_kwargs(lesion_count=0, stent_count=0, stent_udis=[], stent_types=[]))
    assert r.stent_count == 0


def test_multi_stent_pci() -> None:
    r = NCDRRecord(
        **_kwargs(
            lesion_count=2,
            stent_count=2,
            stent_udis=["08714729111111", "08714729222222"],
            stent_types=["DES", "BMS"],
        )
    )
    assert len(r.stent_udis) == 2
    assert r.stent_types == ["DES", "BMS"]
