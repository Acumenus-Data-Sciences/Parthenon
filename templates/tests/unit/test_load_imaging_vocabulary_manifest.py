"""load_imaging_vocabulary manifest validates against template.v1.json."""

from __future__ import annotations

from pathlib import Path

import yaml

from runtime.registry.manifest import load_manifest

MANIFEST = (
    Path(__file__).resolve().parents[2] / "manifests" / "load_imaging_vocabulary" / "manifest.yaml"
)


def test_manifest_exists_and_loads() -> None:
    assert MANIFEST.exists()
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    manifest = load_manifest(payload)
    assert manifest.metadata.id == "load_imaging_vocabulary"
    assert manifest.metadata.category == "vocabulary"
    assert "5.3" in manifest.metadata.cdm_versions
    assert "5.4" in manifest.metadata.cdm_versions


def test_manifest_post_conditions_include_row_count() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    pc_kinds = {p["kind"] for p in payload["spec"]["post_conditions"]}
    assert "row_count" in pc_kinds
    assert "artifact_present" in pc_kinds


def test_manifest_uses_parthenon_namespaced_concept_id_range() -> None:
    text = MANIFEST.read_text(encoding="utf-8")
    assert "2000000000" in text or "2_000_000_000" in text
