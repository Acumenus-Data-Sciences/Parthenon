"""DiagnosticReport mapper unit tests (Plan 7 PR-C)."""

from __future__ import annotations

import pytest
from sqlalchemy import create_engine, text

from runtime.fhir_to_omop.concept_resolver import ConceptResolver
from runtime.fhir_to_omop.diagnostic_report import (
    DiagnosticReportRow,
    map_diagnostic_report,
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
            text("INSERT INTO concept VALUES " "(40757491, 'Lipid panel', 'LOINC', '24331-1', 'S')")
        )
    return eng


def _resolver(engine):
    return ConceptResolver(engine=engine, vocab_schema="main")


def test_map_lab_diagnostic_report(engine) -> None:
    fhir = {
        "resourceType": "DiagnosticReport",
        "id": "dr1",
        "status": "final",
        "category": [{"coding": [{"code": "LAB"}]}],
        "code": {"coding": [{"system": "http://loinc.org", "code": "24331-1"}]},
        "subject": {"reference": "Patient/p1"},
        "encounter": {"reference": "Encounter/e1"},
        "effectiveDateTime": "2026-04-01T08:00:00Z",
        "conclusion": "All values within normal limits.",
    }
    row = map_diagnostic_report(fhir, _resolver(engine))
    assert isinstance(row, DiagnosticReportRow)
    assert row.observation_concept_id == 40757491
    assert row.value_as_string == "All values within normal limits."
    assert row.observation_date == "2026-04-01"


def test_map_diagnostic_report_no_conclusion(engine) -> None:
    fhir = {
        "resourceType": "DiagnosticReport",
        "id": "dr2",
        "status": "final",
        "category": [{"coding": [{"code": "LAB"}]}],
        "code": {"coding": [{"system": "http://loinc.org", "code": "24331-1"}]},
        "subject": {"reference": "Patient/p1"},
        "effectiveDateTime": "2026-04-01",
    }
    row = map_diagnostic_report(fhir, _resolver(engine))
    assert row.value_as_string is None


def test_map_diagnostic_report_unknown_code(engine) -> None:
    fhir = {
        "resourceType": "DiagnosticReport",
        "id": "dr3",
        "status": "final",
        "category": [{"coding": [{"code": "RAD"}]}],
        "code": {"coding": [{"system": "http://loinc.org", "code": "999999"}]},
        "subject": {"reference": "Patient/p1"},
        "effectiveDateTime": "2026-04-01",
    }
    row = map_diagnostic_report(fhir, _resolver(engine))
    assert row.observation_concept_id == 0


def test_map_diagnostic_report_missing_subject_raises(engine) -> None:
    fhir = {
        "resourceType": "DiagnosticReport",
        "id": "dr4",
        "status": "final",
        "category": [{"coding": [{"code": "LAB"}]}],
        "code": {"coding": [{"system": "http://loinc.org", "code": "24331-1"}]},
        "effectiveDateTime": "2026-04-01",
    }
    with pytest.raises(ValueError, match="subject"):
        map_diagnostic_report(fhir, _resolver(engine))
