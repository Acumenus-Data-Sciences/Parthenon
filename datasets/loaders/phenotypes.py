"""Loader for the OHDSI Phenotype Library."""
from __future__ import annotations

from pathlib import Path

from rich.console import Console

from datasets.loaders import _exec_php, _query_count


def is_loaded() -> bool:
    """Return True if app.phenotype_library contains at least one row."""
    return _query_count("SELECT COUNT(*) FROM app.phenotype_library") > 0


def load(*, console: Console, downloads_dir: Path) -> bool:
    """Sync the OHDSI Phenotype Library via the phenotype:sync artisan command.

    Streams output in real time.  Returns True on success.
    """
    console.print(
        "[bold cyan]Syncing OHDSI Phenotype Library…[/bold cyan]"
    )
    rc = _exec_php(
        "php artisan phenotype:sync --no-interaction",
        stream=True,
    )
    if rc == 0:
        console.print(
            "[green]✓[/green] Phenotype Library synced successfully."
        )
        return True
    console.print(
        f"[red]✗ Phenotype Library sync failed (exit code {rc}).[/red]"
    )
    return False
