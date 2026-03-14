"""Phase 5b — Demo Data Downloads & Import.

Provides three tiers of demo data that mirror what runs on parthenon.acumenus.net:

  Tier 1 — Minimal   (~500 MB disk, ~30 min)
    Eunomia GiBleed CDM + ClinVar pathogenic-only subset

  Tier 2 — Standard  (~20 GB disk, ~2 hrs)
    + 2 GIAB VCF samples (HG001, HG002) + Class-3 Malocclusion DICOM + full ClinVar

  Tier 3 — Full Mirror  (~280 GB disk, ~8-12 hrs)
    + All 7 GIAB VCF samples + Harvard COVID-19 DICOM (1,000 CT studies)
    Mirrors the complete parthenon.acumenus.net dataset

Each dataset is independently resumable. Downloads support HTTP Range (resume).
Artisan import commands handle parsing/DB insertion.
"""
from __future__ import annotations

import gzip
import hashlib
import os
import shutil
import sys
import time
import urllib.request
import urllib.error
from pathlib import Path
from typing import Any, Optional

from rich.console import Console
from rich.panel import Panel
from rich.progress import (
    Progress,
    BarColumn,
    DownloadColumn,
    TransferSpeedColumn,
    TimeRemainingColumn,
)
from rich.table import Table

from . import utils

console = Console()

# ---------------------------------------------------------------------------
# Download registry — public data sources
# ---------------------------------------------------------------------------

GIAB_BASE = "https://ftp-trace.ncbi.nlm.nih.gov/giab/ftp/release"

GIAB_SAMPLES: dict[str, dict[str, str]] = {
    "HG001": {
        "url": f"{GIAB_BASE}/NA12878_HG001/NISTv4.2.1/GRCh38/HG001_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "filename": "HG001_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "vcf_name": "HG001_GRCh38_1_22_v4.2.1_benchmark.vcf",
        "desc": "NA12878 — most extensively characterized human genome",
    },
    "HG002": {
        "url": f"{GIAB_BASE}/AshkenazimTrio/HG002_NA24385_son/NISTv4.2.1/GRCh38/HG002_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "filename": "HG002_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "vcf_name": "HG002_GRCh38_1_22_v4.2.1_benchmark.vcf",
        "desc": "Ashkenazim Trio — Son (NA24385)",
    },
    "HG003": {
        "url": f"{GIAB_BASE}/AshkenazimTrio/HG003_NA24149_father/NISTv4.2.1/GRCh38/HG003_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "filename": "HG003_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "vcf_name": "HG003_GRCh38_1_22_v4.2.1_benchmark.vcf",
        "desc": "Ashkenazim Trio — Father (NA24149)",
    },
    "HG004": {
        "url": f"{GIAB_BASE}/AshkenazimTrio/HG004_NA24143_mother/NISTv4.2.1/GRCh38/HG004_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "filename": "HG004_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "vcf_name": "HG004_GRCh38_1_22_v4.2.1_benchmark.vcf",
        "desc": "Ashkenazim Trio — Mother (NA24143)",
    },
    "HG005": {
        "url": f"{GIAB_BASE}/ChineseTrio/HG005_NA24631_son/NISTv4.2.1/GRCh38/HG005_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "filename": "HG005_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "vcf_name": "HG005_GRCh38_1_22_v4.2.1_benchmark.vcf",
        "desc": "Chinese Trio — Son (NA24631)",
    },
    "HG006": {
        "url": f"{GIAB_BASE}/ChineseTrio/HG006_NA24694_father/NISTv4.2.1/GRCh38/HG006_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "filename": "HG006_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "vcf_name": "HG006_GRCh38_1_22_v4.2.1_benchmark.vcf",
        "desc": "Chinese Trio — Father (NA24694)",
    },
    "HG007": {
        "url": f"{GIAB_BASE}/ChineseTrio/HG007_NA24695_mother/NISTv4.2.1/GRCh38/HG007_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "filename": "HG007_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "vcf_name": "HG007_GRCh38_1_22_v4.2.1_benchmark.vcf",
        "desc": "Chinese Trio — Mother (NA24695)",
    },
}

