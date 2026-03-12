"""Phase 3 — Docker setup: pull, build, start, and healthcheck polling."""
from __future__ import annotations

import sys
import time
from typing import Any

from rich.console import Console
from rich.live import Live
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TimeElapsedColumn
from rich.table import Table

from . import utils

console = Console()

# Services and their expected health status source
# (name_in_compose, container_name, timeout_seconds)
BASE_SERVICES = [
    ("postgres",   "parthenon-postgres", 60),
    ("redis",      "parthenon-redis",    30),
    ("php",        "parthenon-php",      120),
    ("python-ai",  "parthenon-ai",       120),
    ("r-runtime",  "parthenon-r",        120),
    ("nginx",      "parthenon-nginx",    30),
    ("horizon",    "parthenon-horizon",  30),
]

SOLR_SERVICE = ("solr", "parthenon-solr", 60)
CHROMADB_SERVICE = ("chromadb", "parthenon-chromadb", 60)

# Optional sidecar services
OPTIONAL_SERVICES = {
    "study_agent":  ("study-agent",  "parthenon-study-agent",  120),
    "qdrant":       ("qdrant",       "parthenon-qdrant",       60),
    "hecate":       ("hecate",       "parthenon-hecate",       60),
    "whiterabbit":  ("whiterabbit",  "parthenon-whiterabbit",  60),
    "fhir_to_cdm":  ("fhir-to-cdm", "parthenon-fhir-to-cdm",  60),
    "orthanc":      ("orthanc",      "parthenon-orthanc",      60),
}

# Default for backward compat (used when run() called without config)
SERVICES = BASE_SERVICES


def pull() -> None:
    """docker compose pull — stream progress."""
    console.print("[cyan][1/3] Pulling Docker images…[/cyan]")
    rc = utils.run_stream(["docker", "compose", "pull"])
    if rc != 0:
        console.print("[yellow]⚠ Some images failed to pull — continuing with local images.[/yellow]")


def build() -> None:
    """docker compose build — stream progress."""
    console.print("[cyan][2/3] Building Docker images…[/cyan]")
    rc = utils.run_stream(["docker", "compose", "build"])
    if rc != 0:
        console.print("[red]✗ Build failed.[/red]")
        sys.exit(1)


def start() -> None:
    """docker compose up -d — start all services."""
    console.print("[cyan][3/3] Starting services…[/cyan]")
    result = utils.docker_compose(["up", "-d"], check=False)
    if result.returncode != 0:
        console.print("[red]✗ docker compose up -d failed.[/red]")
        sys.exit(1)


def _poll_service(container: str, timeout: int) -> str:
    """Poll until healthy/running or timeout. Returns final status string."""
    deadline = time.time() + timeout
    while time.time() < deadline:
        status = utils.container_health(container)
        if status in ("healthy", "running"):
            return status
        if status == "unhealthy":
            return "unhealthy"
        time.sleep(3)
    return "timeout"


def _get_services(cfg: dict[str, Any] | None = None) -> list[tuple[str, str, int]]:
    """Return list of services to poll, including optional sidecars if enabled."""
    services = list(BASE_SERVICES)
    if cfg is None or cfg.get("enable_solr", True):
        services.append(SOLR_SERVICE)
    # ChromaDB is automatically included with the AI service
    if cfg is None or cfg.get("ollama_url"):
        services.append(CHROMADB_SERVICE)
    # Optional sidecar services — only poll if user enabled them
    if cfg:
        for key, svc_tuple in OPTIONAL_SERVICES.items():
            if cfg.get(f"enable_{key}"):
                services.append(svc_tuple)
    return services


def wait_for_services(cfg: dict[str, Any] | None = None) -> None:
    """Poll each service until healthy or timeout, displaying a live table."""
    console.print("\n[bold]Waiting for services to become healthy…[/bold]")

    services = _get_services(cfg)
    results: dict[str, str] = {}
    icons = {
        "healthy":   "[green]✓ healthy[/green]",
        "running":   "[green]✓ running[/green]",
        "unhealthy": "[red]✗ unhealthy[/red]",
        "timeout":   "[red]✗ timeout[/red]",
        "waiting":   "[yellow]… waiting[/yellow]",
    }

    for svc, container, timeout in services:
        results[svc] = "waiting"

    def _render_table() -> Table:
        table = Table(show_header=False, box=None, padding=(0, 2))
        table.add_column("Service", style="white", min_width=14)
        table.add_column("Status")
        for svc, _, _ in services:
            table.add_row(svc, icons.get(results[svc], results[svc]))
        return table

    with Live(_render_table(), console=console, refresh_per_second=4) as live:
        for svc, container, timeout in services:
            status = _poll_service(container, timeout)
            results[svc] = status
            live.update(_render_table())

    failed = [svc for svc, _, _ in services if results[svc] in ("unhealthy", "timeout")]
    if failed:
        console.print(f"\n[red]✗ Services failed to start: {', '.join(failed)}[/red]")
        console.print("Run [bold]docker compose logs[/bold] to investigate.")
        sys.exit(1)

    console.print("[green]✓ All services healthy.[/green]\n")


def run(cfg: dict[str, Any] | None = None) -> None:
    """Execute the full Docker setup phase."""
    console.rule("[bold]Phase 3 — Docker Setup[/bold]")
    pull()
    build()
    start()
    wait_for_services(cfg)
