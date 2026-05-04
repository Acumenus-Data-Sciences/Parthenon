"""load_imaging_vocabulary manifest validates against template.v1.json."""

from __future__ import annotations

import json
from pathlib import Path

import yaml

from runtime.registry.manifest import load_manifest

MANIFEST = (
    Path(__file__).resolve().parents[2] / "manifests" / "load_imaging_vocabulary" / "manifest.yaml"
)
VAL_ROOT = MANIFEST.parent / "validation"


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


def test_validation_pack_files_present() -> None:
    assert (VAL_ROOT / "README.md").exists()
    assert (VAL_ROOT / "inputs" / "parameters.json").exists()
    assert (VAL_ROOT / "expected" / "post_conditions.yaml").exists()
    assert (VAL_ROOT / "dqd_checks.yaml").exists()


def test_validation_inputs_match_manifest_required() -> None:
    inputs = json.loads((VAL_ROOT / "inputs" / "parameters.json").read_text(encoding="utf-8"))
    assert "source_url" in inputs
    assert "vocab_schema" in inputs


def test_validation_post_conditions_parse() -> None:
    pc = yaml.safe_load(
        (VAL_ROOT / "expected" / "post_conditions.yaml").read_text(encoding="utf-8")
    )
    assert isinstance(pc.get("post_conditions"), list) and pc["post_conditions"]


def test_dqd_checks_parse_and_have_required_fields() -> None:
    checks = yaml.safe_load((VAL_ROOT / "dqd_checks.yaml").read_text(encoding="utf-8"))
    assert isinstance(checks.get("checks"), list) and checks["checks"]
    for check in checks["checks"]:
        assert "check_id" in check
        assert "sql" in check
        assert "expected" in check
