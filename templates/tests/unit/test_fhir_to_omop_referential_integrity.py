"""Cross-resource referential integrity for the fhir_to_omop PR-A pipeline.

Runs the four mappers in-process against the shipped fixture corpus +
synthetic vocab, then asserts:

  - Every Condition/Measurement/Observation's person_source_value resolves
    to a Patient in the input corpus (no orphan person references).
  - Every Condition/Measurement/Observation that declares a non-NULL
    visit_source_value resolves to an Encounter in the input corpus
    (no orphan visit references).

The E2E test (test_fhir_to_omop_pra.py) covers the SQL-level integrity
post-load. This unit test covers the mapping-layer invariant before any
DB writes — keeps the regression surface tight.
"""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text

from runtime.fhir_to_omop.concept_resolver import ConceptResolver
from runtime.fhir_to_omop.condition import map_condition
from runtime.fhir_to_omop.encounter import map_encounter
from runtime.fhir_to_omop.observation import (
    MeasurementRow,
    ObservationRow,
    map_observation,
)
from runtime.fhir_to_omop.patient import map_patient

REPO = Path(__file__).resolve().parents[2]
FIXTURES = REPO / "manifests" / "fhir_to_omop" / "fixtures" / "sample"


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
                "(38003567, 'Not Hispanic or Latino', 'Ethnicity', '2186-5', 'S'), "
                "(4267416, 'Hypertension', 'SNOMED', '38341003', 'S'), "
                "(4112343, 'Asthma', 'SNOMED', '195967001', 'S'), "
                "(3004249, 'Systolic BP', 'LOINC', '8480-6', 'S'), "
                "(3025315, 'Body weight', 'LOINC', '29463-7', 'S'), "
                "(40766240, 'Tobacco', 'LOINC', '72166-2', 'S')"
            )
        )
    return eng


def _load_fixtures() -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for f in FIXTURES.glob("*.ndjson"):
        out[f.stem] = []
        for line in f.read_text(encoding="utf-8").splitlines():
            if line.strip():
                out[f.stem].append(json.loads(line))
    return out


def test_no_orphan_person_references(engine_with_vocab) -> None:
    fixtures = _load_fixtures()
    resolver = ConceptResolver(engine=engine_with_vocab, vocab_schema="main")

    patients = [map_patient(p, resolver) for p in fixtures["Patient"]]
    valid_persons = {p.person_source_value for p in patients}

    encounters = [map_encounter(e, resolver) for e in fixtures["Encounter"]]
    conditions = [map_condition(c, resolver) for c in fixtures["Condition"]]
    observations = [map_observation(o, resolver) for o in fixtures["Observation"]]

    for v in encounters:
        assert (
            v.person_source_value in valid_persons
        ), f"Encounter {v.visit_source_value} -> orphan {v.person_source_value!r}"
    for c in conditions:
        assert (
            c.person_source_value in valid_persons
        ), f"Condition {c.condition_source_value} -> orphan {c.person_source_value!r}"
    for o in observations:
        assert (
            o.person_source_value in valid_persons
        ), f"Observation -> orphan {o.person_source_value!r}"


def test_no_orphan_visit_references(engine_with_vocab) -> None:
    fixtures = _load_fixtures()
    resolver = ConceptResolver(engine=engine_with_vocab, vocab_schema="main")

    encounters = [map_encounter(e, resolver) for e in fixtures["Encounter"]]
    valid_visits = {v.visit_source_value for v in encounters}

    conditions = [map_condition(c, resolver) for c in fixtures["Condition"]]
    observations = [map_observation(o, resolver) for o in fixtures["Observation"]]

    for c in conditions:
        if c.visit_source_value is not None:
            assert (
                c.visit_source_value in valid_visits
            ), f"Condition {c.condition_source_value} -> orphan visit {c.visit_source_value!r}"
    for o in observations:
        if o.visit_source_value is not None:
            assert (
                o.visit_source_value in valid_visits
            ), f"Observation -> orphan visit {o.visit_source_value!r}"


def test_observation_split_routes_correctly(engine_with_vocab) -> None:
    """Vital-signs observations -> MeasurementRow; social-history -> ObservationRow."""
    fixtures = _load_fixtures()
    resolver = ConceptResolver(engine=engine_with_vocab, vocab_schema="main")

    routed: list[tuple[str, type]] = []
    for o in fixtures["Observation"]:
        row = map_observation(o, resolver)
        routed.append((o["id"], type(row)))

    # 4 fixture observations: o1, o2 are vital-signs; o3, o4 are social-history.
    by_id = dict(routed)
    assert by_id["o1"] is MeasurementRow
    assert by_id["o2"] is MeasurementRow
    assert by_id["o3"] is ObservationRow
    assert by_id["o4"] is ObservationRow