# Harvard COVID-19 CT dataset from The Cancer Imaging Archive (TCIA)
# Download via TCIA REST API or NBIA Data Retriever
DICOM_DATASETS: dict[str, dict[str, Any]] = {
    "class3-malocclusion": {
        "url": "https://github.com/sudoshi/parthenon-demo-data/releases/download/v1.0/class3-malocclusion.tar.gz",
        "filename": "class3-malocclusion.tar.gz",
        "extract_to": "dicom_samples/Class-3-malocclusion",
        "size_mb": 23,
        "desc": "Orthodontic CBCT imaging (21 MB)",
    },
    "harvard-covid19": {
        "url": None,  # Manual download only — too large for automated hosting
        "filename": None,
        "extract_to": "dicom_samples/harvard_covid19",
        "size_mb": 245_000,
        "desc": "Harvard COVID-19 CT — 1,000 subjects, 491K DICOM instances (~242 GB)",
        "manual_only": True,
        "manual_instructions": (
            "The Harvard COVID-19 CT dataset (242 GB) must be downloaded manually:\n"
            "\n"
            "  1. Visit The Cancer Imaging Archive (TCIA):\n"
            "     https://wiki.cancerimagingarchive.net/pages/viewpage.action?pageId=80969742\n"
            "\n"
            "  2. Download using the NBIA Data Retriever:\n"
            "     - Click 'Download' on the TCIA page\n"
            "     - Install NBIA Data Retriever if prompted\n"
            "     - Set download directory to: dicom_samples/harvard_covid19/\n"
            "\n"
            "  3. After download completes, import into Parthenon:\n"
            "     docker compose exec php php artisan imaging:import-samples \\\n"
            "       --dir=dicom_samples/harvard_covid19\n"
            "\n"
            "  Or re-run: python3 install.py --demo-data\n"
            "  (it will detect the files and import them automatically)"
        ),
    },
}

# ---------------------------------------------------------------------------
# Tier definitions
# ---------------------------------------------------------------------------

TIERS: dict[str, dict[str, Any]] = {
    "minimal": {
        "label": "Minimal",
        "disk_gb": 1,
        "time_est": "~30 minutes",
        "datasets": {
            "eunomia": True,
            "clinvar_papu": True,
            "giab_samples": [],
            "dicom_datasets": [],
        },
        "description": (
            "Eunomia GiBleed CDM (2,694 patients) + ClinVar pathogenic-only subset.\n"
            "Good for quick evaluation and development."
        ),
    },
    "standard": {
        "label": "Standard",
        "disk_gb": 25,
        "time_est": "~2 hours",
        "datasets": {
            "eunomia": True,
            "clinvar_full": True,
            "giab_samples": ["HG001", "HG002"],
            "dicom_datasets": ["class3-malocclusion"],
        },
        "description": (
            "Everything in Minimal, plus:\n"
            "  - 2 GIAB whole-genome VCF samples (~8M variants)\n"
            "  - Full ClinVar database (4.4M variants)\n"
            "  - Class-3 Malocclusion DICOM (orthodontic imaging)\n"
            "Recommended for most users."
        ),
    },
    "full": {
        "label": "Full Mirror",
        "disk_gb": 300,
        "time_est": "~8-12 hours",
        "datasets": {
            "eunomia": True,
            "clinvar_full": True,
            "giab_samples": ["HG001", "HG002", "HG003", "HG004", "HG005", "HG006", "HG007"],
            "dicom_datasets": ["class3-malocclusion", "harvard-covid19"],
        },
        "description": (
            "Complete mirror of parthenon.acumenus.net demo data:\n"
            "  - All 7 GIAB whole-genome VCF samples (~27.5M variants)\n"
            "  - Full ClinVar database (4.4M variants)\n"
            "  - Harvard COVID-19 CT dataset (1,000 studies, 491K DICOM instances)\n"
            "  - Class-3 Malocclusion DICOM\n"
            "Requires ~300 GB free disk space."
        ),
    },
}


# ---------------------------------------------------------------------------
# Download with progress, resume support
# ---------------------------------------------------------------------------

