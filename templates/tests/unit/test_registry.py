"""Filesystem-backed Registry."""

from __future__ import annotations

from pathlib import Path

import pytest

from runtime.registry.manifest import Manifest
from runtime.registry.registry import Registry, TemplateNotFoundError

REPO = Path(__file__).resolve().parents[2]
VALID = REPO / "tests" / "fixtures" / "manifests_valid" / "minimal.yaml"


@pytest.fixture()
def registry_dir(tmp_path: Path) -> Path:
    target = tmp_path / "manifests"
    (target / "minimal_template").mkdir(parents=True)
    (target / "minimal_template" / "manifest.yaml").write_bytes(VALID.read_bytes())
    return target


def test_lists_templates(registry_dir: Path) -> None:
    registry = Registry(root=registry_dir)
    listed = registry.list_templates()
    assert [m.metadata.id for m in listed] == ["minimal_template"]


def test_get_template_returns_manifest(registry_dir: Path) -> None:
    registry = Registry(root=registry_dir)
    manifest = registry.get_template("minimal_template")
    assert isinstance(manifest, Manifest)
    assert manifest.metadata.version == "0.1.0"


def test_get_unknown_template_raises(registry_dir: Path) -> None:
    registry = Registry(root=registry_dir)
    with pytest.raises(TemplateNotFoundError):
        registry.get_template("does_not_exist")


def test_lists_only_dirs_with_manifest_yaml(registry_dir: Path) -> None:
    (registry_dir / "not_a_template").mkdir()  # no manifest.yaml inside
    registry = Registry(root=registry_dir)
    listed = registry.list_templates()
    assert [m.metadata.id for m in listed] == ["minimal_template"]


def test_invalid_manifest_in_registry_surfaces_error(registry_dir: Path) -> None:
    bad = registry_dir / "broken"
    bad.mkdir()
    (bad / "manifest.yaml").write_text("not: a: valid\nmanifest:\n", encoding="utf-8")
    registry = Registry(root=registry_dir)
    # Unparseable YAML raises a yaml.YAMLError; the registry must not swallow it.
    with pytest.raises(Exception):  # noqa: B017 — broad on purpose per plan Task 26
        registry.get_template("broken")
