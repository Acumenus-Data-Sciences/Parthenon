#!/usr/bin/env python3
"""
Download Harvard COVID-19 CT Dataset from Harvard Dataverse.
=============================================================

Dataset: COVID19-CT-Dataset (DOI: 10.7910/DVN/6ACUZJ)
  - 1000+ patients, DICOM CT images in per-patient RAR archives
  - Published by Mashhad University of Medical Sciences
  - Hosted on Harvard Dataverse (open access)

This script:
  1. Queries the Harvard Dataverse API for the file manifest
  2. Downloads each RAR archive with progress bars and resume support
  3. Extracts DICOM files using `unrar`
  4. Optionally cleans up RAR files after extraction

Usage:
    python3 tools/download_harvard_covid.py
    python3 tools/download_harvard_covid.py --keep-rar     # don't delete RARs after extraction
    python3 tools/download_harvard_covid.py --dry-run       # list files without downloading
    python3 tools/download_harvard_covid.py --workers 4     # parallel downloads (default: 2)

Requirements:
    pip install requests   (usually pre-installed)
    apt install unrar      (for RAR extraction)
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from threading import Lock
from typing import Any

import requests

# Try rich for pretty output; fall back to plain text
try:
    from rich.console import Console
    from rich.live import Live
    from rich.panel import Panel
    from rich.progress import (
        Progress,
        BarColumn,
        DownloadColumn,
        MofNCompleteColumn,
        SpinnerColumn,
        TextColumn,
        TimeElapsedColumn,
        TimeRemainingColumn,
        TransferSpeedColumn,
    )
    from rich.table import Table

    HAS_RICH = True
except ImportError:
    HAS_RICH = False

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

DATASET_DOI = "doi:10.7910/DVN/6ACUZJ"
DATAVERSE_BASE = "https://dataverse.harvard.edu"
API_DATASET_URL = f"{DATAVERSE_BASE}/api/datasets/:persistentId/?persistentId={DATASET_DOI}"
API_FILE_URL = f"{DATAVERSE_BASE}/api/access/datafile"

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUTPUT_DIR = REPO_ROOT / "dicom_samples" / "harvard_covid19"
STATE_FILE_NAME = ".download_state.json"

# ---------------------------------------------------------------------------
# Console helpers
# ---------------------------------------------------------------------------

if HAS_RICH:
    console = Console()
else:
    class _PlainConsole:
        def print(self, *args, **kwargs):
            text = " ".join(str(a) for a in args)
            # Strip rich markup crudely
            import re
            text = re.sub(r"\[/?[^\]]*\]", "", text)
            print(text)

        def rule(self, *args, **kwargs):
            text = " ".join(str(a) for a in args)
            import re
            text = re.sub(r"\[/?[^\]]*\]", "", text)
            print(f"\n{'─' * 60}\n  {text}\n{'─' * 60}")

    console = _PlainConsole()


# ---------------------------------------------------------------------------
# State persistence (track completed downloads for resume)
# ---------------------------------------------------------------------------

def _load_state(output_dir: Path) -> dict:
    state_path = output_dir / STATE_FILE_NAME
    if state_path.exists():
        try:
            return json.loads(state_path.read_text())
        except Exception:
            return {}
    return {}


def _save_state(output_dir: Path, state: dict) -> None:
    state_path = output_dir / STATE_FILE_NAME
    state_path.write_text(json.dumps(state, indent=2))


# ---------------------------------------------------------------------------
# Harvard Dataverse API
# ---------------------------------------------------------------------------

def fetch_file_manifest() -> list[dict[str, Any]]:
    """Query Harvard Dataverse API for all files in the dataset."""
    console.print("[cyan]Querying Harvard Dataverse API for file manifest…[/cyan]")

    resp = requests.get(API_DATASET_URL, timeout=30)
    resp.raise_for_status()
    data = resp.json()

    files_raw = data["data"]["latestVersion"]["files"]
    files = []
    for entry in files_raw:
        df = entry.get("dataFile", {})
        files.append({
            "id": df.get("id"),
            "filename": df.get("filename", ""),
            "size": df.get("filesize", 0),
            "md5": df.get("md5", ""),
            "content_type": df.get("contentType", ""),
            "description": entry.get("description", ""),
            "directory_label": entry.get("directoryLabel", ""),
        })

    # Filter to only RAR files (patient archives)
    rar_files = [f for f in files if f["filename"].lower().endswith(".rar")]
    other_files = [f for f in files if not f["filename"].lower().endswith(".rar")]

    return rar_files, other_files


# ---------------------------------------------------------------------------
# Download with progress
# ---------------------------------------------------------------------------

_download_lock = Lock()


def download_file(
    file_info: dict,
    output_dir: Path,
    state: dict,
    overall_progress: Progress | None = None,
    overall_task_id: int | None = None,
    file_progress: Progress | None = None,
) -> dict:
    """Download a single file from Harvard Dataverse with resume support.

    Returns a result dict with status info.
    """
    file_id = file_info["id"]
    filename = file_info["filename"]
    expected_size = file_info["size"]
    dest = output_dir / filename

    # Check if already completed
    if state.get(filename, {}).get("status") == "extracted":
        if file_progress and HAS_RICH:
            task = file_progress.add_task(f"[green]✓[/green] {filename}", total=1, completed=1)
        with _download_lock:
            if overall_progress and overall_task_id is not None:
                overall_progress.advance(overall_task_id)
        return {"filename": filename, "status": "skipped", "reason": "already extracted"}

    # Check if RAR already fully downloaded
    if dest.exists() and dest.stat().st_size == expected_size:
        with _download_lock:
            if overall_progress and overall_task_id is not None:
                overall_progress.advance(overall_task_id)
        return {"filename": filename, "status": "exists", "size": expected_size}

    # Download with resume support
    url = f"{API_FILE_URL}/{file_id}"
    existing_size = dest.stat().st_size if dest.exists() else 0

    headers = {}
    if existing_size > 0:
        headers["Range"] = f"bytes={existing_size}-"

    try:
        resp = requests.get(url, headers=headers, stream=True, timeout=60)

        if resp.status_code == 416:
            # Already complete
            with _download_lock:
                if overall_progress and overall_task_id is not None:
                    overall_progress.advance(overall_task_id)
            return {"filename": filename, "status": "exists", "size": existing_size}

        resp.raise_for_status()

        # Determine mode and total
        if resp.status_code == 206:
            mode = "ab"
            total = expected_size
        else:
            mode = "wb"
            existing_size = 0
            total = expected_size

        # Create progress task for this file
        task_id = None
        if file_progress and HAS_RICH:
            task_id = file_progress.add_task(
                filename[:45],
                total=total,
                completed=existing_size,
            )

        with open(dest, mode) as f:
            for chunk in resp.iter_content(chunk_size=256 * 1024):
                if chunk:
                    f.write(chunk)
                    if file_progress and task_id is not None:
                        file_progress.advance(task_id, len(chunk))

        if file_progress and task_id is not None:
            file_progress.update(task_id, description=f"[green]✓[/green] {filename[:43]}")

        with _download_lock:
            if overall_progress and overall_task_id is not None:
                overall_progress.advance(overall_task_id)

        return {"filename": filename, "status": "downloaded", "size": dest.stat().st_size}

    except Exception as e:
        with _download_lock:
            if overall_progress and overall_task_id is not None:
                overall_progress.advance(overall_task_id)
        return {"filename": filename, "status": "error", "error": str(e)}


# ---------------------------------------------------------------------------
# RAR extraction
# ---------------------------------------------------------------------------

def extract_rar(rar_path: Path, output_dir: Path) -> bool:
    """Extract a RAR file using the `unrar` command."""
    try:
        result = subprocess.run(
            ["unrar", "x", "-o+", "-y", str(rar_path), str(output_dir) + "/"],
            capture_output=True,
            text=True,
            timeout=300,
        )
        return result.returncode == 0
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Main orchestration
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Download Harvard COVID-19 CT Dataset from Harvard Dataverse"
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Output directory (default: {DEFAULT_OUTPUT_DIR.relative_to(REPO_ROOT)})",
    )
    parser.add_argument(
        "--workers",
        type=int,
        default=2,
        help="Number of parallel downloads (default: 2)",
    )
    parser.add_argument(
        "--keep-rar",
        action="store_true",
        help="Keep RAR files after extraction (default: delete to save space)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="List files without downloading",
    )
    parser.add_argument(
        "--skip-extract",
        action="store_true",
        help="Download only, skip RAR extraction",
    )
    args = parser.parse_args()

    output_dir: Path = args.output_dir.resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    # ── Check unrar ──────────────────────────────────────────────────────
    if not args.dry_run and not args.skip_extract:
        if not shutil.which("unrar"):
            console.print("[red]Error:[/red] `unrar` is not installed.")
            console.print("  Install it with: [bold]sudo apt install unrar[/bold]")
            sys.exit(1)

    # ── Fetch manifest ───────────────────────────────────────────────────
    try:
        rar_files, other_files = fetch_file_manifest()
    except Exception as e:
        console.print(f"[red]Failed to fetch dataset manifest:[/red] {e}")
        sys.exit(1)

    total_size = sum(f["size"] for f in rar_files)
    total_size_gb = total_size / (1024 ** 3)

    console.print()
    if HAS_RICH:
        console.print(
            Panel(
                f"[bold]COVID19-CT-Dataset[/bold] (Harvard Dataverse)\n"
                f"DOI: 10.7910/DVN/6ACUZJ\n\n"
                f"  RAR archives:  [cyan]{len(rar_files)}[/cyan] files\n"
                f"  Total size:    [cyan]{total_size_gb:.1f} GB[/cyan]\n"
                f"  Other files:   [dim]{len(other_files)} (metadata, etc.)[/dim]\n"
                f"  Output dir:    [dim]{output_dir}[/dim]",
                title="Dataset Info",
                border_style="cyan",
                padding=(1, 2),
            )
        )
    else:
        console.print(f"Dataset: COVID19-CT-Dataset (Harvard Dataverse)")
        console.print(f"  RAR archives: {len(rar_files)} files")
        console.print(f"  Total size:   {total_size_gb:.1f} GB")
        console.print(f"  Output dir:   {output_dir}")

    if args.dry_run:
        console.print("\n[bold]Files:[/bold]")
        for f in sorted(rar_files, key=lambda x: x["filename"]):
            size_mb = f["size"] / (1024 ** 2)
            console.print(f"  {f['filename']:40s}  {size_mb:>8.1f} MB  (id={f['id']})")
        console.print(f"\n[dim]Total: {len(rar_files)} RAR files, {total_size_gb:.1f} GB[/dim]")
        return

    # ── Check disk space ─────────────────────────────────────────────────
    stat = os.statvfs(output_dir)
    free_gb = (stat.f_bavail * stat.f_frsize) / (1024 ** 3)
    # Need ~2x if keeping RARs, ~1.2x if deleting after extract
    needed_gb = total_size_gb * (2.2 if args.keep_rar else 1.3)

    if free_gb < needed_gb:
        console.print(
            f"\n[yellow]Warning:[/yellow] Available disk: {free_gb:.1f} GB, "
            f"estimated need: ~{needed_gb:.0f} GB"
        )
        console.print("  Consider using --keep-rar=false (default) to save space.")
        resp = input("  Continue anyway? [y/N] ").strip().lower()
        if resp != "y":
            console.print("[dim]Aborted.[/dim]")
            return
    else:
        console.print(
            f"\n[green]Disk space OK:[/green] {free_gb:.1f} GB available "
            f"(need ~{needed_gb:.0f} GB)"
        )

    # ── Load state for resume ────────────────────────────────────────────
    state = _load_state(output_dir)
    already_done = sum(
        1 for f in rar_files
        if state.get(f["filename"], {}).get("status") == "extracted"
    )
    if already_done > 0:
        console.print(
            f"[green]Resuming:[/green] {already_done}/{len(rar_files)} files "
            f"already completed from previous run."
        )

    # ── Sort files: smallest first for quick initial progress ────────────
    rar_files.sort(key=lambda f: f["size"])

    # ── Download + Extract ───────────────────────────────────────────────
    console.rule("[bold]Downloading[/bold]")

    started = time.time()
    downloaded = 0
    extracted = 0
    errors = []

    if HAS_RICH:
        overall_progress = Progress(
            SpinnerColumn(),
            TextColumn("[bold blue]Overall"),
            BarColumn(),
            MofNCompleteColumn(),
            TimeElapsedColumn(),
            TimeRemainingColumn(),
            console=console,
        )
        file_progress = Progress(
            TextColumn("  {task.description}"),
            BarColumn(bar_width=30),
            DownloadColumn(),
            TransferSpeedColumn(),
            console=console,
        )
        extract_progress = Progress(
            SpinnerColumn(),
            TextColumn("[bold green]Extracting"),
            BarColumn(),
            MofNCompleteColumn(),
            console=console,
        )
    else:
        overall_progress = None
        file_progress = None
        extract_progress = None

    # Phase 1: Download all RAR files
    if HAS_RICH and overall_progress and file_progress:
        overall_task = overall_progress.add_task("Downloading", total=len(rar_files))

        with Live(
            Panel(
                overall_progress,
                title="Download Progress",
                border_style="blue",
                padding=(0, 1),
            ),
            console=console,
            refresh_per_second=4,
        ):
            with ThreadPoolExecutor(max_workers=args.workers) as pool:
                futures = {
                    pool.submit(
                        download_file,
                        f, output_dir, state,
                        overall_progress, overall_task,
                        file_progress,
                    ): f
                    for f in rar_files
                }
                for future in as_completed(futures):
                    result = future.result()
                    if result["status"] == "error":
                        errors.append(result)
                    elif result["status"] != "skipped":
                        downloaded += 1
    else:
        # Plain-text fallback
        for i, f in enumerate(rar_files):
            if state.get(f["filename"], {}).get("status") == "extracted":
                print(f"  [{i+1}/{len(rar_files)}] {f['filename']} — already extracted, skipping")
                continue
            print(f"  [{i+1}/{len(rar_files)}] Downloading {f['filename']}…")
            result = download_file(f, output_dir, state)
            if result["status"] == "error":
                errors.append(result)
                print(f"    ERROR: {result['error']}")
            else:
                downloaded += 1
                print(f"    OK ({result.get('size', 0) / (1024**2):.1f} MB)")

    # Phase 2: Extract all downloaded RAR files
    if not args.skip_extract:
        console.rule("[bold]Extracting RAR Archives[/bold]")

        to_extract = [
            f for f in rar_files
            if state.get(f["filename"], {}).get("status") != "extracted"
            and (output_dir / f["filename"]).exists()
        ]

        if to_extract:
            if HAS_RICH and extract_progress:
                extract_task = extract_progress.add_task("Extracting", total=len(to_extract))

                with Live(
                    Panel(
                        extract_progress,
                        title="Extraction Progress",
                        border_style="green",
                        padding=(0, 1),
                    ),
                    console=console,
                    refresh_per_second=2,
                ):
                    for f in to_extract:
                        rar_path = output_dir / f["filename"]
                        ok = extract_rar(rar_path, output_dir)
                        if ok:
                            extracted += 1
                            state[f["filename"]] = {"status": "extracted"}
                            _save_state(output_dir, state)
                            if not args.keep_rar:
                                rar_path.unlink(missing_ok=True)
                        else:
                            errors.append({
                                "filename": f["filename"],
                                "status": "extract_error",
                            })
                        extract_progress.advance(extract_task)
            else:
                for i, f in enumerate(to_extract):
                    rar_path = output_dir / f["filename"]
                    print(f"  [{i+1}/{len(to_extract)}] Extracting {f['filename']}…")
                    ok = extract_rar(rar_path, output_dir)
                    if ok:
                        extracted += 1
                        state[f["filename"]] = {"status": "extracted"}
                        _save_state(output_dir, state)
                        if not args.keep_rar:
                            rar_path.unlink(missing_ok=True)
                    else:
                        errors.append({
                            "filename": f["filename"],
                            "status": "extract_error",
                        })
                        print(f"    ERROR: extraction failed")
        else:
            console.print("[green]All files already extracted.[/green]")

    # ── Summary ──────────────────────────────────────────────────────────
    elapsed = time.time() - started
    elapsed_min = elapsed / 60

    console.print()

    if HAS_RICH:
        summary = Table(title="Download Summary")
        summary.add_column("Metric", style="bold")
        summary.add_column("Value")
        summary.add_row("Total files", str(len(rar_files)))
        summary.add_row("Downloaded", f"[green]{downloaded}[/green]")
        summary.add_row("Extracted", f"[green]{extracted}[/green]")
        summary.add_row("Previously done", f"[dim]{already_done}[/dim]")
        summary.add_row("Errors", f"[red]{len(errors)}[/red]" if errors else "[green]0[/green]")
        summary.add_row("Time elapsed", f"{elapsed_min:.1f} min")
        summary.add_row("Output dir", str(output_dir))
        console.print(summary)
    else:
        print(f"\n  Downloaded: {downloaded}")
        print(f"  Extracted:  {extracted}")
        print(f"  Errors:     {len(errors)}")
        print(f"  Time:       {elapsed_min:.1f} min")

    if errors:
        console.print("\n[yellow]Failed files:[/yellow]")
        for e in errors:
            console.print(f"  [red]✗[/red] {e['filename']}: {e.get('error', e.get('status'))}")
        console.print(
            "\n[dim]Re-run this script to retry failed downloads (state is saved).[/dim]"
        )

    if not errors:
        console.print(
            "\n[green]All done![/green] DICOM files are in:\n"
            f"  [bold]{output_dir}[/bold]\n\n"
            "To import into Parthenon:\n"
            "  [cyan]docker compose exec php php artisan imaging:import-samples "
            f"--dir=dicom_samples/harvard_covid19[/cyan]"
        )


if __name__ == "__main__":
    main()
