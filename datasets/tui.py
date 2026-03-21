"""Interactive TUI for Parthenon Dataset Acquisition.

Provides a Rich + questionary terminal user interface for selecting,
previewing, and loading datasets into a Parthenon installation.
"""
from __future__ import annotations

import sys
from pathlib import Path

import questionary
from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from installer.utils import docker_daemon_running, container_health, free_disk_gb
from datasets.registry import (
    BUNDLES,
    CATEGORIES,
    DATASETS,
    get_added_dependencies,
    resolve_dependencies,
)
from datasets.loader import detect_loaded, print_summary, run_selected

# ---------------------------------------------------------------------------
# Module-level constants
# ---------------------------------------------------------------------------

console = Console()
REPO_ROOT = Path(__file__).parent.parent

# Minimum free disk space (GB) required before we allow loading
_MIN_DISK_GB = 5.0


# ---------------------------------------------------------------------------
# Screen 1: system preflight
# ---------------------------------------------------------------------------

def _check_system() -> bool:
    """Run system preflight checks and display results.

    Returns True if all checks pass, False otherwise.
    """
    console.print(
        Panel(
            "[bold white]Parthenon Dataset Acquisition[/bold white]\n"
            "[dim]Interactive dataset loader — powered by Parthenon[/dim]",
            border_style="cyan",
            expand=False,
        )
    )
    console.print()

    all_ok = True

    # 1. Docker daemon
    daemon_ok = docker_daemon_running()
    if daemon_ok:
        console.print("[green]✓[/green]  Docker daemon        [green]OK[/green]")
    else:
        console.print("[red]✗[/red]  Docker daemon        [red]FAIL[/red] — Docker is not running")
        all_ok = False

    # 2. PHP container
    php_status = container_health("parthenon-php")
    php_ok = php_status in ("healthy", "running")
    if php_ok:
        console.print(f"[green]✓[/green]  parthenon-php        [green]OK[/green] ({php_status})")
    else:
        console.print(
            f"[red]✗[/red]  parthenon-php        [red]FAIL[/red] — status: {php_status}"
        )
        all_ok = False

    # 3. Postgres container
    pg_status = container_health("parthenon-postgres")
    pg_ok = pg_status in ("healthy", "running")
    if pg_ok:
        console.print(f"[green]✓[/green]  parthenon-postgres   [green]OK[/green] ({pg_status})")
    else:
        console.print(
            f"[red]✗[/red]  parthenon-postgres   [red]FAIL[/red] — status: {pg_status}"
        )
        all_ok = False

    # 4. Disk space
    disk_gb = free_disk_gb(REPO_ROOT)
    if disk_gb >= _MIN_DISK_GB:
        console.print(
            f"[green]✓[/green]  Free disk space      [green]OK[/green] "
            f"({disk_gb:.1f} GB available)"
        )
    else:
        console.print(
            f"[red]✗[/red]  Free disk space      [red]FAIL[/red] — "
            f"only {disk_gb:.1f} GB available (need ≥{_MIN_DISK_GB:.0f} GB)"
        )
        all_ok = False

    console.print()

    if not all_ok:
        console.print(
            "[bold red]One or more preflight checks failed. "
            "Please resolve the issues above and try again.[/bold red]"
        )
        return False

    # Detect already-loaded datasets
    console.print("[dim]Detecting already-loaded datasets…[/dim]")
    loaded_map = detect_loaded(console)
    loaded_keys = [k for k, v in loaded_map.items() if v]

    if loaded_keys:
        console.print("[bold]Already loaded:[/bold]")
        for key in loaded_keys:
            ds = DATASETS.get(key)
            name = ds.name if ds else key
            console.print(f"  [green]✓[/green]  {name}")
    else:
        console.print("[dim]No datasets loaded yet.[/dim]")

    console.print()
    return True


# ---------------------------------------------------------------------------
# Screen 2: mode selection
# ---------------------------------------------------------------------------

def _choose_mode() -> str | None:
    """Ask the user how they want to select datasets.

    Returns one of "bundle", "alacarte", "exit", or None on Ctrl-C.
    """
    choice = questionary.select(
        "How would you like to choose datasets?",
        choices=[
            questionary.Choice("Start with a recommended bundle", value="bundle"),
            questionary.Choice("Pick individual datasets (a la carte)", value="alacarte"),
            questionary.Choice("Exit", value="exit"),
        ],
    ).ask()
    return choice  # None if Ctrl-C


# ---------------------------------------------------------------------------
# Bundle picker
# ---------------------------------------------------------------------------

def _choose_bundle() -> list[str] | None:
    """Display bundle table and let the user pick one.

    Returns the bundle's dataset_keys list, or None if the user chose Back.
    """
    table = Table(
        title="Recommended Bundles",
        show_header=True,
        header_style="bold magenta",
        expand=True,
    )
    table.add_column("Bundle", style="bold", no_wrap=True)
    table.add_column("Description")

    for bundle in BUNDLES:
        table.add_row(bundle.name, bundle.description)

    console.print(table)
    console.print()

    choices = [
        questionary.Choice(f"{b.name}", value=b.key) for b in BUNDLES
    ] + [questionary.Choice("← Back", value="__back__")]

    picked = questionary.select(
        "Select a bundle:",
        choices=choices,
    ).ask()

    if picked is None or picked == "__back__":
        return None

    # Find the bundle and return its dataset keys
    for bundle in BUNDLES:
        if bundle.key == picked:
            return list(bundle.dataset_keys)

    return None


