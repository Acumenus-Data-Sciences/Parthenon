"""Pydantic loader for template manifests."""

from __future__ import annotations

from pathlib import Path

import pytest

from runtime.registry.manifest import (
    Manifest,
    ManifestLoadError,
    load_manifest_from_path,
)

REPO = Path(__file__).resolve().parents[2]
VALID = REPO / "tests" / "fixtures" / "manifests_valid" / "minimal.yaml"
INVALID_MISSING = REPO / "tests" / "fixtures" / "manifests_invalid" / "missing_required.yaml"
INVALID_UNKNOWN = REPO / "tests" / "fixtures" / "manifests_invalid" / "unknown_node_type.yaml"


def test_loads_valid_manifest() -> None:
    manifest = load_manifest_from_path(VALID)
    assert isinstance(manifest, Manifest)
    assert manifest.metadata.id == "minimal_template"
    assert manifest.metadata.version == "0.1.0"
    assert manifest.spec.nodes[0].node_id == "only"
    assert manifest.spec.nodes[0].type == "python"


def test_missing_required_field_raises() -> None:
    with pytest.raises(ManifestLoadError) as exc:
        load_manifest_from_path(INVALID_MISSING)
    assert "metadata.id" in str(exc.value) or "id" in str(exc.value)


def test_unknown_node_type_raises_at_load_time() -> None:
    with pytest.raises(ManifestLoadError):
        load_manifest_from_path(INVALID_UNKNOWN)


def test_loader_rejects_singleton_with_invalid_value(tmp_path: Path) -> None:
    bad = tmp_path / "bad.yaml"
    bad.write_text(
        VALID.read_text(encoding="utf-8").replace(
            "author: parthenon",
            "author: parthenon\n  singleton: not-a-bool",
        ),
        encoding="utf-8",
    )
    with pytest.raises(ManifestLoadError):
        load_manifest_from_path(bad)
