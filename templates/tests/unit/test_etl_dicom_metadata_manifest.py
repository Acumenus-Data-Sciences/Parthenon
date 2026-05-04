"""etl_dicom_metadata manifest validates against template.v1.json."""

from __future__ import annotations

from pathlib import Path

import yaml

from runtime.registry.manifest import load_manifest

MANIFEST = (
    Path(__file__).resolve().parents[2] / "manifests" / "etl_dicom_metadata" / "manifest.yaml"
)


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