def _download_file(url: str, dest: Path, *, label: str = "") -> bool:
    """Download a file with progress bar and HTTP Range resume support.

    Returns True on success, False on failure (non-fatal).
    """
    display = label or dest.name

    # Check for partial download
    existing_size = 0
    if dest.exists():
        existing_size = dest.stat().st_size

    headers = {}
    if existing_size > 0:
        headers["Range"] = f"bytes={existing_size}-"
        console.print(f"    [dim]Resuming {display} from {existing_size / (1024**2):.1f} MB…[/dim]")

    req = urllib.request.Request(url, headers=headers)

    try:
        resp = urllib.request.urlopen(req, timeout=30)
    except urllib.error.HTTPError as e:
        if e.code == 416:
            # Range not satisfiable — file is already complete
            console.print(f"    [green]Already downloaded:[/green] {display}")
            return True
        console.print(f"    [red]Download failed ({e.code}):[/red] {display}")
        console.print(f"    [dim]{url}[/dim]")
        return False
    except Exception as e:
        console.print(f"    [red]Download failed:[/red] {display} — {e}")
        return False

    # Determine total size
    content_length = resp.headers.get("Content-Length")
    if resp.status == 206:
        # Partial content — total = existing + remaining
        total = existing_size + int(content_length) if content_length else None
        mode = "ab"
    else:
        # Full download (server ignoring Range, or fresh start)
        total = int(content_length) if content_length else None
        mode = "wb"
        existing_size = 0

    dest.parent.mkdir(parents=True, exist_ok=True)

    with Progress(
        "[progress.description]{task.description}",
        BarColumn(),
        DownloadColumn(),
        TransferSpeedColumn(),
        TimeRemainingColumn(),
        console=console,
    ) as progress:
        task = progress.add_task(f"    {display}", total=total, completed=existing_size)

        with open(dest, mode) as f:
            while True:
                chunk = resp.read(1024 * 256)  # 256 KB chunks
                if not chunk:
                    break
                f.write(chunk)
                progress.advance(task, len(chunk))

    return True


def _decompress_gz(gz_path: Path, out_path: Path) -> bool:
    """Decompress a .gz file, showing progress."""
    console.print(f"    [cyan]Decompressing[/cyan] {gz_path.name} → {out_path.name}…")

    if out_path.exists() and out_path.stat().st_size > 0:
        console.print(f"    [green]Already decompressed:[/green] {out_path.name}")
        return True

    try:
        total = gz_path.stat().st_size
        with Progress(
            "[progress.description]{task.description}",
            BarColumn(),
            DownloadColumn(),
            TransferSpeedColumn(),
            console=console,
        ) as progress:
            task = progress.add_task(f"    {gz_path.name}", total=total)

            with gzip.open(gz_path, "rb") as f_in, open(out_path, "wb") as f_out:
                while True:
                    chunk = f_in.read(1024 * 512)  # 512 KB
                    if not chunk:
                        break
                    f_out.write(chunk)
                    # Approximate progress based on compressed read position
                    progress.update(task, completed=f_in.fileobj.tell())  # type: ignore[union-attr]

        return True
    except Exception as e:
        console.print(f"    [red]Decompression failed:[/red] {e}")
        if out_path.exists():
            out_path.unlink()
        return False


def _extract_tarball(tar_path: Path, extract_to: Path) -> bool:
    """Extract a .tar.gz archive."""
    import tarfile

    console.print(f"    [cyan]Extracting[/cyan] {tar_path.name} → {extract_to}/…")

    if extract_to.exists() and any(extract_to.iterdir()):
        console.print(f"    [green]Already extracted:[/green] {extract_to.name}/")
        return True

    try:
        extract_to.mkdir(parents=True, exist_ok=True)
        with tarfile.open(tar_path, "r:gz") as tar:
            tar.extractall(path=extract_to, filter="data")
        return True
    except Exception as e:
        console.print(f"    [red]Extraction failed:[/red] {e}")
        return False


# ---------------------------------------------------------------------------
# Dataset loaders (orchestrate download → artisan import)
# ---------------------------------------------------------------------------

def _load_clinvar(*, papu_only: bool = False) -> bool:
    """Run genomics:sync-clinvar via artisan."""
    subset = "pathogenic-only" if papu_only else "full"
    console.print(f"\n  [bold]ClinVar ({subset})[/bold]")
    console.print(f"    [cyan]Running[/cyan] php artisan genomics:sync-clinvar…")

    cmd = "php artisan genomics:sync-clinvar"
    if papu_only:
        cmd += " --papu-only"

    rc = utils.run_stream(
        ["docker", "compose", "exec", "-T", "php", *cmd.split()]
    )
    if rc == 0:
        console.print(f"    [green]ClinVar {subset} loaded.[/green]")
        return True
    else:
        console.print(f"    [red]ClinVar sync failed.[/red]")
        return False


