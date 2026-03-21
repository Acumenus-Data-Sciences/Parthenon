"""Loader for GIS / Geospatial datasets (US Census TIGER/Line boundaries)."""
from __future__ import annotations

import os
import subprocess
from pathlib import Path

from rich.console import Console

from datasets.loaders import REPO_ROOT, _query_count

_LOAD_ALL_SCRIPT = REPO_ROOT / "scripts" / "gis" / "load_all.py"

_GIS_DSN = (
    "host=localhost port=5480 dbname=parthenon user=parthenon "
    "password=secret options='-c search_path=gis,public,app,topology'"
)


def is_loaded() -> bool:
    """Return True if app.gis_admin_boundaries contains at least one row."""
    return _query_count("SELECT COUNT(*) FROM app.gis_admin_boundaries") > 0


def load(*, console: Console, downloads_dir: Path) -> bool:
    """Load US Census TIGER/Line boundary data via scripts/gis/load_all.py.

    Runs on the HOST (not inside a container) because geopandas is a host
    Python dependency.  Streams output in real time.

    Returns True on success, False on failure.
    """
    # ------------------------------------------------------------------
    # Verify geopandas is available on the host
    # ------------------------------------------------------------------
    gp_check = subprocess.run(
        ["python3", "-c", "import geopandas"],
        capture_output=True,
    )
    if gp_check.returncode != 0:
        console.print(
            "[red]geopandas is not installed on the host.[/red]\n"
            "Install it with:\n\n"
            "  [bold]pip install geopandas[/bold]\n\n"
            "or, for a full geo stack:\n\n"
            "  [bold]pip install geopandas fiona shapely pyproj[/bold]\n\n"
            "Then re-run the dataset installer."
        )
        return False

    if not _LOAD_ALL_SCRIPT.is_file():
        console.print(
            f"[red]GIS load script not found: {_LOAD_ALL_SCRIPT}[/red]"
        )
        return False

    # ------------------------------------------------------------------
    # Run load_all.py on the host with the GIS DSN override
    # ------------------------------------------------------------------
    console.print(
        "[bold cyan]Loading US Census TIGER/Line boundaries…[/bold cyan]"
    )

    env = os.environ.copy()
    env["DB_DSN"] = _GIS_DSN

    proc = subprocess.Popen(
        ["python3", str(_LOAD_ALL_SCRIPT)],
        cwd=str(REPO_ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        env=env,
    )

    if proc.stdout:
        for line in proc.stdout:
            print(line, end="", flush=True)

    proc.wait()

    if proc.returncode == 0:
        console.print("[green]✓[/green] GIS boundaries loaded successfully.")
        return True
    console.print(
        f"[red]✗ GIS load failed (exit code {proc.returncode}).[/red]"
    )
    return False
