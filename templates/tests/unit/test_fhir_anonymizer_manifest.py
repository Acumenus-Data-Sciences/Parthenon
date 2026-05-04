"""fhir_anonymizer manifest validates and uses Plan 1 nodes."""

from __future__ import annotations

from pathlib import Path

import yaml

from runtime.registry.manifest import load_manifest

MANIFEST = Path(__file__).resolve().parents[2] / "manifests" / "fhir_anonymizer" / "manifest.yaml"


def test_manifest_loads() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    manifest = load_manifest(payload)
    assert manifest.metadata.id == "fhir_anonymizer"
    assert manifest.metadata.category == "transform"


def test_manifest_uses_anonymizer_class_via_python_wrapper() -> None:
    """Phase 1's Materializer doesn't resolve cross-node paths, so the manifest
    wraps AnonymizerNode in a python node. Phase 2 cleanup tracked in ADR 0007.
    """
    text = MANIFEST.read_text(encoding="utf-8")
    assert "from runtime.nodes.anonymizer import AnonymizerNode" in text


def test_manifest_supports_three_config_sources() -> None:
    """The manifest's params support config_source=library|inline|file."""
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    src = payload["spec"]["parameters"]["properties"]["config_source"]
    assert set(src["enum"]) == {"library", "inline", "file"}


def test_manifest_supports_both_backends() -> None:
    payload = yaml.safe_load(MANIFEST.read_text(encoding="utf-8"))
    backend = payload["spec"]["parameters"]["properties"]["backend"]
    assert set(backend["enum"]) == {"native", "ms"}
