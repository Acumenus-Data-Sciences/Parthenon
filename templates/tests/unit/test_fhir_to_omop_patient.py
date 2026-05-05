"""Patient -> PERSON mapper."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from runtime.fhir_to_omop.concept_resolver import ConceptResolver
from runtime.fhir_to_omop.patient import PersonRow, map_patient


@pytest.fixture()
def engine_with_vocab():
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
                "(8507, 'MALE', 'Gender', 'M', 'S'), "
                "(8532, 'FEMALE', 'Gender', 'F', 'S'), "
                "(38003563, 'White', 'Race', '2106-3', 'S'), "
                "(38003564, 'Black or African American', 'Race', '2054-5', 'S'), "
                "(38003566, 'Hispanic or Latino', 'Ethnicity', '2135-2', 'S'), "
                "(38003567, 'Not Hispanic or Latino', 'Ethnicity', '2186-5', 'S')"
            )
        )
    return eng


def _resolver(engine_with_vocab):
    return ConceptResolver(engine=engine_with_vocab, vocab_schema="main")


def test_map_minimal_patient(engine_with_vocab) -> None:
    fhir_patient = {
        "resourceType": "Patient",
        "id": "p1",
        "gender": "male",
        "birthDate": "1970-06-15",
    }
    person = map_patient(fhir_patient, _resolver(engine_with_vocab))
    assert isinstance(person, PersonRow)
    assert person.person_source_value == "p1"
    assert person.gender_concept_id == 8507
    assert person.year_of_birth == 1970
    assert person.month_of_birth == 6
    assert person.day_of_birth == 15
    assert person.birth_datetime == "1970-06-15T00:00:00"


def test_map_patient_with_race_and_ethnicity_extensions(engine_with_vocab) -> None:
    fhir_patient = {
        "resourceType": "Patient",
        "id": "p2",
        "gender": "female",
        "birthDate": "1985-03-22",
        "extension": [
            {
                "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-race",
                "extension": [
                    {
                        "url": "ombCategory",
                        "valueCoding": {
                            "system": "urn:oid:2.16.840.1.113883.6.238",
                            "code": "2106-3",
                            "display": "White",
                        },
                    }
                ],
            },
            {
                "url": "http://hl7.org/fhir/us/core/StructureDefinition/us-core-ethnicity",
                "extension": [
                    {
                        "url": "ombCategory",
                        "valueCoding": {
                            "system": "urn:oid:2.16.840.1.113883.6.238",
                            "code": "2186-5",
                            "display": "Not Hispanic or Latino",
                        },
                    }
                ],
            },
        ],
    }
    person = map_patient(fhir_patient, _resolver(engine_with_vocab))
    assert person.gender_concept_id == 8532
    assert person.race_concept_id == 38003563
    assert person.ethnicity_concept_id == 38003567


def test_map_patient_unknown_gender_uses_zero(engine_with_vocab) -> None:
    fhir_patient = {
        "resourceType": "Patient",
        "id": "p3",
        "gender": "unknown",
        "birthDate": "1990-01-01",
    }
    person = map_patient(fhir_patient, _resolver(engine_with_vocab))
    assert person.gender_concept_id == 0


def test_map_patient_partial_birthdate_year_only(engine_with_vocab) -> None:
    fhir_patient = {
        "resourceType": "Patient",
        "id": "p4",
        "gender": "male",
        "birthDate": "1970",
    }
    person = map_patient(fhir_patient, _resolver(engine_with_vocab))
    assert person.year_of_birth == 1970
    assert person.month_of_birth is None
    assert person.day_of_birth is None


def test_map_patient_missing_birthdate_returns_none_year(engine_with_vocab) -> None:
    fhir_patient = {"resourceType": "Patient", "id": "p5", "gender": "male"}
    person = map_patient(fhir_patient, _resolver(engine_with_vocab))
    assert person.year_of_birth is None