def _load_giab_samples(sample_ids: list[str]) -> bool:
    """Download GIAB VCF files and import via artisan."""
    if not sample_ids:
        return True

    console.print(f"\n  [bold]GIAB Genomic Samples ({len(sample_ids)} files)[/bold]")

    vcf_dir = utils.REPO_ROOT / "vcf" / "giab_NISTv4.2.1"
    vcf_dir.mkdir(parents=True, exist_ok=True)

    success_count = 0

    for sample_id in sample_ids:
        sample = GIAB_SAMPLES[sample_id]
        gz_path = vcf_dir / sample["filename"]
        vcf_path = vcf_dir / sample["vcf_name"]

        console.print(f"\n    [bold]{sample_id}[/bold] — {sample['desc']}")

        # Step 1: Download .vcf.gz (if VCF doesn't already exist)
        if vcf_path.exists() and vcf_path.stat().st_size > 0:
            console.print(f"    [green]Already on disk:[/green] {vcf_path.name}")
        else:
            if not _download_file(sample["url"], gz_path, label=f"{sample_id}.vcf.gz"):
                continue

            # Step 2: Decompress
            if not _decompress_gz(gz_path, vcf_path):
                continue

            # Clean up .gz to save space
            if gz_path.exists() and vcf_path.exists():
                gz_path.unlink()
                console.print(f"    [dim]Removed {gz_path.name} (keeping decompressed VCF)[/dim]")

        success_count += 1

    if success_count == 0:
        console.print("    [red]No VCF files downloaded successfully.[/red]")
        return False

    # Step 3: Run artisan import on the whole directory
    console.print(f"\n    [cyan]Importing {success_count} VCF file(s) into database…[/cyan]")
    console.print("    [dim]This parses variants and inserts in batches of 500. Large files take time.[/dim]")

    rc = utils.run_stream(
        ["docker", "compose", "exec", "-T", "php",
         "php", "artisan", "genomics:import-vcf",
         "--dir=vcf/giab_NISTv4.2.1",
         "--batch=500"]
    )

    if rc == 0:
        console.print(f"    [green]GIAB genomic import complete ({success_count} samples).[/green]")
        return True
    else:
        console.print("    [red]VCF import had errors (check logs).[/red]")
        return False


def _load_dicom_dataset(dataset_key: str) -> bool:
    """Download and import a DICOM dataset."""
    ds = DICOM_DATASETS[dataset_key]
    console.print(f"\n  [bold]DICOM: {ds['desc']}[/bold]")

    extract_to = utils.REPO_ROOT / ds["extract_to"]

    # Check if already on disk (manual download or previous run)
    if extract_to.exists() and any(extract_to.iterdir()):
        console.print(f"    [green]Already on disk:[/green] {extract_to.relative_to(utils.REPO_ROOT)}/")
    elif ds.get("manual_only"):
        # Manual-download-only dataset — show instructions, skip download
        console.print()
        console.print(
            Panel(
                ds["manual_instructions"],
                title=f"Manual Download Required — {dataset_key}",
                border_style="yellow",
                padding=(1, 2),
            )
        )
        console.print(f"    [yellow]Skipping (manual download required).[/yellow]")
        return True  # Not a failure — user will download later
    else:
        # Automated download
        tar_path = utils.REPO_ROOT / "downloads" / ds["filename"]
        tar_path.parent.mkdir(parents=True, exist_ok=True)

        if not _download_file(ds["url"], tar_path, label=ds["filename"]):
            return False

        # Extract
        if not _extract_tarball(tar_path, extract_to):
            return False

        # Clean up tarball
        if tar_path.exists():
            tar_path.unlink()
            console.print(f"    [dim]Removed {ds['filename']} (keeping extracted files)[/dim]")

    # Import via artisan
    rel_dir = str(extract_to.relative_to(utils.REPO_ROOT))
    console.print(f"    [cyan]Importing DICOM metadata into database…[/cyan]")

    rc = utils.run_stream(
        ["docker", "compose", "exec", "-T", "php",
         "php", "artisan", "imaging:import-samples",
         f"--dir={rel_dir}"]
    )

    if rc == 0:
        console.print(f"    [green]DICOM import complete: {dataset_key}[/green]")
        return True
    else:
        console.print(f"    [red]DICOM import had errors.[/red]")
        return False


# ---------------------------------------------------------------------------
# Tier selection UI
# ---------------------------------------------------------------------------

def select_tier(default: str = "standard") -> str:
    """Interactive tier selection with details panel."""
    import questionary

    console.print()
    table = Table(title="Demo Data Tiers", show_lines=True)
    table.add_column("Tier", style="bold cyan", width=14)
    table.add_column("Disk Space", width=12)
    table.add_column("Time Est.", width=14)
    table.add_column("Contents", width=60)

    for key, tier in TIERS.items():
        marker = " (recommended)" if key == "standard" else ""
        table.add_row(
            f"{tier['label']}{marker}",
            f"~{tier['disk_gb']} GB",
            tier["time_est"],
            tier["description"].split("\n")[0],
        )

    console.print(table)
    console.print()

    choices = [
        questionary.Choice(
            title=f"{t['label']} (~{t['disk_gb']} GB, {t['time_est']})",
            value=key,
        )
        for key, t in TIERS.items()
    ]
    choices.append(questionary.Choice(title="Skip demo data (I'll load my own)", value="skip"))

    selected = questionary.select(
        "Which demo data tier would you like to install?",
        choices=choices,
        default=default,
    ).ask()

    if selected and selected != "skip":
        # Show details
        tier = TIERS[selected]
        console.print()
        console.print(
            Panel(
                tier["description"],
                title=f"{tier['label']} Tier Details",
                border_style="cyan",
                padding=(1, 2),
            )
        )

    return selected or "skip"


