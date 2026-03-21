"""Loader for imaging datasets: CBCT malocclusion and COVID-19 CT."""
from __future__ import annotations

from pathlib import Path

from rich.console import Console
from rich.panel import Panel

from datasets.loaders import REPO_ROOT, _exec_php, _query_count
from datasets.downloads import download_file, extract_tarball

_MALOCCLUSION_URL = (
    "https://github.com/sudoshi/parthenon-demo-data/releases/download/v1.0/"
    "class3-malocclusion.tar.gz"
)


def is_loaded(dataset_key: str = "dicom-malocclusion") -> bool:
    """Return True if *dataset_key* imaging data is already in the database."""
    if dataset_key == "dicom-malocclusion":
        return _query_count("SELECT COUNT(*) FROM app.imaging_studies") > 0

    if dataset_key == "dicom-covid19":
        return _query_count("SELECT COUNT(*) FROM app.imaging_studies") > 100

    return False


def load(
    dataset_key: str,
    *,
    console: Console,
    downloads_dir: Path,
) -> bool:
    """Load the imaging dataset identified by *dataset_key*.

    Returns True on success (or when the user must complete a manual step),
    False on failure.
    """
    if dataset_key == "dicom-covid19":
        return _show_covid19_instructions(console=console)

    if dataset_key == "dicom-malocclusion":
        return _load_malocclusion(console=console, downloads_dir=downloads_dir)

    console.print(f"[red]Unknown imaging dataset key: {dataset_key!r}[/red]")
    return False


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _show_covid19_instructions(*, console: Console) -> bool:
    """Display manual download instructions for the Harvard COVID-19 dataset."""
    instructions = (
        "The Harvard COVID-19 CT dataset (~242 GB) requires manual download "
        "due to registration and terms-of-use requirements.\n\n"
        "[bold]Steps:[/bold]\n"
        "1. Visit [link]https://dataverse.harvard.edu/dataset.xhtml"
        "?persistentId=doi:10.7910/DVN/6ACUZJ[/link]\n"
        "2. Create a free Harvard Dataverse account and accept the terms.\n"
        "3. Download all files into [cyan]dicom_samples/covid19/[/cyan] "
        "inside the Parthenon repository.\n"
        "4. Re-run this tool and select [bold]dicom-covid19[/bold] again — "
        "it will detect the files and begin ingestion automatically.\n\n"
        "[dim]This dataset is not required for a functional Parthenon "
        "installation.[/dim]"
    )
    console.print(
        Panel(
            instructions,
            title="[bold yellow]Manual Download Required — Harvard COVID-19 CT[/bold yellow]",
            border_style="yellow",
            expand=False,
        )
    )
    # Returning True because this is not a failure — it's a user action item.
    return True


def _load_malocclusion(*, console: Console, downloads_dir: Path) -> bool:
    """Download and import the Class-3 Malocclusion CBCT dataset."""
    tar_path = downloads_dir / "class3-malocclusion.tar.gz"
    extract_to = REPO_ROOT / "dicom_samples" / "Class-3-malocclusion"

    # Download tarball
    console.print("[cyan]Downloading Class-3 Malocclusion CBCT archive…[/cyan]")
    if not download_file(
        _MALOCCLUSION_URL,
        tar_path,
        label="class3-malocclusion.tar.gz",
        console=console,
    ):
        return False

    # Extract
    console.print("[cyan]Extracting CBCT archive…[/cyan]")
    if not extract_tarball(tar_path, extract_to, console=console):
        return False

    # Import via artisan
    console.print(
        "[bold cyan]Importing Class-3 Malocclusion DICOM samples…[/bold cyan]"
    )
    rc = _exec_php(
        "php artisan imaging:import-samples "
        "--dir=dicom_samples/Class-3-malocclusion --no-interaction",
        stream=True,
    )
    if rc == 0:
        console.print(
            "[green]✓[/green] Class-3 Malocclusion dataset imported successfully."
        )
        return True
    console.print(f"[red]✗ Imaging import failed (exit code {rc}).[/red]")
    return False
