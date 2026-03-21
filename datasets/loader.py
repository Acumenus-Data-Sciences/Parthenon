"""Orchestrator for Parthenon Dataset Acquisition TUI.

Provides:
    detect_loaded   — check which datasets are already present in the DB
    run_selected    — load a list of datasets in dependency order
    print_summary   — Rich table with load results
    run_from_installer — entry point called by install.py
"""
from __future__ import annotations

import importlib
import inspect
import traceback
from pathlib import Path
from typing import Any

from rich.console import Console
from rich.rule import Rule
from rich.table import Table

from datasets.registry import DATASETS, resolve_dependencies

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REPO_ROOT = Path(__file__).parent.parent
DOWNLOADS_DIR = REPO_ROOT / "downloads"


# ---------------------------------------------------------------------------
# detect_loaded
# ---------------------------------------------------------------------------

def detect_loaded(console: Console) -> dict[str, bool]:
    """Return a mapping of dataset key -> bool indicating load status.

    Phase > 1 datasets are unconditionally marked False (not yet supported).
    Any error during the check is caught and defaults to False.
    """
    results: dict[str, bool] = {}

    for key, ds in DATASETS.items():
        if ds.phase > 1:
            results[key] = False
            continue

        try:
            mod = importlib.import_module(ds.loader)
            sig = inspect.signature(mod.is_loaded)
            if "dataset_key" in sig.parameters:
                loaded = mod.is_loaded(dataset_key=key)
            else:
                loaded = mod.is_loaded()
            results[key] = bool(loaded)
        except Exception:
            results[key] = False

    return results


# ---------------------------------------------------------------------------
# run_selected
# ---------------------------------------------------------------------------

def run_selected(
    selected_keys: list[str],
    *,
    console: Console,
) -> dict[str, bool]:
    """Load the datasets in *selected_keys* (plus their dependencies) in
    topological order.

    Returns a mapping of dataset key -> success boolean for every dataset
    that was actually attempted (phase-1 only).
    """
    DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)

    ordered: list[str] = resolve_dependencies(selected_keys)
    results: dict[str, bool] = {}

    for key in ordered:
        ds = DATASETS[key]

        console.print(Rule(f"[bold]{ds.name}[/bold]", style="cyan"))

        # Phase gate
        if ds.phase > 1:
            console.print(
                f"[yellow]Skipping {ds.name} — phase {ds.phase} (coming soon).[/yellow]"
            )
            results[key] = False
            continue

        # Already-loaded check
        try:
            mod = importlib.import_module(ds.loader)
            sig = inspect.signature(mod.is_loaded)
            if "dataset_key" in sig.parameters:
                already = mod.is_loaded(dataset_key=key)
            else:
                already = mod.is_loaded()
        except Exception:
            already = False

        if already:
            console.print(
                f"[green]✓[/green] {ds.name} is already loaded — skipping."
            )
            results[key] = True
            continue

        # Run the loader
        try:
            load_sig = inspect.signature(mod.load)
            kwargs: dict[str, Any] = {
                "console": console,
                "downloads_dir": DOWNLOADS_DIR,
            }
            if "dataset_key" in load_sig.parameters:
                kwargs["dataset_key"] = key

            success = bool(mod.load(**kwargs))
        except Exception as exc:
            console.print(f"[red]Error loading {ds.name}: {exc}[/red]")
            console.print(traceback.format_exc(), markup=False)
            success = False

        results[key] = success

        if success:
            console.print(f"[green]✓ {ds.name} done.[/green]")
        else:
            console.print(f"[red]✗ {ds.name} failed.[/red]")

    return results


# ---------------------------------------------------------------------------
# print_summary
# ---------------------------------------------------------------------------

def print_summary(results: dict[str, bool], *, console: Console) -> None:
    """Print a Rich table summarising the load results.

    Columns: Dataset, Status, Retry Command
    """
    table = Table(
        title="Dataset Load Summary",
        show_header=True,
        header_style="bold magenta",
        expand=True,
    )
    table.add_column("Dataset", style="bold", no_wrap=True)
    table.add_column("Status", justify="center", no_wrap=True)
    table.add_column("Retry Command", style="dim")

    failures = 0

    for key, success in results.items():
        ds = DATASETS.get(key)
        name = ds.name if ds else key

        if success:
            status = "[green]Loaded[/green]"
            retry = ""
        else:
            status = "[red]Failed[/red]"
            failures += 1
            if ds is not None and ds.phase > 1:
                retry = "Coming soon"
            else:
                retry = f"python3 -m datasets --only {key}"

        table.add_row(name, status, retry)

    console.print(table)

    if failures == 0:
        console.print(
            f"[bold green]All {len(results)} dataset(s) loaded successfully.[/bold green]"
        )
    else:
        console.print(
            f"[bold red]{failures} dataset(s) failed. "
            f"Use the retry commands above to re-run individually.[/bold red]"
        )


# ---------------------------------------------------------------------------
# run_from_installer
# ---------------------------------------------------------------------------

def run_from_installer(cfg: dict[str, Any]) -> None:
    """Entry point called by install.py during automated or interactive setup.

    If ``cfg["datasets"]`` is a list of dataset keys, run them non-interactively.
    Otherwise launch the interactive TUI.
    """
    console = Console()

    datasets_cfg = cfg.get("datasets")

    if isinstance(datasets_cfg, list):
        # Non-interactive: load the specified keys
        results = run_selected(datasets_cfg, console=console)
        print_summary(results, console=console)
    else:
        # Interactive TUI
        from datasets.tui import main  # noqa: PLC0415 — deferred import
        main()