def check_disk_space(tier_key: str) -> bool:
    """Verify sufficient disk space for the selected tier."""
    tier = TIERS.get(tier_key)
    if not tier:
        return True

    required_gb = tier["disk_gb"]
    available_gb = utils.free_disk_gb()

    if available_gb < required_gb * 1.1:  # 10% headroom
        console.print(
            f"\n[red]Insufficient disk space.[/red]\n"
            f"  Required: ~{required_gb} GB\n"
            f"  Available: {available_gb:.1f} GB\n"
            f"  Consider choosing a smaller tier or freeing disk space."
        )
        return False

    console.print(f"  [green]Disk space OK:[/green] {available_gb:.1f} GB available (need ~{required_gb} GB)")
    return True


# ---------------------------------------------------------------------------
# Main orchestrator
# ---------------------------------------------------------------------------

def run(tier_key: str) -> None:
    """Execute demo data loading for the selected tier.

    Called after Eunomia (Phase 5) and before Frontend Build (Phase 6).
    Eunomia loading is handled separately by eunomia.py.
    """
    if tier_key == "skip":
        console.rule("[bold]Phase 5b — Demo Data[/bold]")
        console.print("[dim]Skipped (user opted out).[/dim]\n")
        return

    tier = TIERS[tier_key]
    datasets = tier["datasets"]

    console.rule(f"[bold]Phase 5b — Demo Data ({tier['label']} Tier)[/bold]")

    if not check_disk_space(tier_key):
        console.print("[yellow]Continuing without demo data.[/yellow]\n")
        return

    results: dict[str, bool] = {}

    # --- ClinVar ---
    if datasets.get("clinvar_papu"):
        results["ClinVar (pathogenic)"] = _load_clinvar(papu_only=True)
    elif datasets.get("clinvar_full"):
        results["ClinVar (full)"] = _load_clinvar(papu_only=False)

    # --- GIAB Genomics ---
    giab_samples = datasets.get("giab_samples", [])
    if giab_samples:
        results["GIAB Genomics"] = _load_giab_samples(giab_samples)

    # --- DICOM Imaging ---
    dicom_datasets = datasets.get("dicom_datasets", [])
    for ds_key in dicom_datasets:
        results[f"DICOM: {ds_key}"] = _load_dicom_dataset(ds_key)

    # --- Summary ---
    console.print()
    summary_table = Table(title="Demo Data Results")
    summary_table.add_column("Dataset", style="bold")
    summary_table.add_column("Status", width=12)

    for name, success in results.items():
        status = "[green]Loaded[/green]" if success else "[red]Failed[/red]"
        summary_table.add_row(name, status)

    console.print(summary_table)

    failed = [k for k, v in results.items() if not v]
    if failed:
        console.print(
            f"\n[yellow]Some datasets failed to load: {', '.join(failed)}[/yellow]\n"
            "[dim]You can retry later by running: python3 install.py --demo-data[/dim]\n"
        )
    else:
        console.print(f"\n[green]All {tier['label']} tier demo data loaded successfully.[/green]\n")


# ---------------------------------------------------------------------------
# Standalone entry point (re-run demo data without full install)
# ---------------------------------------------------------------------------

def run_standalone() -> None:
    """Run demo data loading independently (post-install)."""
    console.print(
        Panel(
            "[bold cyan]Parthenon — Demo Data Loader[/bold cyan]\n"
            "[dim]Download and import demo datasets[/dim]",
            border_style="cyan",
            padding=(1, 4),
        )
    )

    # Check Docker is running
    if not utils.docker_daemon_running():
        console.print("[red]Docker is not running. Start Docker and try again.[/red]")
        sys.exit(1)

    # Check PHP container is healthy
    health = utils.container_health("parthenon-php")
    if health not in ("healthy", "running"):
        console.print(
            f"[red]PHP container is {health}.[/red]\n"
            "Run [bold]docker compose up -d[/bold] first."
        )
        sys.exit(1)

    tier_key = select_tier()
    run(tier_key)
