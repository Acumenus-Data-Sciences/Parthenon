"""MedicationRequest/Statement/Administration -> DRUG_EXPOSURE mappers."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from runtime.fhir_to_omop.concept_resolver import ConceptResolver
from runtime.fhir_to_omop.medication import (
    DrugExposureRow,
    map_medication_administration,
    map_medication_request,
    map_medication_statement,
)


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
            text("INSERT INTO concept VALUES (1503297, 'metformin', 'RxNorm', '6809', 'S')")
        )
    return eng


def _resolver(engine):
    return ConceptResolver(engine=engine, vocab_schema="main")


def test_map_medication_request(engine) -> None:
    fhir = {
        "resourceType": "MedicationRequest",
        "id": "mr1",
        "status": "active",
        "intent": "order",
        "subject": {"reference": "Patient/p1"},
        "encounter": {"reference": "Encounter/e1"},
        "medicationCodeableConcept": {
            "coding": [{"system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "6809"}],
        },
        "authoredOn": "2026-04-01T10:00:00Z",
    }
    row = map_medication_request(fhir, _resolver(engine))
    assert isinstance(row, DrugExposureRow)
    assert row.drug_concept_id == 1503297
    assert row.drug_exposure_start_date == "2026-04-01"
    assert row.drug_type_concept_id == 32839


def test_map_medication_statement(engine) -> None:
    fhir = {
        "resourceType": "MedicationStatement",
        "id": "ms1",
        "status": "active",
        "subject": {"reference": "Patient/p1"},
        "medicationCodeableConcept": {
            "coding": [{"system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "6809"}],
        },
        "effectivePeriod": {"start": "2026-03-01", "end": "2026-04-01"},
    }
    row = map_medication_statement(fhir, _resolver(engine))
    assert row.drug_exposure_start_date == "2026-03-01"
    assert row.drug_exposure_end_date == "2026-04-01"
    assert row.drug_type_concept_id == 38000179


def test_map_medication_administration(engine) -> None:
    fhir = {
        "resourceType": "MedicationAdministration",
        "id": "ma1",
        "status": "completed",
        "subject": {"reference": "Patient/p1"},
        "context": {"reference": "Encounter/e1"},
        "medicationCodeableConcept": {
            "coding": [{"system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "6809"}],
        },
        "effectiveDateTime": "2026-04-01T08:00:00Z",
    }
    row = map_medication_administration(fhir, _resolver(engine))
    assert row.drug_exposure_start_date == "2026-04-01"
    assert row.drug_type_concept_id == 38000180


def test_unknown_medication_returns_zero(engine) -> None:
    fhir = {
        "resourceType": "MedicationRequest",
        "id": "mr2",
        "status": "active",
        "intent": "order",
        "subject": {"reference": "Patient/p1"},
        "medicationCodeableConcept": {
            "coding": [{"system": "http://www.nlm.nih.gov/research/umls/rxnorm", "code": "999999"}],
        },
        "authoredOn": "2026-04-01",
    }
    row = map_medication_request(fhir, _resolver(engine))
    assert row.drug_concept_id == 0


def test_medication_request_missing_subject_raises(engine) -> None:
    fhir = {
        "resourceType": "MedicationRequest",
        "id": "mr3",
        "status": "active",
        "intent": "order",
        "medicationCodeableConcept": {"coding": [{"system": "x", "code": "y"}]},
        "authoredOn": "2026-04-01",
    }
    with pytest.raises(ValueError, match="subject"):
        map_medication_request(fhir, _resolver(engine))
