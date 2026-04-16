"""Hecate bootstrap asset preparation for Community MVP installs."""
from __future__ import annotations

import hashlib
import os
import shutil
import sys
import tarfile
import zipfile
from dataclasses import dataclass
from pathlib import Path, PurePosixPath
from typing import Any

from rich.console import Console
from rich.panel import Panel

from datasets.downloads import download_file

from . import utils

BOOTSTRAP_DIR = Path("output/hecate-bootstrap")
QDRANT_DATA_DIR = Path(".parthenon-data/qdrant")
DOWNLOADS_DIR = Path("downloads")
BUNDLE_FILENAME = "hecate-community-bootstrap.tar.gz"
DEFAULT_QDRANT_VOLUME = "parthenon_qdrant-data"

REQUIRED_HECATE_FILES = [
    BOOTSTRAP_DIR / "all_pairs.txt",
    BOOTSTRAP_DIR / "ConceptRecordCounts.json",
]
QDRANT_MARKER_FILES = [
    QDRANT_DATA_DIR / "collections/meddra/config.json",
]

ENV_ARCHIVE = "PARTHENON_HECATE_BOOTSTRAP_ARCHIVE"
ENV_URL = "PARTHENON_HECATE_BOOTSTRAP_URL"
ENV_SHA256 = "PARTHENON_HECATE_BOOTSTRAP_SHA256"


@dataclass(frozen=True)
class BootstrapStatus:
    ready: bool
    source_available: bool
    missing: list[str]
    source_detail: str


def _repo_path(relative: Path, *, root: Path | None = None) -> Path:
    return (root or utils.REPO_ROOT) / relative


def _cfg_value(cfg: dict[str, Any] | None, key: str, env_key: str) -> str:
    value = (cfg or {}).get(key) or os.getenv(env_key, "")
    return str(value).strip()


def archive_path(cfg: dict[str, Any] | None = None) -> Path | None:
    value = _cfg_value(cfg, "hecate_bootstrap_archive", ENV_ARCHIVE)
    if not value:
        return None
    return Path(value).expanduser()


def bundle_url(cfg: dict[str, Any] | None = None) -> str:
    return _cfg_value(cfg, "hecate_bootstrap_url", ENV_URL)


def bundle_sha256(cfg: dict[str, Any] | None = None) -> str:
    return _cfg_value(cfg, "hecate_bootstrap_sha256", ENV_SHA256).lower()


def required_missing(*, root: Path | None = None) -> list[str]:
    return hecate_files_missing(root=root) + qdrant_storage_missing(root=root)


def hecate_files_missing(*, root: Path | None = None) -> list[str]:
    return [
        str(relative)
        for relative in REQUIRED_HECATE_FILES
        if not _repo_path(relative, root=root).is_file()
    ]


def qdrant_storage_missing(*, root: Path | None = None) -> list[str]:
    return [
        str(relative)
        for relative in QDRANT_MARKER_FILES
        if not _repo_path(relative, root=root).is_file()
    ]


def docker_volume_exists(volume_name: str = DEFAULT_QDRANT_VOLUME) -> bool:
    result = utils.run(
        ["docker", "volume", "inspect", volume_name],
        capture=True,
        check=False,
    )
    return result.returncode == 0


