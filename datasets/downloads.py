"""Download infrastructure for Parthenon dataset acquisition.

Public API:
    download_file(url, dest, *, label="", console=None) -> bool
    decompress_gz(gz_path, out_path, *, console=None) -> bool
    extract_tarball(tar_path, extract_to, *, console=None) -> bool
"""
from __future__ import annotations

import gzip
import urllib.request
import urllib.error
from pathlib import Path
from typing import Optional

from rich.console import Console
from rich.progress import (
    Progress,
    BarColumn,
    DownloadColumn,
    TransferSpeedColumn,
    TimeRemainingColumn,
)

_CHUNK_DOWNLOAD = 256 * 1024   # 256 KB
_CHUNK_DECOMPRESS = 512 * 1024  # 512 KB


def download_file(
    url: str,
    dest: Path,
    *,
    label: str = "",
    console: Optional[Console] = None,
) -> bool:
    """Download *url* to *dest* with HTTP Range resume support.

    Returns True on success, False on failure.
    """
    if console is None:
        console = Console()

    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)

    existing_size = dest.stat().st_size if dest.exists() else 0
    display_label = label or dest.name

    req = urllib.request.Request(url)
    if existing_size > 0:
        req.add_header("Range", f"bytes={existing_size}-")

    try:
        response = urllib.request.urlopen(req)
    except urllib.error.HTTPError as exc:
        if exc.code == 416:
            # 416 Range Not Satisfiable — file already complete
            console.print(f"[green]✓[/green] {display_label} already complete.")
            return True
        console.print(f"[red]HTTP {exc.code} downloading {display_label}: {exc.reason}[/red]")
        return False
    except urllib.error.URLError as exc:
        console.print(f"[red]Network error downloading {display_label}: {exc.reason}[/red]")
        return False

    status_code = response.status
    total_str = response.headers.get("Content-Length")
    remote_total = int(total_str) if total_str else None

    # For 206 Partial Content, total is remaining bytes; add already-downloaded portion
    if status_code == 206:
        file_mode = "ab"
        total_bytes = (existing_size + remote_total) if remote_total is not None else None
    else:
        file_mode = "wb"
        existing_size = 0
        total_bytes = remote_total

    try:
        with Progress(
            "[progress.description]{task.description}",
            BarColumn(),
            DownloadColumn(),
            TransferSpeedColumn(),
            TimeRemainingColumn(),
            console=console,
            transient=True,
        ) as progress:
            task = progress.add_task(
                display_label,
                total=total_bytes,
                completed=existing_size,
            )

            with open(dest, file_mode) as out_file:
                while True:
                    chunk = response.read(_CHUNK_DOWNLOAD)
                    if not chunk:
                        break
                    out_file.write(chunk)
                    progress.advance(task, len(chunk))

    except OSError as exc:
        console.print(f"[red]Write error for {display_label}: {exc}[/red]")
        return False

    return True


def decompress_gz(
    gz_path: Path,
    out_path: Path,
    *,
    console: Optional[Console] = None,
) -> bool:
    """Decompress a gzip file from *gz_path* to *out_path*.

    Skips decompression if *out_path* already exists and is non-empty.
    Returns True on success, False on failure.
    """
    if console is None:
        console = Console()

    gz_path = Path(gz_path)
    out_path = Path(out_path)

    if out_path.exists() and out_path.stat().st_size > 0:
        console.print(f"[green]✓[/green] {out_path.name} already decompressed.")
        return True

    total_compressed = gz_path.stat().st_size if gz_path.exists() else None

    try:
        with Progress(
            "[progress.description]{task.description}",
            BarColumn(),
            DownloadColumn(),
            TransferSpeedColumn(),
            TimeRemainingColumn(),
            console=console,
            transient=True,
        ) as progress:
            task = progress.add_task(
                f"Decompressing {out_path.name}",
                total=total_compressed,
            )

            with gzip.open(gz_path, "rb") as f_in, open(out_path, "wb") as f_out:
                while True:
                    chunk = f_in.read(_CHUNK_DECOMPRESS)
                    if not chunk:
                        break
                    f_out.write(chunk)
                    # Track progress by position in the compressed stream
                    try:
                        compressed_pos = f_in.fileobj.tell()  # type: ignore[attr-defined]
                        progress.update(task, completed=compressed_pos)
                    except AttributeError:
                        progress.advance(task, 0)

    except (OSError, gzip.BadGzipFile) as exc:
        console.print(f"[red]Decompression failed for {gz_path.name}: {exc}[/red]")
        # Clean up partial output
        if out_path.exists():
            out_path.unlink(missing_ok=True)
        return False

    return True


def extract_tarball(
    tar_path: Path,
    extract_to: Path,
    *,
    console: Optional[Console] = None,
) -> bool:
    """Extract a tar.gz archive at *tar_path* into *extract_to*.

    Skips extraction if *extract_to* already exists and contains files.
    Returns True on success, False on failure.
    """
    import tarfile  # noqa: PLC0415 — deferred import

    if console is None:
        console = Console()

    tar_path = Path(tar_path)
    extract_to = Path(extract_to)

    if extract_to.exists() and any(extract_to.iterdir()):
        console.print(f"[green]✓[/green] {extract_to.name} already extracted.")
        return True

    extract_to.mkdir(parents=True, exist_ok=True)

    try:
        with tarfile.open(tar_path, "r:gz") as tar:
            tar.extractall(extract_to, filter="data")  # type: ignore[call-arg]
    except tarfile.TarError as exc:
        console.print(f"[red]Extraction failed for {tar_path.name}: {exc}[/red]")
        return False
    except TypeError:
        # Python < 3.12 does not support filter= keyword; fall back without it
        try:
            with tarfile.open(tar_path, "r:gz") as tar:
                tar.extractall(extract_to)
        except tarfile.TarError as exc:
            console.print(f"[red]Extraction failed for {tar_path.name}: {exc}[/red]")
            return False

    console.print(f"[green]✓[/green] Extracted {tar_path.name} → {extract_to}")
    return True
