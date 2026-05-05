"""Immunization -> DRUG_EXPOSURE mapper."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from runtime.fhir_to_omop.concept_resolver import ConceptResolver
from runtime.fhir_to_omop.immunization import map_immunization


@pytest.fixture()
def engine():
    eng = create_engine("sqlite:///:memory:", future=True)
    with eng.begin() as conn:
        conn.execute(
            text(
                "CREATE TABLE concept ("
                "concept_id INTEGER PRIMARY KEY, concept_name TEXT, "
                "vocabulary_id TEXT, concept_code TEXT, standard_concept TEXT)"
            )
        )
        conn.execute(
            text("INSERT INTO concept VALUES (45769446, 'Influenza vaccine', 'CVX', '141', 'S')")
        )
    return eng


def test_map_immunization_with_cvx(engine) -> None:
    fhir = {
        "resourceType": "Immunization",
        "id": "i1",
        "status": "completed",
        "patient": {"reference": "Patient/p1"},
        "encounter": {"reference": "Encounter/e1"},
        "vaccineCode": {"coding": [{"system": "http://hl7.org/fhir/sid/cvx", "code": "141"}]},
        "occurrenceDateTime": "2026-04-01T08:00:00Z",
    }
    row = map_immunization(fhir, ConceptResolver(engine=engine, vocab_schema="main"))
    assert row.drug_source_value == "i1"
    assert row.drug_concept_id == 45769446
    assert row.drug_exposure_start_date == "2026-04-01"
    assert row.drug_type_concept_id == 581452


def test_map_immunization_missing_patient_raises(engine) -> None:
    fhir = {
        "resourceType": "Immunization",
        "id": "i2",
        "status": "completed",
        "vaccineCode": {"coding": [{"system": "x", "code": "y"}]},
        "occurrenceDateTime": "2026-04-01",
    }
    with pytest.raises(ValueError, match="patient"):
        map_immunization(fhir, ConceptResolver(engine=engine, vocab_schema="main"))
