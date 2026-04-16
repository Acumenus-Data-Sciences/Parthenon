#!/usr/bin/env python3
"""Package Hecate bootstrap files and Qdrant storage for Community installs.

Run this on a machine where Hecate semantic search is already working. The
resulting tarball can be uploaded as a release asset and consumed by setting
PARTHENON_HECATE_BOOTSTRAP_URL, or passed locally with
PARTHENON_HECATE_BOOTSTRAP_ARCHIVE.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import tarfile
import tempfile
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_HECATE_DIR = REPO_ROOT / "output" / "hecate-bootstrap"
DEFAULT_QDRANT_DIR = REPO_ROOT / ".parthenon-data" / "qdrant"
DEFAULT_QDRANT_VOLUME = "parthenon_qdrant-data"
DEFAULT_OUTPUT = REPO_ROOT / "dist" / "hecate-community-bootstrap.tar.gz"

REQUIRED_HECATE_FILES = [
    "all_pairs.txt",
    "ConceptRecordCounts.json",
]
QDRANT_MARKER = Path("collections") / "meddra" / "config.json"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--hecate-dir",
        type=Path,
        default=DEFAULT_HECATE_DIR,
        help="Directory containing all_pairs.txt and ConceptRecordCounts.json",
    )
    parser.add_argument(
        "--qdrant-dir",
        type=Path,
        default=None,
        help="Prepared Qdrant storage directory. Defaults to .parthenon-data/qdrant if present.",
    )
    parser.add_argument(
        "--qdrant-volume",
        default=DEFAULT_QDRANT_VOLUME,
        help="Docker volume to export when --qdrant-dir is not present",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=DEFAULT_OUTPUT,
        help="Output tar.gz path",
    )
    return parser.parse_args()


def require_hecate_files(hecate_dir: Path) -> None:
    missing = [name for name in REQUIRED_HECATE_FILES if not (hecate_dir / name).is_file()]
    if missing:
        raise SystemExit(
            "Missing Hecate bootstrap file(s): "
            + ", ".join(str(hecate_dir / name) for name in missing)
        )


def qdrant_dir_ready(path: Path) -> bool:
    return (path / QDRANT_MARKER).is_file()


def export_qdrant_volume(volume_name: str, staging_dir: Path) -> Path:
    qdrant_dest = staging_dir / "qdrant-storage"
    qdrant_dest.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(
        [
            "docker", "run", "--rm",
            "-v", f"{volume_name}:/source:ro",
            "-v", f"{staging_dir.resolve()}:/stage",
            "alpine:3.20",
            "sh", "-lc",
            "cp -a /source/. /stage/qdrant-storage/",
        ],
        check=False,
    )
    if result.returncode != 0:
        raise SystemExit(f"Could not export Docker volume {volume_name!r}")
    if not qdrant_dir_ready(qdrant_dest):
        raise SystemExit(
            f"Exported Docker volume {volume_name!r}, but {QDRANT_MARKER} was not found"
        )
    return qdrant_dest


def resolve_qdrant_source(args: argparse.Namespace, staging_dir: Path) -> Path:
    if args.qdrant_dir is not None:
        qdrant_dir = args.qdrant_dir
        if not qdrant_dir_ready(qdrant_dir):
            raise SystemExit(f"Qdrant directory is missing {QDRANT_MARKER}: {qdrant_dir}")
        return qdrant_dir

    if qdrant_dir_ready(DEFAULT_QDRANT_DIR):
        return DEFAULT_QDRANT_DIR

    return export_qdrant_volume(args.qdrant_volume, staging_dir)


def add_directory(tar: tarfile.TarFile, source: Path, arcname: str) -> None:
    for path in sorted(source.rglob("*")):
        if path.is_dir():
            continue
        tar.add(path, arcname=str(Path(arcname) / path.relative_to(source)))


def write_manifest(staging_dir: Path, hecate_dir: Path, qdrant_source: Path) -> Path:
    manifest = {
        "format": "parthenon.hecate-community-bootstrap.v1",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "hecate_files": REQUIRED_HECATE_FILES,
        "qdrant_marker": str(QDRANT_MARKER),
        "source": {
            "hecate_dir": str(hecate_dir),
            "qdrant_source": str(qdrant_source),
        },
    }
    path = staging_dir / "manifest.json"
    path.write_text(json.dumps(manifest, indent=2) + "\n")
    return path


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    args = parse_args()
    hecate_dir = args.hecate_dir.resolve()
    require_hecate_files(hecate_dir)

    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="parthenon-hecate-package-") as tmp:
        staging_dir = Path(tmp)
        qdrant_source = resolve_qdrant_source(args, staging_dir)
        manifest_path = write_manifest(staging_dir, hecate_dir, qdrant_source)

        with tarfile.open(args.output, "w:gz") as tar:
            for name in REQUIRED_HECATE_FILES:
                tar.add(hecate_dir / name, arcname=f"hecate-bootstrap/{name}")
            add_directory(tar, qdrant_source, "qdrant-storage")
            tar.add(manifest_path, arcname="manifest.json")

    digest = sha256_file(args.output)
    sha_path = args.output.with_suffix(args.output.suffix + ".sha256")
    sha_path.write_text(f"{digest}  {args.output.name}\n")

    size_mb = args.output.stat().st_size / (1024 * 1024)
    print(f"Wrote {args.output} ({size_mb:.1f} MB)")
    print(f"Wrote {sha_path}")
    print(f"SHA256: {digest}")


if __name__ == "__main__":
    main()
