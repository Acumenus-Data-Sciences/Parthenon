"""Phase 5 — Eunomia GiBleed demo data.

Restores docker/fixtures/eunomia.pgdump into the `eunomia` schema of the
Docker PostgreSQL container, then registers the source in the app database.
"""
from __future__ import annotations

import sys
from pathlib import Path

from rich.console import Console

from . import utils

console = Console()

FIXTURE_PATH = utils.REPO_ROOT / "docker" / "fixtures" / "eunomia.pgdump"
CONTAINER_PATH = "/fixtures/eunomia.pgdump"


def _check_fixture() -> bool:
    """Return True if the pgdump file exists; warn and return False otherwise."""
    if FIXTURE_PATH.exists():
        return True
    console.print(
        f"\n[yellow]⚠ Eunomia fixture not found at {FIXTURE_PATH.relative_to(utils.REPO_ROOT)}[/yellow]\n"
        "  To generate it:\n"
        "  Option A — From R:\n"
        "    Rscript -e \"install.packages('Eunomia', repos='https://OHDSI.github.io/drat')\"\n"
        "    # load CSVs into a local postgres eunomia schema, then:\n"
        "    pg_dump -U postgres -d mydb --schema=eunomia -Fc -f docker/fixtures/eunomia.pgdump\n"
        "\n"
        "  Option B — Download from CDMConnector releases:\n"
        "    https://github.com/darwin-eu/CDMConnector/releases\n"
        "\n"
        "  [dim]Skipping Eunomia data load.[/dim]"
    )
    return False


def restore_pgdump() -> None:
    """Restore the eunomia.pgdump into the postgres container."""
    console.print("  [cyan]▶[/cyan] Restoring Eunomia pg_dump…", end=" ", flush=True)

    result = utils.run(
        [
            "docker", "compose", "exec", "-T", "postgres",
            "pg_restore",
            "-U", "parthenon",
            "-d", "parthenon",
            "--schema=eunomia",
            "--no-owner",
            "--role=parthenon",
            "--exit-on-error",
            CONTAINER_PATH,
        ],
        check=False,
        cwd=utils.REPO_ROOT,
    )

    if result.returncode == 0:
        console.print("[green]done[/green]")
    else:
        # pg_restore often exits 1 with warnings — check stderr for real errors
        stderr = (result.stderr or "").strip()
        if "error" in stderr.lower():
            console.print("[red]FAILED[/red]")
            console.print(stderr)
            sys.exit(1)
        else:
            console.print("[green]done[/green] [dim](with warnings)[/dim]")


def seed_source() -> None:
    """Register the Eunomia source in the app database."""
    console.print("  [cyan]▶[/cyan] Registering Eunomia source in app database…", end=" ", flush=True)

    result = utils.exec_php("php artisan eunomia:seed-source", check=False)
    if result.returncode == 0:
        console.print("[green]done[/green]")
    else:
        console.print("[red]FAILED[/red]")
        if result.stdout:
            console.print(result.stdout)
        if result.stderr:
            console.print(result.stderr)
        sys.exit(1)


def run() -> None:
    """Phase 5: load Eunomia demo data (skipped if fixture missing)."""
    console.rule("[bold]Phase 5 — Eunomia Demo Data[/bold]")

    if not _check_fixture():
        console.print("[dim]Skipping Eunomia phase.[/dim]\n")
        return

    restore_pgdump()
    seed_source()
    console.print("[green]✓ Eunomia GiBleed demo data loaded.[/green]\n")