# ---------------------------------------------------------------------------
# Screen 3: a la carte dataset picker
# ---------------------------------------------------------------------------

def _pick_datasets(preselected: list[str] | None = None) -> list[str] | None:
    """Render a grouped checkbox list for dataset selection.

    Args:
        preselected: Dataset keys to pre-check (e.g. from a bundle). These
                     are only pre-checked if the dataset is not already loaded
                     and is available (phase == 1).

    Returns:
        The list of chosen dataset keys, or None if the user cancelled.
    """
    # Build loaded map once
    loaded_map = detect_loaded(console)
    preselected_set = set(preselected or [])

    # Build category lookup: cat_key -> [(key, Dataset), ...]
    cat_lookup: dict[str, list[tuple[str, object]]] = {
        cat_key: [] for cat_key, _ in CATEGORIES
    }
    for key, ds in DATASETS.items():
        if ds.category in cat_lookup:
            cat_lookup[ds.category].append((key, ds))

    choices: list = []

    for cat_key, cat_label in CATEGORIES:
        datasets_in_cat = cat_lookup.get(cat_key, [])
        if not datasets_in_cat:
            continue

        choices.append(questionary.Separator(f"── {cat_label} ──"))

        for key, ds in datasets_in_cat:
            already_loaded = loaded_map.get(key, False)
            coming_soon = ds.phase > 1
            needs_manual = not ds.auto_downloadable

            # Build display label
            label = f"{ds.name}  [{ds.size_estimate}]"
            if needs_manual:
                label += "  [manual download]"

            if already_loaded:
                choices.append(
                    questionary.Choice(
                        title=label,
                        value=key,
                        disabled="already loaded",
                    )
                )
            elif coming_soon:
                choices.append(
                    questionary.Choice(
                        title=label,
                        value=key,
                        disabled="coming soon",
                    )
                )
            else:
                checked = key in preselected_set
                choices.append(
                    questionary.Choice(
                        title=label,
                        value=key,
                        checked=checked,
                    )
                )

    selected = questionary.checkbox(
        "Select datasets to load (space to toggle, enter to confirm):",
        choices=choices,
    ).ask()

    if selected is None:
        return None

    if not selected:
        return []

    # Show auto-added dependencies
    added_deps = get_added_dependencies(selected)
    if added_deps:
        console.print()
        console.print("[bold yellow]The following dependencies will be added automatically:[/bold yellow]")
        for dep_key in added_deps:
            dep_ds = DATASETS.get(dep_key)
            dep_name = dep_ds.name if dep_ds else dep_key
            console.print(f"  [dim]+[/dim] {dep_name}")

    return selected + added_deps


# ---------------------------------------------------------------------------
# Screen 4: confirm and run
# ---------------------------------------------------------------------------

def _confirm_and_run(selected_keys: list[str]) -> None:
    """Show final confirmation (ordered list + disk tally) then run the loader."""
    ordered = resolve_dependencies(selected_keys)

    console.print()
    console.print("[bold]Datasets to load (in order):[/bold]")

    total_download_mb = 0
    total_loaded_mb = 0

    for i, key in enumerate(ordered, start=1):
        ds = DATASETS.get(key)
        if ds:
            name = ds.name
            total_download_mb += ds.size_download_mb
            total_loaded_mb += ds.size_loaded_mb
        else:
            name = key
        console.print(f"  {i}. {name}")

    total_download_gb = total_download_mb / 1024
    total_loaded_gb = total_loaded_mb / 1024

    console.print()
    console.print(
        f"[bold]Estimated disk usage:[/bold] "
        f"{total_download_gb:.1f} GB download  →  "
        f"{total_loaded_gb:.1f} GB loaded"
    )
    console.print()

    confirmed = questionary.confirm(
        f"Load {len(ordered)} dataset(s) now?",
        default=True,
    ).ask()

    if not confirmed:
        console.print("[yellow]Aborted — no datasets were loaded.[/yellow]")
        return

    results = run_selected(ordered, console=console)
    print_summary(results, console=console)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    """Main entry point for the Dataset Acquisition TUI."""
    # Screen 1: preflight
    if not _check_system():
        sys.exit(1)

    preselected: list[str] | None = None

    # Screen 2: mode selection
    mode = _choose_mode()
    if mode is None or mode == "exit":
        console.print("[dim]Goodbye.[/dim]")
        return

    # Bundle flow
    if mode == "bundle":
        bundle_keys = _choose_bundle()
        if bundle_keys is not None:
            preselected = bundle_keys
        # If user hit Back, fall through to a la carte with no preselection

    # Screen 3: dataset picker
    selected = _pick_datasets(preselected)

    if selected is None:
        console.print("[dim]Cancelled.[/dim]")
        return

    if not selected:
        console.print("[yellow]No datasets selected — nothing to do.[/yellow]")
        return

    # Screen 4: confirm and run
    _confirm_and_run(selected)
