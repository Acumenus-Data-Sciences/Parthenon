"""Loader for the Eunomia GiBleed demo dataset."""
from __future__ import annotations

from pathlib import Path

from rich.console import Console

from datasets.loaders import _exec_php, _query_count


def is_loaded() -> bool:
    """Return True if the eunomia.person table contains at least one row."""
    return _query_count("SELECT COUNT(*) FROM eunomia.person") > 0


def load(*, console: Console, downloads_dir: Path) -> bool:
    """Load Eunomia GiBleed via the parthenon:load-eunomia artisan command.

    Streams output in real time.  Returns True on success.
    """
    console.print("[bold cyan]Loading Eunomia GiBleed dataset…[/bold cyan]")
    rc = _exec_php(
        "php artisan parthenon:load-eunomia --fresh --no-interaction",
        stream=True,
    )
    if rc == 0:
        console.print("[green]✓[/green] Eunomia GiBleed loaded successfully.")
        return True
    console.print(f"[red]✗ Eunomia load failed (exit code {rc}).[/red]")
    return False
