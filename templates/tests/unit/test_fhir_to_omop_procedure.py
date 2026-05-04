"""Procedure -> PROCEDURE_OCCURRENCE mapper."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from runtime.fhir_to_omop.concept_resolver import ConceptResolver
from runtime.fhir_to_omop.procedure import ProcedureRow, map_procedure


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
            text("INSERT INTO concept VALUES (2002608, 'Appendectomy', 'CPT4', '44950', 'S')")
        )
    return eng


def _resolver(engine):
    return ConceptResolver(engine=engine, vocab_schema="main")


def test_map_procedure_with_cpt_code(engine) -> None:
    fhir = {
        "resourceType": "Procedure",
        "id": "pr1",
        "status": "completed",
        "subject": {"reference": "Patient/p1"},
        "encounter": {"reference": "Encounter/e1"},
        "code": {"coding": [{"system": "http://www.ama-assn.org/go/cpt", "code": "44950"}]},
        "performedDateTime": "2026-04-01T10:00:00Z",
    }
    proc = map_procedure(fhir, _resolver(engine))
    assert isinstance(proc, ProcedureRow)
    assert proc.procedure_source_value == "pr1"
    assert proc.person_source_value == "p1"
    assert proc.visit_source_value == "e1"
    assert proc.procedure_concept_id == 2002608
    assert proc.procedure_date == "2026-04-01"


def test_map_procedure_with_period(engine) -> None:
    fhir = {
        "resourceType": "Procedure",
        "id": "pr2",
        "status": "completed",
        "subject": {"reference": "Patient/p1"},
        "code": {"coding": [{"system": "http://www.ama-assn.org/go/cpt", "code": "44950"}]},
        "performedPeriod": {
            "start": "2026-04-01T10:00:00Z",
            "end": "2026-04-01T12:00:00Z",
        },
    }
    proc = map_procedure(fhir, _resolver(engine))
    assert proc.procedure_date == "2026-04-01"


def test_map_procedure_missing_subject_raises(engine) -> None:
    fhir = {
        "resourceType": "Procedure",
        "id": "pr3",
        "status": "completed",
        "code": {"coding": [{"code": "x"}]},
        "performedDateTime": "2026-04-01",
    }
    with pytest.raises(ValueError, match="subject"):
        map_procedure(fhir, _resolver(engine))


def test_map_procedure_unmapped_code(engine) -> None:
    fhir = {
        "resourceType": "Procedure",
        "id": "pr4",
        "status": "completed",
        "subject": {"reference": "Patient/p1"},
        "code": {"coding": [{"system": "http://www.ama-assn.org/go/cpt", "code": "99999"}]},
        "performedDateTime": "2026-04-01",
    }
    proc = map_procedure(fhir, _resolver(engine))
    assert proc.procedure_concept_id == 0
