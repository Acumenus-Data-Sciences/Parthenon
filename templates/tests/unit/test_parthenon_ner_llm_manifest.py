"""parthenon_ner_llm manifest shape (Task 12)."""

from __future__ import annotations

from pathlib import Path

import yaml

MANIFEST = Path(__file__).resolve().parents[2] / "manifests" / "parthenon_ner_llm" / "manifest.yaml"


def _load() -> dict:
    return yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))


def test_manifest_loads_with_correct_id() -> None:
    cfg = _load()
    assert cfg["apiVersion"] == "parthenon.acumenus.net/v1"
    assert cfg["kind"] == "Template"
    assert cfg["metadata"]["id"] == "parthenon_ner_llm"


def test_manifest_pins_cdm_versions() -> None:
    cfg = _load()
    assert "5.4" in cfg["metadata"]["cdm_versions"]


def test_manifest_requires_omop_vocabularies() -> None:
    cfg = _load()
    required = cfg["spec"]["requires"]["vocabularies"]
    for v in ("SNOMED", "RxNorm", "LOINC"):
        assert v in required


def test_manifest_declares_fhir_and_note_nlp_nodes() -> None:
    cfg = _load()
    types = {n["type"] for n in cfg["spec"]["nodes"]}
    assert "note_nlp" in types
    assert "fhir_resource" in types


def test_manifest_default_backend_is_llm() -> None:
    cfg = _load()
    nlp_node = next(n for n in cfg["spec"]["nodes"] if n["type"] == "note_nlp")
    assert "${parameters.backend}" in nlp_node["params"]["backend"]
    props = cfg["spec"]["parameters"]["properties"]
    assert props["backend"]["default"] == "llm"
    assert props["prompt_version"]["default"] == "v0.1.0"


def test_manifest_default_llm_provider_is_ollama() -> None:
    cfg = _load()
    props = cfg["spec"]["parameters"]["properties"]
    assert props["llm_provider"]["default"] == "ollama"


def test_fixture_corpus_present() -> None:
    fixture = MANIFEST.parent / "fixtures" / "synthetic" / "DocumentReference.ndjson"
    assert fixture.is_file(), "run build_fixtures.py to materialize the synthetic corpus"
    lines = [ln for ln in fixture.read_text(encoding="utf-8").splitlines() if ln.strip()]
    assert len(lines) >= 10


def test_gold_standard_csv_present() -> None:
    gold = MANIFEST.parent / "validation" / "expected" / "gold_standard.csv"
    assert gold.is_file()
    body = gold.read_text(encoding="utf-8")
    assert body.startswith("note_id,start,end,text,label,concept_id,vocabulary_id")
    lines = [ln for ln in body.splitlines() if ln.strip()]
    assert len(lines) >= 30