def inspect(cfg: dict[str, Any] | None = None, *, root: Path | None = None) -> BootstrapStatus:
    missing = required_missing(root=root)
    if not missing:
        return BootstrapStatus(
            ready=True,
            source_available=True,
            missing=[],
            source_detail="assets and Qdrant storage present",
        )

    local_archive = archive_path(cfg)
    if local_archive is not None:
        if local_archive.is_file():
            return BootstrapStatus(
                ready=False,
                source_available=True,
                missing=missing,
                source_detail=f"will extract {local_archive}",
            )
        return BootstrapStatus(
            ready=False,
            source_available=False,
            missing=missing + [f"{local_archive}"],
            source_detail=f"archive not found: {local_archive}",
        )

    url = bundle_url(cfg)
    if url:
        return BootstrapStatus(
            ready=False,
            source_available=True,
            missing=missing,
            source_detail=f"will download {url}",
        )

    if not hecate_files_missing(root=root) and qdrant_storage_missing(root=root) and docker_volume_exists():
        return BootstrapStatus(
            ready=False,
            source_available=True,
            missing=missing,
            source_detail=f"will migrate existing Docker volume {DEFAULT_QDRANT_VOLUME}",
        )

    return BootstrapStatus(
        ready=False,
        source_available=False,
        missing=missing,
        source_detail=(
            f"set {ENV_URL} or {ENV_ARCHIVE}, or create a bundle with "
            "scripts/package-hecate-bootstrap.py"
        ),
    )


def _verify_sha256(path: Path, expected: str, *, console: Console) -> bool:
    if not expected:
        return True

    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)

    actual = digest.hexdigest()
    if actual == expected:
        console.print(f"[green]OK[/green] Verified {path.name} sha256.")
        return True

    console.print(
        f"[red]ERROR {path.name} sha256 mismatch.[/red]\n"
        f"  expected: {expected}\n"
        f"  actual:   {actual}"
    )
    return False


def _target_for_archive_member(name: str, *, root: Path) -> Path | None:
    parts = PurePosixPath(name).parts
    if not parts or any(part in {"", ".", ".."} for part in parts):
        return None
    if parts[0].startswith("/") or "\\" in name:
        return None

    if len(parts) >= 2 and parts[0] == "hecate-bootstrap":
        return root / BOOTSTRAP_DIR / Path(*parts[1:])
    if len(parts) >= 3 and parts[0] == "output" and parts[1] == "hecate-bootstrap":
        return root / Path(*parts)
    if len(parts) >= 2 and parts[0] == "qdrant-storage":
        return root / QDRANT_DATA_DIR / Path(*parts[1:])
    if len(parts) >= 3 and parts[0] == ".parthenon-data" and parts[1] == "qdrant":
        return root / Path(*parts)
    return None


def _extract_tar(archive: Path, *, root: Path, console: Console) -> int:
    extracted = 0
    with tarfile.open(archive, "r:*") as tar:
        for member in tar.getmembers():
            target = _target_for_archive_member(member.name, root=root)
            if target is None:
                continue
            if member.isdir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            if not member.isfile():
                continue
            source = tar.extractfile(member)
            if source is None:
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with source, target.open("wb") as out:
                shutil.copyfileobj(source, out)
            extracted += 1
    console.print(f"[green]OK[/green] Extracted {extracted} Hecate bootstrap file(s).")
    return extracted


def _extract_zip(archive: Path, *, root: Path, console: Console) -> int:
    extracted = 0
    with zipfile.ZipFile(archive) as zf:
        for info in zf.infolist():
            target = _target_for_archive_member(info.filename, root=root)
            if target is None:
                continue
            if info.is_dir():
                target.mkdir(parents=True, exist_ok=True)
                continue
            target.parent.mkdir(parents=True, exist_ok=True)
            with zf.open(info) as source, target.open("wb") as out:
                shutil.copyfileobj(source, out)
            extracted += 1
    console.print(f"[green]OK[/green] Extracted {extracted} Hecate bootstrap file(s).")
    return extracted


def extract_bundle(archive: Path, *, root: Path | None = None, console: Console | None = None) -> bool:
    if console is None:
        console = Console()
    repo_root = root or utils.REPO_ROOT
    archive = archive.expanduser()

    try:
        if archive.suffix == ".zip":
            count = _extract_zip(archive, root=repo_root, console=console)
        else:
            count = _extract_tar(archive, root=repo_root, console=console)
    except (OSError, tarfile.TarError, zipfile.BadZipFile) as exc:
        console.print(f"[red]ERROR Failed to extract {archive}: {exc}[/red]")
        return False

    if count == 0:
        console.print(
            f"[red]ERROR {archive} did not contain recognized Hecate bootstrap paths.[/red]"
        )
        return False
    return True


