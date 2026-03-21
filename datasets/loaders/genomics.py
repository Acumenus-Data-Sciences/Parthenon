"""Loader for genomics datasets: ClinVar and GIAB reference samples."""
from __future__ import annotations

from pathlib import Path
from typing import Dict, Tuple

from rich.console import Console

from datasets.loaders import REPO_ROOT, _exec_php, _query_count
from datasets.downloads import download_file, decompress_gz

# ---------------------------------------------------------------------------
# NCBI FTP base URL
# ---------------------------------------------------------------------------

_NCBI_BASE = "https://ftp-trace.ncbi.nlm.nih.gov/giab/ftp/release"

# Mapping: dataset key suffix -> (url, gz_filename, vcf_filename)
# Each tuple: full URL to .vcf.gz, the .gz filename to save, the decompressed .vcf filename
_GIAB_URLS: Dict[str, Tuple[str, str, str]] = {
    "hg001": (
        f"{_NCBI_BASE}/NA12878_HG001/NISTv4.2.1/GRCh38/"
        "HG001_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG001_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG001_GRCh38_1_22_v4.2.1_benchmark.vcf",
    ),
    "hg002": (
        f"{_NCBI_BASE}/AshkenazimTrio/HG002_NA24385_son/NISTv4.2.1/GRCh38/"
        "HG002_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG002_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG002_GRCh38_1_22_v4.2.1_benchmark.vcf",
    ),
    "hg003": (
        f"{_NCBI_BASE}/AshkenazimTrio/HG003_NA24149_father/NISTv4.2.1/GRCh38/"
        "HG003_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG003_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG003_GRCh38_1_22_v4.2.1_benchmark.vcf",
    ),
    "hg004": (
        f"{_NCBI_BASE}/AshkenazimTrio/HG004_NA24143_mother/NISTv4.2.1/GRCh38/"
        "HG004_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG004_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG004_GRCh38_1_22_v4.2.1_benchmark.vcf",
    ),
    "hg005": (
        f"{_NCBI_BASE}/ChineseTrio/HG005_NA24631_son/NISTv4.2.1/GRCh38/"
        "HG005_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG005_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG005_GRCh38_1_22_v4.2.1_benchmark.vcf",
    ),
    "hg006": (
        f"{_NCBI_BASE}/ChineseTrio/HG006_NA24694_father/NISTv4.2.1/GRCh38/"
        "HG006_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG006_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG006_GRCh38_1_22_v4.2.1_benchmark.vcf",
    ),
    "hg007": (
        f"{_NCBI_BASE}/ChineseTrio/HG007_NA24695_mother/NISTv4.2.1/GRCh38/"
        "HG007_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG007_GRCh38_1_22_v4.2.1_benchmark.vcf.gz",
        "HG007_GRCh38_1_22_v4.2.1_benchmark.vcf",
    ),
}

# GIAB sample IDs (HG001-HG007) keyed by suffix
_GIAB_SAMPLE_IDS: Dict[str, str] = {
    f"hg{n:03d}": f"HG{n:03d}" for n in range(1, 8)
}


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def is_loaded(dataset_key: str = "clinvar") -> bool:
    """Return True if *dataset_key* is already present in the database."""
    if dataset_key == "clinvar":
        return _query_count("SELECT COUNT(*) FROM app.clinvar_variants") > 0

    # giab-hg001 … giab-hg007
    if dataset_key.startswith("giab-"):
        suffix = dataset_key[len("giab-"):]
        sample_id = _GIAB_SAMPLE_IDS.get(suffix)
        if sample_id is None:
            return False
        return (
            _query_count(
                f"SELECT COUNT(*) FROM app.genomic_uploads "
                f"WHERE sample_name = '{sample_id}'"
            )
            > 0
        )

    return False


def load(
    dataset_key: str = "clinvar",
    *,
    console: Console,
    downloads_dir: Path,
) -> bool:
    """Load the genomics dataset identified by *dataset_key*.

    Supported keys: ``clinvar``, ``giab-hg001`` … ``giab-hg007``.
    Returns True on success, False on failure.
    """
    if dataset_key == "clinvar":
        return _load_clinvar(console=console)

    if dataset_key.startswith("giab-"):
        suffix = dataset_key[len("giab-"):]
        return _load_giab(suffix, console=console, downloads_dir=downloads_dir)

    console.print(f"[red]Unknown genomics dataset key: {dataset_key!r}[/red]")
    return False


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _load_clinvar(*, console: Console) -> bool:
    console.print("[bold cyan]Syncing ClinVar variants…[/bold cyan]")
    rc = _exec_php("php artisan genomics:sync-clinvar --no-interaction", stream=True)
    if rc == 0:
        console.print("[green]✓[/green] ClinVar sync complete.")
        return True
    console.print(f"[red]✗ ClinVar sync failed (exit code {rc}).[/red]")
    return False


def _load_giab(
    suffix: str,
    *,
    console: Console,
    downloads_dir: Path,
) -> bool:
    if suffix not in _GIAB_URLS:
        console.print(f"[red]Unknown GIAB sample: {suffix!r}[/red]")
        return False

    url, gz_filename, vcf_filename = _GIAB_URLS[suffix]
    vcf_dir = REPO_ROOT / "vcf" / "giab_NISTv4.2.1"
    vcf_dir.mkdir(parents=True, exist_ok=True)

    gz_path = vcf_dir / gz_filename
    vcf_path = vcf_dir / vcf_filename

    # Download .vcf.gz
    console.print(f"[cyan]Downloading {gz_filename}…[/cyan]")
    if not download_file(url, gz_path, label=gz_filename, console=console):
        return False

    # Decompress
    console.print(f"[cyan]Decompressing {gz_filename}…[/cyan]")
    if not decompress_gz(gz_path, vcf_path, console=console):
        return False

    # Remove .gz to save space
    try:
        gz_path.unlink(missing_ok=True)
        console.print(f"[dim]Removed {gz_filename} to save disk space.[/dim]")
    except OSError:
        pass

    # Import via artisan
    console.print(
        f"[bold cyan]Importing GIAB {suffix.upper()} VCF…[/bold cyan]"
    )
    rc = _exec_php(
        "php artisan genomics:import-vcf "
        "--dir=vcf/giab_NISTv4.2.1 --batch=500 --no-interaction",
        stream=True,
    )
    if rc == 0:
        console.print(
            f"[green]✓[/green] GIAB {suffix.upper()} imported successfully."
        )
        return True
    console.print(f"[red]✗ GIAB import failed (exit code {rc}).[/red]")
    return False
