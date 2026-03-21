"""Entry point: python3 -m datasets"""
from __future__ import annotations

import argparse
import sys

from rich.console import Console


def cli() -> None:
    parser = argparse.ArgumentParser(
        description="Parthenon Dataset Acquisition — browse and load public OHDSI datasets",
    )
    parser.add_argument(
        "--only",
        nargs="+",
        metavar="KEY",
        help="Load specific datasets by key (non-interactive)",
    )
    parser.add_argument(
        "--list",
        action="store_true",
        help="List all available datasets and exit",
    )
    args = parser.parse_args()

    if args.list:
        from datasets.registry import DATASETS, CATEGORIES

        console = Console()
        for cat_key, cat_label in CATEGORIES:
            console.print(f"\n[bold]{cat_label}[/bold]")
            for ds in DATASETS.values():
                if ds.category == cat_key:
                    phase_tag = " [dim](coming soon)[/dim]" if ds.phase > 1 else ""
                    console.print(f"  {ds.key:25s} {ds.size_estimate:30s}{phase_tag}")
        return

    if args.only:
        from datasets.loader import run_selected, print_summary

        console = Console()
        results = run_selected(args.only, console=console)
        print_summary(results, console=console)
        sys.exit(0 if all(results.values()) else 1)

    # Default: interactive TUI
    from datasets.tui import main

    main()


if __name__ == "__main__":
    cli()
