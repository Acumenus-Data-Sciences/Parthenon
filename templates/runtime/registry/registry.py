"""Filesystem-backed Registry of Manifest objects.

Each manifest lives at ``{root}/{template_id}/manifest.yaml``. Listing scans
the immediate children of ``root`` and ignores directories without a
``manifest.yaml``.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from runtime.registry.manifest import Manifest, load_manifest_from_path


class TemplateNotFoundError(KeyError):
    """Raised when a template id is not present in the registry."""


@dataclass
class Registry:
    """A directory of template manifests."""

    root: Path

    def __post_init__(self) -> None:
        if not self.root.exists():
            self.root.mkdir(parents=True, exist_ok=True)

    def list_templates(self) -> list[Manifest]:
        manifests: list[Manifest] = []
        for child in sorted(self.root.iterdir()):
            if not child.is_dir():
                continue
            manifest_file = child / "manifest.yaml"
            if not manifest_file.exists():
                continue
            manifests.append(load_manifest_from_path(manifest_file))
        return manifests

    def get_template(self, template_id: str) -> Manifest:
        manifest_file = self.root / template_id / "manifest.yaml"
        if not manifest_file.exists():
            raise TemplateNotFoundError(template_id)
        return load_manifest_from_path(manifest_file)
