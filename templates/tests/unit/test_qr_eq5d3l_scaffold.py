"""EQ-5D-3L scaffold: proves _shared/pro_base is reused by a second instrument."""

from __future__ import annotations

from pathlib import Path

import yaml

from runtime.registry.manifest import load_manifest

MANIFEST = (
    Path(__file__).resolve().parents[2] / "manifests" / "qr_eq5d3l_to_measurement" / "manifest.yaml"
)
PLACEHOLDER = (
    Path(__file__).resolve().parents[2]
    / "runtime"
    / "instruments"
    / "value_sets"
    / "eq5d3l_placeholder.csv"
)


def test_eq5d3l_manifest_loads() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    manifest = load_manifest(payload)
    assert manifest.metadata.id == "qr_eq5d3l_to_measurement"


def test_eq5d3l_manifest_imports_pro_base() -> None:
    """Same shared module as EQ-5D-5L — proves the framework is reused."""
    text = MANIFEST.read_text(encoding="utf-8")
    assert "runtime.instruments.pro_base" in text


def test_eq5d3l_uses_3l_value_set_default() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    default = payload["spec"]["parameters"]["properties"]["eq5d_value_set_path"]["default"]
    assert "eq5d3l" in default.lower()


def test_eq5d3l_placeholder_value_set_exists() -> None:
    assert PLACEHOLDER.exists()
    text = PLACEHOLDER.read_text(encoding="utf-8")
    assert "PLACEHOLDER" in text.upper()
    assert "EUROQOL" in text.upper()
    assert "11111" in text
