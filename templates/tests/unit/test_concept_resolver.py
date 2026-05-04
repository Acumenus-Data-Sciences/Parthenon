"""ConceptResolver: looks up OMOP concept_id from FHIR (system, code) pairs."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from sqlalchemy import create_engine, text

from runtime.fhir_to_omop.concept_resolver import (
    ConceptResolver,
    UnmappedConceptError,
)


@pytest.fixture()
def engine():
    eng = create_engine("sqlite:///:memory:", future=True)
    with eng.begin() as conn:
        conn.execute(
            text(
                """
                CREATE TABLE concept (
                    concept_id INTEGER PRIMARY KEY,
                    concept_name TEXT,
                    vocabulary_id TEXT,
                    concept_code TEXT,
                    standard_concept TEXT
                )
                """
            )
        )
        conn.execute(
            text(
                "INSERT INTO concept VALUES "
                "(4267416, 'Hypertensive disorder', 'SNOMED', '38341003', 'S'), "
                "(4112343, 'Asthma', 'SNOMED', '195967001', 'S'), "
                "(8507, 'MALE', 'Gender', 'M', 'S'), "
                "(8532, 'FEMALE', 'Gender', 'F', 'S')"
            )
        )
    return eng


def test_resolver_finds_known_concept(engine) -> None:
    r = ConceptResolver(engine=engine, vocab_schema="main")
    cid = r.resolve(system="http://snomed.info/sct", code="38341003")
    assert cid == 4267416


def test_resolver_returns_zero_for_unknown_when_strict_false(engine) -> None:
    r = ConceptResolver(engine=engine, vocab_schema="main", strict=False)
    cid = r.resolve(system="http://snomed.info/sct", code="999999999")
    assert cid == 0


def test_resolver_raises_for_unknown_when_strict_true(engine) -> None:
    r = ConceptResolver(engine=engine, vocab_schema="main", strict=True)
    with pytest.raises(UnmappedConceptError):
        r.resolve(system="http://snomed.info/sct", code="999999999")


def test_resolver_caches_repeated_lookups(engine) -> None:
    r = ConceptResolver(engine=engine, vocab_schema="main")
    a = r.resolve(system="http://snomed.info/sct", code="38341003")
    b = r.resolve(system="http://snomed.info/sct", code="38341003")
    assert a == b == 4267416


def test_resolver_unknown_system_returns_zero(engine) -> None:
    """An unrecognized system URI doesn't crash; it just returns 0."""
    r = ConceptResolver(engine=engine, vocab_schema="main", strict=False)
    cid = r.resolve(system="http://made-up-system.example.com", code="x")
    assert cid == 0


def test_ig_snapshot_exists() -> None:
    ig_path = (
        Path(__file__).resolve().parents[2]
        / "runtime"
        / "fhir_to_omop"
        / "ig"
        / "v0.1.0-parthenon.json"
    )
    assert ig_path.exists()
    payload = json.loads(ig_path.read_text(encoding="utf-8"))
    assert payload["version"] == "v0.1.0-parthenon"
    assert "system_to_vocabulary" in payload
    assert payload["system_to_vocabulary"]["http://snomed.info/sct"] == "SNOMED"