def _download_bundle(cfg: dict[str, Any] | None, *, root: Path, console: Console) -> Path | None:
    url = bundle_url(cfg)
    if not url:
        return None

    downloads_dir = root / DOWNLOADS_DIR
    downloads_dir.mkdir(parents=True, exist_ok=True)
    dest = downloads_dir / BUNDLE_FILENAME

    console.print(f"[cyan]Downloading Hecate bootstrap bundle from {url}[/cyan]")
    if not download_file(url, dest, label=BUNDLE_FILENAME, console=console):
        return None
    if not _verify_sha256(dest, bundle_sha256(cfg), console=console):
        return None
    return dest


def _migrate_qdrant_volume(*, root: Path, console: Console) -> bool:
    if not docker_volume_exists():
        return False

    target_parent = root / QDRANT_DATA_DIR.parent
    target_parent.mkdir(parents=True, exist_ok=True)
    target_name = QDRANT_DATA_DIR.name
    tmp_name = f"{target_name}.tmp"

    console.print(
        f"[cyan]Migrating Docker volume {DEFAULT_QDRANT_VOLUME} to {QDRANT_DATA_DIR}[/cyan]"
    )
    rc = utils.run_stream([
        "docker", "run", "--rm",
        "-v", f"{DEFAULT_QDRANT_VOLUME}:/source:ro",
        "-v", f"{target_parent.resolve()}:/dest",
        "alpine:3.20",
        "sh", "-lc",
        (
            f"rm -rf /dest/{tmp_name} && "
            f"mkdir -p /dest/{tmp_name} && "
            f"cp -a /source/. /dest/{tmp_name}/ && "
            f"rm -rf /dest/{target_name} && "
            f"mv /dest/{tmp_name} /dest/{target_name}"
        ),
    ])
    return rc == 0


def ensure(cfg: dict[str, Any], *, console: Console | None = None) -> None:
    """Ensure Hecate files and Qdrant data are present before Docker starts."""
    if not cfg.get("enable_hecate"):
        return

    if console is None:
        console = Console()

    console.rule("[bold]Hecate Bootstrap Assets[/bold]")
    root = utils.REPO_ROOT
    status = inspect(cfg, root=root)
    if status.ready:
        console.print("[green]OK Hecate bootstrap assets are ready.[/green]\n")
        return

    local_archive = archive_path(cfg)
    archive: Path | None = None
    if local_archive is not None and local_archive.is_file():
        archive = local_archive
    elif bundle_url(cfg):
        archive = _download_bundle(cfg, root=root, console=console)

    if archive is not None:
        if not extract_bundle(archive, root=root, console=console):
            _fail(status)
    elif (
        not hecate_files_missing(root=root)
        and qdrant_storage_missing(root=root)
        and _migrate_qdrant_volume(root=root, console=console)
    ):
        console.print("[green]OK Existing Qdrant volume migrated.[/green]")

    missing = required_missing(root=root)
    if missing:
        _fail(inspect(cfg, root=root))

    console.print("[green]OK Hecate bootstrap assets are ready.[/green]\n")


def _fail(status: BootstrapStatus) -> None:
    missing_lines = "\n".join(f"  - {item}" for item in status.missing)
    console = Console()
    console.print(
        Panel(
            "[bold red]Hecate bootstrap assets are missing.[/bold red]\n\n"
            f"{missing_lines}\n\n"
            "Provide a bundle before installing Community with Hecate enabled:\n"
            f"  - Set {ENV_URL} to a published bundle URL, or\n"
            f"  - Set {ENV_ARCHIVE} to a local bundle path, or\n"
            "  - Run scripts/package-hecate-bootstrap.py on a prepared machine.\n\n"
            f"Current source status: {status.source_detail}",
            title="Hecate Bootstrap Required",
            border_style="red",
            padding=(1, 2),
        )
    )
    sys.exit(1)
