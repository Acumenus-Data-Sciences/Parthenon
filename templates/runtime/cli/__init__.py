"""parthenon-templates CLI: validate-manifests + lint-secret-keys.

This Typer app is wired as the ``parthenon-templates`` console script in
``pyproject.toml``. It is the manifest-author-facing tooling distinct from
``parthenon-nodes`` (the dev-runner CLI in :mod:`runtime.runner`).
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

import typer
import yaml

from runtime.registry.manifest import ManifestLoadError, load_manifest_from_path

app = typer.Typer(help="parthenon-templates manifest tooling.")

_SECRET_NAME_PATTERN = re.compile(r"(_key|_token|_password|_secret)$", re.IGNORECASE)
# Module-level default for ``--root`` so we don't call ``Path.cwd()`` at import.
_DEFAULT_ROOT_REL = Path("templates") / "manifests"


def _default_root() -> Path:
    return Path.cwd() / _DEFAULT_ROOT_REL


def _iter_manifests(root: Path) -> list[Path]:
    """Return the list of ``{root}/{template_id}/manifest.yaml`` files under ``root``."""
    if not root.exists():
        raise typer.BadParameter(f"manifests root does not exist: {root}")
    paths: list[Path] = []
    for child in sorted(root.iterdir()):
        if child.is_dir() and (child / "manifest.yaml").exists():
            paths.append(child / "manifest.yaml")
    return paths


@app.command("validate-manifests")
def validate_manifests(
    root: Path | None = typer.Option(
        None, "--root", help="Manifests root directory (default: ./templates/manifests)."
    ),
) -> None:
    """Validate every manifest.yaml under ``root`` against JSON Schema + Pydantic."""
    resolved_root = root if root is not None else _default_root()
    failures: list[str] = []
    paths = _iter_manifests(resolved_root)
    for path in paths:
        try:
            load_manifest_from_path(path)
            typer.echo(f"OK  {path.parent.name}")
        except ManifestLoadError as exc:
            failures.append(f"{path.parent.name}: {exc}")
            typer.echo(f"FAIL {path.parent.name}: {exc}", err=True)
    if failures:
        raise typer.Exit(code=1)
    typer.echo(f"validated {len(paths)} manifest(s) — all OK")


@app.command("lint-secret-keys")
def lint_secret_keys(
    root: Path | None = typer.Option(
        None, "--root", help="Manifests root directory (default: ./templates/manifests)."
    ),
) -> None:
    """Fail if any parameter has a secret-shaped name without ``secret: true``."""
    resolved_root = root if root is not None else _default_root()
    offenders: list[str] = []
    for path in _iter_manifests(resolved_root):
        try:
            payload: Any = yaml.safe_load(path.read_text(encoding="utf-8"))
        except yaml.YAMLError as exc:
            offenders.append(f"{path}: yaml parse error: {exc}")
            continue
        if not isinstance(payload, dict):
            continue
        spec = payload.get("spec", {})
        parameters = spec.get("parameters", {}) if isinstance(spec, dict) else {}
        properties = parameters.get("properties", {}) if isinstance(parameters, dict) else {}
        if not isinstance(properties, dict):
            continue
        for name, prop in properties.items():
            if not isinstance(prop, dict):
                continue
            if _SECRET_NAME_PATTERN.search(str(name)) and not bool(prop.get("secret")):
                offenders.append(
                    f"{path.parent.name}: parameter {name!r} looks secret but lacks secret: true"
                )
    for offender in offenders:
        typer.echo(offender, err=True)
    if offenders:
        raise typer.Exit(code=1)
    typer.echo("lint-secret-keys: clean")


if __name__ == "__main__":  # pragma: no cover
    app()
