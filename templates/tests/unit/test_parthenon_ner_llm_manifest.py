"""parthenon_ner_llm manifest shape (Task 12)."""

from __future__ import annotations

from pathlib import Path

import yaml

MANIFEST = Path(__file__).resolve().parents[2] / "manifests" / "parthenon_ner_llm" / "manifest.yaml"


def _load() -> dict:
    return yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))


def test_manifest_loads() -> None:
    cfg = _load()
    assert cfg["name"] == "parthenon_ner_llm"


def test_manifest_pins_prompt_version() -> None:
    cfg = _load()
    assert cfg["metadata"]["prompt_version"] == "v0.1.0"


def test_manifest_requires_omop_vocabularies() -> None:
    cfg = _load()
    required = cfg["metadata"]["required_vocabularies"]
    for v in ("SNOMED", "RxNorm", "LOINC"):
        assert v in required


def test_manifest_declares_note_nlp_node() -> None:
    cfg = _load()
    types = {n["type"] for n in cfg["nodes"]}
    assert "note_nlp" in types
    assert "fhir_resource" in types


def test_manifest_default_backend_is_llm() -> None:
    cfg = _load()
    nlp_node = next(n for n in cfg["nodes"] if n["type"] == "note_nlp")
    assert "${parameters.backend}" in nlp_node["params"]["backend"]
    backend_param = next(p for k, p in cfg["parameters"].items() if k == "backend")
    assert backend_param["default"] == "llm"


def test_fixture_corpus_present() -> None:
    fixture = MANIFEST.parent / "fixtures" / "synthetic" / "DocumentReference.ndjson"
    assert fixture.is_file(), "run build_fixtures.py to materialize the synthetic corpus"
    lines = [ln for ln in fixture.read_text(encoding="utf-8").splitlines() if ln.strip()]
    assert len(lines) >= 10


def test_gold_standard_csv_present() -> None:
    gold = MANIFEST.parent / "validation" / "expected" / "gold_standard.csv"
    assert gold.is_file()
    body = gold.read_text(encoding="utf-8")
    # Header + at least 30 rows for a 10-note corpus.
    assert body.startswith("note_id,start,end,text,label,concept_id,vocabulary_id")
    lines = [ln for ln in body.splitlines() if ln.strip()]
    assert len(lines) >= 30
