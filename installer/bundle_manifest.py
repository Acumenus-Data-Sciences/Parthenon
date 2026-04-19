"""Versioned installer bundle manifest generation."""
from __future__ import annotations

import argparse
import fnmatch
import hashlib
import json
import sys
from pathlib import Path
from typing import Any


MANIFEST_TEMPLATE = Path(__file__).with_name("installer_manifest.json")


def load_template(path: str | Path | None = None) -> dict[str, Any]:
    template_path = Path(path).expanduser().resolve() if path else MANIFEST_TEMPLATE
    return json.loads(template_path.read_text())


def build_manifest(
    *,
    repo_root: str | Path | None = None,
    template_path: str | Path | None = None,
) -> dict[str, Any]:
    """Expand the installer manifest template with file sizes and checksums."""
    root = Path(repo_root).expanduser().resolve() if repo_root else Path(__file__).resolve().parents[1]
    template = load_template(template_path)
    files = _expand_files(root, template.get("file_groups", []))
    manifest = dict(template)
    manifest["repo_root"] = str(root)
    manifest["files"] = files
    manifest["file_count"] = len(files)
    manifest["total_size"] = sum(int(file["size"]) for file in files)
    manifest["bundle_digest"] = _bundle_digest(files)
    return manifest


def validate_manifest(manifest: dict[str, Any], *, repo_root: str | Path | None = None) -> list[dict[str, str]]:
    """Validate file entries in a generated manifest against the filesystem."""
    root = Path(repo_root).expanduser().resolve() if repo_root else Path(str(manifest["repo_root"]))
    checks: list[dict[str, str]] = []
    for file in manifest.get("files", []):
        relative_path = str(file.get("path", ""))
        path = root / relative_path
        if not path.is_file():
            checks.append(_check(relative_path, "fail", "missing"))
            continue
        actual = _sha256(path)
        expected = str(file.get("sha256", ""))
        if actual != expected:
            checks.append(_check(relative_path, "fail", "checksum mismatch"))
        else:
            checks.append(_check(relative_path, "ok", "verified"))
    return checks


def _expand_files(root: Path, groups: list[dict[str, Any]]) -> list[dict[str, Any]]:
    seen: set[str] = set()
    files: list[dict[str, Any]] = []
    for group in groups:
        matched = _group_matches(root, group)
        if group.get("required", False) and not matched:
            raise FileNotFoundError(f"Manifest group {group.get('name', '<unnamed>')} did not match any files")
        for path in matched:
            relative = path.relative_to(root).as_posix()
            if relative in seen:
                continue
            seen.add(relative)
            files.append({
                "path": relative,
                "group": str(group.get("name", "")),
                "role": str(group.get("role", "")),
                "size": path.stat().st_size,
                "sha256": _sha256(path),
            })
    return sorted(files, key=lambda file: str(file["path"]))


def _group_matches(root: Path, group: dict[str, Any]) -> list[Path]:
    includes = [str(pattern) for pattern in group.get("include", [])]
    excludes = [str(pattern) for pattern in group.get("exclude", [])]
    paths: list[Path] = []
    for pattern in includes:
        for path in root.glob(pattern):
            if not path.is_file():
                continue
            relative = path.relative_to(root).as_posix()
            if any(fnmatch.fnmatch(relative, exclude) for exclude in excludes):
                continue
            paths.append(path)
    return sorted(set(paths))


def _sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _bundle_digest(files: list[dict[str, Any]]) -> str:
    digest = hashlib.sha256()
    for file in files:
        digest.update(str(file["path"]).encode())
        digest.update(b"\0")
        digest.update(str(file["sha256"]).encode())
        digest.update(b"\0")
    return digest.hexdigest()


def _check(name: str, status: str, detail: str) -> dict[str, str]:
    return {"name": name, "status": status, "detail": detail}


def emit_json(payload: dict[str, Any], *, pretty: bool = False) -> None:
    print(json.dumps(payload, indent=2 if pretty else None, sort_keys=pretty))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Build Parthenon installer bundle manifest")
    parser.add_argument("--repo-root", type=str, default=None, help="Repository root to scan")
    parser.add_argument("--template", type=str, default=None, help="Manifest template path")
    parser.add_argument("--validate", action="store_true", help="Validate generated checksums")
    parser.add_argument("--pretty", action="store_true", help="Pretty-print JSON")
    args = parser.parse_args(argv)

    try:
        manifest = build_manifest(repo_root=args.repo_root, template_path=args.template)
        if args.validate:
            checks = validate_manifest(manifest, repo_root=args.repo_root)
            manifest["validation"] = {
                "failures": sum(1 for check in checks if check["status"] == "fail"),
                "checks": checks,
            }
    except Exception as exc:
        emit_json({"ok": False, "error": str(exc)}, pretty=True)
        return 1

    emit_json(manifest, pretty=args.pretty)
    return 0


if __name__ == "__main__":
    sys.exit(main())
