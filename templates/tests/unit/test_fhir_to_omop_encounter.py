"""Encounter -> VISIT_OCCURRENCE mapper."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from runtime.fhir_to_omop.concept_resolver import ConceptResolver
from runtime.fhir_to_omop.encounter import VisitRow, map_encounter


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
                "(38004247, 'New patient encounter', 'SNOMED', '185463005', 'S')"
            )
        )
    return eng


def _resolver(engine):
    return ConceptResolver(engine=engine, vocab_schema="main")


def test_map_minimal_encounter(engine) -> None:
    fhir = {
        "resourceType": "Encounter",
        "id": "e1",
        "status": "finished",
        "class": {
            "system": "http://terminology.hl7.org/CodeSystem/v3-ActCode",
            "code": "AMB",
        },
        "subject": {"reference": "Patient/p1"},
        "period": {"start": "2026-04-01T08:00:00Z", "end": "2026-04-01T09:30:00Z"},
    }
    visit = map_encounter(fhir, _resolver(engine))
    assert isinstance(visit, VisitRow)
    assert visit.visit_source_value == "e1"
    assert visit.person_source_value == "p1"
    assert visit.visit_concept_id == 9202
    assert visit.visit_start_date == "2026-04-01"
    assert visit.visit_end_date == "2026-04-01"


def test_map_inpatient_class(engine) -> None:
    fhir = {
        "resourceType": "Encounter",
        "id": "e2",
        "status": "finished",
        "class": {"code": "IMP"},
        "subject": {"reference": "Patient/p1"},
        "period": {"start": "2026-04-01"},
    }
    visit = map_encounter(fhir, _resolver(engine))
    assert visit.visit_concept_id == 9201


def test_map_unknown_class_uses_zero(engine) -> None:
    fhir = {
        "resourceType": "Encounter",
        "id": "e3",
        "status": "finished",
        "class": {"code": "MADE_UP"},
        "subject": {"reference": "Patient/p1"},
        "period": {"start": "2026-04-01"},
    }
    visit = map_encounter(fhir, _resolver(engine))
    assert visit.visit_concept_id == 0


def test_map_encounter_with_type_resolves_source_concept(engine) -> None:
    fhir = {
        "resourceType": "Encounter",
        "id": "e4",
        "status": "finished",
        "class": {"code": "AMB"},
        "subject": {"reference": "Patient/p1"},
        "period": {"start": "2026-04-01"},
        "type": [{"coding": [{"system": "http://snomed.info/sct", "code": "185463005"}]}],
    }
    visit = map_encounter(fhir, _resolver(engine))
    assert visit.visit_source_concept_id == 38004247


def test_map_encounter_missing_subject_raises(engine) -> None:
    fhir = {
        "resourceType": "Encounter",
        "id": "e5",
        "status": "finished",
        "class": {"code": "AMB"},
        "period": {"start": "2026-04-01"},
    }
    with pytest.raises(ValueError, match="subject"):
        map_encounter(fhir, _resolver(engine))


def test_map_encounter_no_period_end_uses_start(engine) -> None:
    """When period.end is absent, visit_end_date defaults to visit_start_date."""
    fhir = {
        "resourceType": "Encounter",
        "id": "e6",
        "status": "in-progress",
        "class": {"code": "AMB"},
        "subject": {"reference": "Patient/p1"},
        "period": {"start": "2026-04-01T08:00:00Z"},
    }
    visit = map_encounter(fhir, _resolver(engine))
    assert visit.visit_start_date == "2026-04-01"
    assert visit.visit_end_date == "2026-04-01"
