"""Condition -> CONDITION_OCCURRENCE mapper."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from runtime.fhir_to_omop.concept_resolver import ConceptResolver
from runtime.fhir_to_omop.condition import ConditionRow, map_condition


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
                "INSERT INTO concept VALUES " "(4267416, 'Hypertension', 'SNOMED', '38341003', 'S')"
            )
        )
    return eng


def _resolver(engine):
    return ConceptResolver(engine=engine, vocab_schema="main")


def test_map_condition_with_snomed_code(engine) -> None:
    fhir = {
        "resourceType": "Condition",
        "id": "c1",
        "subject": {"reference": "Patient/p1"},
        "encounter": {"reference": "Encounter/e1"},
        "code": {"coding": [{"system": "http://snomed.info/sct", "code": "38341003"}]},
        "onsetDateTime": "2026-03-15T00:00:00Z",
    }
    cond = map_condition(fhir, _resolver(engine))
    assert isinstance(cond, ConditionRow)
    assert cond.condition_source_value == "c1"
    assert cond.person_source_value == "p1"
    assert cond.visit_source_value == "e1"
    assert cond.condition_concept_id == 4267416
    assert cond.condition_start_date == "2026-03-15"


def test_map_condition_no_encounter(engine) -> None:
    fhir = {
        "resourceType": "Condition",
        "id": "c2",
        "subject": {"reference": "Patient/p1"},
        "code": {"coding": [{"system": "http://snomed.info/sct", "code": "38341003"}]},
        "recordedDate": "2026-03-15",
    }
    cond = map_condition(fhir, _resolver(engine))
    assert cond.visit_source_value is None


def test_map_condition_unmapped_code_returns_zero(engine) -> None:
    fhir = {
        "resourceType": "Condition",
        "id": "c3",
        "subject": {"reference": "Patient/p1"},
        "code": {"coding": [{"system": "http://snomed.info/sct", "code": "999999"}]},
        "recordedDate": "2026-03-15",
    }
    cond = map_condition(fhir, _resolver(engine))
    assert cond.condition_concept_id == 0


def test_map_condition_falls_back_to_recorded_date(engine) -> None:
    fhir = {
        "resourceType": "Condition",
        "id": "c4",
        "subject": {"reference": "Patient/p1"},
        "code": {"coding": [{"system": "http://snomed.info/sct", "code": "38341003"}]},
        "recordedDate": "2026-03-15",
    }
    cond = map_condition(fhir, _resolver(engine))
    assert cond.condition_start_date == "2026-03-15"


def test_map_condition_with_abatement(engine) -> None:
    fhir = {
        "resourceType": "Condition",
        "id": "c5",
        "subject": {"reference": "Patient/p1"},
        "code": {"coding": [{"system": "http://snomed.info/sct", "code": "38341003"}]},
        "onsetDateTime": "2026-03-15",
        "abatementDateTime": "2026-04-15",
    }
    cond = map_condition(fhir, _resolver(engine))
    assert cond.condition_end_date == "2026-04-15"
