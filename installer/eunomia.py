"""Phase 5 — Eunomia GiBleed demo data.

Uses the Laravel `parthenon:load-eunomia` artisan command which downloads the
GiBleed CDM v5.3 dataset from GitHub OHDSI, creates eunomia/eunomia_results
schemas, loads CSV data via COPY, runs mini-Achilles characterization, and
registers the source in the app database.
"""
from __future__ import annotations

import sys

from rich.console import Console

from . import utils

console = Console()


def run() -> None:
    """Phase 5: load Eunomia demo data via artisan command."""
    console.rule("[bold]Phase 5 — Eunomia Demo Data[/bold]")

    console.print(
        "  [cyan]▶[/cyan] Loading Eunomia GiBleed dataset (~2,694 patients)…\n"
        "    Downloads from GitHub OHDSI, creates schemas, loads CDM tables,\n"
        "    runs mini-Achilles characterization, and registers the data source.\n"
    )

    # The artisan command handles everything:
    # 1. Downloads GiBleed ZIP from GitHub
    # 2. Creates eunomia + eunomia_results schemas
    # 3. Loads CDM tables via PostgreSQL COPY
    # 4. Runs 20 mini-Achilles analyses
    # 5. Registers the Eunomia source + daimons
    rc = utils.run_stream([
        "docker", "compose", "exec", "-T", "php",
        "php", "artisan", "parthenon:load-eunomia", "--fresh", "--no-interaction",
    ])

    if rc != 0:
        console.print(
            "\n[yellow]⚠ Eunomia loading failed.[/yellow]\n"
            "  You can retry later:\n"
            "    docker compose exec php php artisan parthenon:load-eunomia --fresh\n"
        )
        # Non-fatal — don't exit, continue installation
        return

    console.print("[green]✓ Eunomia GiBleed demo data loaded and characterized.[/green]\n")
