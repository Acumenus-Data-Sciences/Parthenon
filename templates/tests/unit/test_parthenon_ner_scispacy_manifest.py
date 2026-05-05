"""parthenon_ner_scispacy manifest shape (Plan 2 Task 6)."""

from __future__ import annotations

from pathlib import Path

import yaml

MANIFEST = (
    Path(__file__).resolve().parents[2] / "manifests" / "parthenon_ner_scispacy" / "manifest.yaml"
)


def _load() -> dict:
    return yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))


def test_manifest_loads() -> None:
    cfg = _load()
    assert cfg["apiVersion"] == "parthenon.acumenus.net/v1"
    assert cfg["kind"] == "Template"
    assert cfg["metadata"]["id"] == "parthenon_ner_scispacy"


def test_manifest_pins_backend_to_scispacy() -> None:
    cfg = _load()
    nlp_node = next(n for n in cfg["spec"]["nodes"] if n["type"] == "note_nlp")
    # SciSpaCy template hardcodes backend; the whole point is the offline path.
    assert nlp_node["params"]["backend"] == "scispacy"


def test_manifest_does_not_expose_backend_parameter() -> None:
    cfg = _load()
    # `backend` is NOT a parameter — this template is scispacy-only.
    assert "backend" not in cfg["spec"]["parameters"]["properties"]


def test_manifest_requires_omop_vocabularies() -> None:
    cfg = _load()
    required = cfg["spec"]["requires"]["vocabularies"]
    for v in ("SNOMED", "RxNorm", "LOINC"):
        assert v in required


def test_manifest_declares_offline_tag() -> None:
    cfg = _load()
    tags = set(cfg["metadata"].get("tags", []))
    assert "offline" in tags
    assert "hipaa-strict" in tags


def test_readme_documents_offline_posture() -> None:
    body = (MANIFEST.parent / "README.md").read_text(encoding="utf-8")
    lower = body.lower()
    assert "offline" in lower
    assert "hipaa" in lower
    assert "deterministic" in lower


def test_readme_calls_out_concept_mapping_gap() -> None:
    body = (MANIFEST.parent / "README.md").read_text(encoding="utf-8")
    assert "umls linker" in body.lower() or "concept_id mapping" in body.lower()
    assert "Phase 3" in body


def test_post_conditions_relaxed_recall_threshold() -> None:
    cfg = yaml.safe_load(
        (MANIFEST.parent / "validation" / "expected" / "post_conditions.yaml").read_text(
            encoding="utf-8"
        )
    )
    # SciSpaCy is rule-bound; threshold is intentionally lower than LLM's 0.90.
    assert 0.80 <= cfg["recall_threshold"] < 0.90
