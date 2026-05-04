"""fhir_anonymizer manifest validates and uses Plan 1 nodes."""

from __future__ import annotations

import json
from pathlib import Path

import yaml

from runtime.registry.manifest import load_manifest

MANIFEST = Path(__file__).resolve().parents[2] / "manifests" / "fhir_anonymizer" / "manifest.yaml"
VAL_ROOT = MANIFEST.parent / "validation"
FIXTURES = MANIFEST.parent / "fixtures" / "sample_with_phi"


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


def test_validation_pack_present() -> None:
    assert (VAL_ROOT / "README.md").exists()
    assert (VAL_ROOT / "inputs" / "parameters.json").exists()
    assert (VAL_ROOT / "expected" / "post_conditions.yaml").exists()


def test_fixture_has_phi_strings() -> None:
    """Fixture contains synthetic PHI tokens that the anonymizer should remove.

    FHIR JSON splits names into family + given arrays, so we check the
    individual tokens rather than the combined string.
    """
    text = "\n".join(p.read_text(encoding="utf-8") for p in FIXTURES.glob("*.ndjson"))
    assert "Doe" in text and "Jane" in text
    assert "Smith" in text and "John" in text
    assert "555-0100" in text or "555-0101" in text
    assert "MRN-" in text
    assert "jane.doe@example.com" in text  # the email still appears verbatim


def test_fixture_marked_synthetic() -> None:
    """Each fixture line includes a SYNTHETIC tag so audits know it's not real PHI."""
    for f in FIXTURES.glob("*.ndjson"):
        for line in f.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            obj = json.loads(line)
            tag = obj.get("meta", {}).get("tag", [])
            assert any(
                t.get("code") == "SYNTHETIC" for t in tag
            ), f"fixture line missing SYNTHETIC tag: {f}"
