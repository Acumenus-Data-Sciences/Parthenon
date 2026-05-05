"""Observation -> MEASUREMENT vs OBSERVATION splitter."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from runtime.fhir_to_omop.concept_resolver import ConceptResolver
from runtime.fhir_to_omop.observation import (
    MeasurementRow,
    ObservationRow,
    map_observation,
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
            text(
                "INSERT INTO concept VALUES "
                "(3004249, 'Systolic blood pressure', 'LOINC', '8480-6', 'S'), "
                "(3025315, 'Body weight', 'LOINC', '29463-7', 'S')"
            )
        )
    return eng


def _resolver(engine):
    return ConceptResolver(engine=engine, vocab_schema="main")


def test_vital_sign_routes_to_measurement(engine) -> None:
    fhir = {
        "resourceType": "Observation",
        "id": "o1",
        "status": "final",
        "category": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                        "code": "vital-signs",
                    }
                ]
            }
        ],
        "code": {"coding": [{"system": "http://loinc.org", "code": "8480-6"}]},
        "subject": {"reference": "Patient/p1"},
        "effectiveDateTime": "2026-04-01T08:30:00Z",
        "valueQuantity": {"value": 120, "unit": "mmHg"},
    }
    row = map_observation(fhir, _resolver(engine))
    assert isinstance(row, MeasurementRow)
    assert row.measurement_concept_id == 3004249
    assert row.value_as_number == 120.0


def test_laboratory_routes_to_measurement(engine) -> None:
    fhir = {
        "resourceType": "Observation",
        "id": "o2",
        "status": "final",
        "category": [{"coding": [{"code": "laboratory"}]}],
        "code": {"coding": [{"system": "http://loinc.org", "code": "29463-7"}]},
        "subject": {"reference": "Patient/p1"},
        "effectiveDateTime": "2026-04-01",
        "valueQuantity": {"value": 75, "unit": "kg"},
    }
    row = map_observation(fhir, _resolver(engine))
    assert isinstance(row, MeasurementRow)


def test_social_history_routes_to_observation(engine) -> None:
    fhir = {
        "resourceType": "Observation",
        "id": "o3",
        "status": "final",
        "category": [{"coding": [{"code": "social-history"}]}],
        "code": {"coding": [{"system": "http://loinc.org", "code": "72166-2"}]},
        "subject": {"reference": "Patient/p1"},
        "effectiveDateTime": "2026-04-01",
        "valueCodeableConcept": {
            "coding": [
                {
                    "system": "http://loinc.org",
                    "code": "LA15920-4",
                    "display": "Never smoker",
                }
            ]
        },
    }
    row = map_observation(fhir, _resolver(engine))
    assert isinstance(row, ObservationRow)


def test_no_category_defaults_to_observation(engine) -> None:
    fhir = {
        "resourceType": "Observation",
        "id": "o4",
        "status": "final",
        "code": {"coding": [{"system": "http://loinc.org", "code": "8480-6"}]},
        "subject": {"reference": "Patient/p1"},
        "effectiveDateTime": "2026-04-01",
    }
    row = map_observation(fhir, _resolver(engine))
    assert isinstance(row, ObservationRow)


def test_value_string_lands_in_observation_value_as_string(engine) -> None:
    fhir = {
        "resourceType": "Observation",
        "id": "o5",
        "status": "final",
        "category": [{"coding": [{"code": "social-history"}]}],
        "code": {"coding": [{"system": "http://loinc.org", "code": "8480-6"}]},
        "subject": {"reference": "Patient/p1"},
        "effectiveDateTime": "2026-04-01",
        "valueString": "Patient declined to answer",
    }
    row = map_observation(fhir, _resolver(engine))
    assert isinstance(row, ObservationRow)
    assert row.value_as_string == "Patient declined to answer"


def test_observation_with_encounter_carries_visit_source_value(engine) -> None:
    fhir = {
        "resourceType": "Observation",
        "id": "o6",
        "status": "final",
        "category": [{"coding": [{"code": "vital-signs"}]}],
        "code": {"coding": [{"system": "http://loinc.org", "code": "8480-6"}]},
        "subject": {"reference": "Patient/p1"},
        "encounter": {"reference": "Encounter/e1"},
        "effectiveDateTime": "2026-04-01",
        "valueQuantity": {"value": 120, "unit": "mmHg"},
    }
    row = map_observation(fhir, _resolver(engine))
    assert row.visit_source_value == "e1"
