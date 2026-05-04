"""qr_eq5d5l_to_measurement manifest validates against template.v1.json."""

from __future__ import annotations

from pathlib import Path

import yaml

from runtime.registry.manifest import load_manifest

MANIFEST = (
    Path(__file__).resolve().parents[2] / "manifests" / "qr_eq5d5l_to_measurement" / "manifest.yaml"
)


def test_manifest_loads() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    manifest = load_manifest(payload)
    assert manifest.metadata.id == "qr_eq5d5l_to_measurement"
    assert manifest.metadata.category == "ingestion"


def test_manifest_uses_fhir_resource_node() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    types = {n["type"] for n in payload["spec"]["nodes"]}
    assert "fhir_resource" in types


def test_manifest_imports_pro_base() -> None:
    """The python nodes must reference runtime.instruments.pro_base for the reuse contract."""
    text = MANIFEST.read_text(encoding="utf-8")
    assert "runtime.instruments.pro_base" in text


def test_manifest_declares_eq5d_value_set_path_param() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    props = payload["spec"]["parameters"]["properties"]
    assert "eq5d_value_set_path" in props
    assert "placeholder" in props["eq5d_value_set_path"]["default"].lower()
