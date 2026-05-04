"""etl_dicom_metadata manifest validates against template.v1.json."""

from __future__ import annotations

import json
from pathlib import Path

import yaml

from runtime.registry.manifest import load_manifest

MANIFEST = (
    Path(__file__).resolve().parents[2] / "manifests" / "etl_dicom_metadata" / "manifest.yaml"
)
VAL_ROOT = MANIFEST.parent / "validation"


def test_manifest_loads_and_targets_imaging_extension() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    manifest = load_manifest(payload)
    assert manifest.metadata.id == "etl_dicom_metadata"
    assert manifest.metadata.category == "ingestion"
    assert "5.4" in manifest.metadata.cdm_versions


def test_manifest_uses_dicom_metadata_node() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    types = {n["type"] for n in payload["spec"]["nodes"]}
    assert "dicom_metadata" in types


def test_manifest_does_not_reference_pixel_data() -> None:
    """Defense in depth: the manifest must not even mention pixel-data tags."""
    text = MANIFEST.read_text(encoding="utf-8").lower()
    assert "pixeldata" not in text
    assert "pixel_data" not in text


def test_manifest_requires_parthenon_imaging_vocabulary() -> None:
    """The template depends on load_imaging_vocabulary having run first."""
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    requires = payload["spec"]["requires"]
    assert "Parthenon-Imaging" in requires["vocabularies"]


def test_validation_pack_files_present() -> None:
    assert (VAL_ROOT / "README.md").exists()
    assert (VAL_ROOT / "inputs" / "parameters.json").exists()
    assert (VAL_ROOT / "expected" / "post_conditions.yaml").exists()
    assert (VAL_ROOT / "dqd_checks.yaml").exists()


def test_fixtures_builder_present() -> None:
    builder = MANIFEST.parent / "fixtures" / "sample" / "build_fixtures.py"
    assert builder.exists()


def test_validation_inputs_match_required_params() -> None:
    inputs = json.loads((VAL_ROOT / "inputs" / "parameters.json").read_text("utf-8"))
    assert "source" in inputs
    assert "target_schema" in inputs


def test_validation_post_conditions_parse() -> None:
    pc = yaml.safe_load(
        (VAL_ROOT / "expected" / "post_conditions.yaml").read_text(encoding="utf-8")
    )
    assert isinstance(pc.get("post_conditions"), list) and pc["post_conditions"]


def test_dqd_checks_include_pixel_data_guard() -> None:
    """The DQD pack must include the pixel-data column guard."""
    checks = yaml.safe_load((VAL_ROOT / "dqd_checks.yaml").read_text(encoding="utf-8"))
    check_ids = {c["check_id"] for c in checks["checks"]}
    assert "dicom_etl_no_pixel_data_columns" in check_ids
