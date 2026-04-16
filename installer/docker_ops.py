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

# Minimum service set needed to reach the login page.
# Community Edition fast-boot uses this list verbatim.
# Horizon is deliberately excluded from the core set — it bind-mounts the host
# backend/ dir and requires vendor/autoload.php, which only exists after Phase 4
# runs `composer install`. It's started by bootstrap.run_laravel_bootstrap().
CE_CORE_SERVICES = [
    ("postgres", "parthenon-postgres", 60),
    ("redis",    "parthenon-redis",    30),
    ("php",      "parthenon-php",     120),
    ("nginx",    "parthenon-nginx",    30),
]

HORIZON_SERVICE = ("horizon", "parthenon-horizon", 30)

# Services added on top of CE core for a full interactive install.
FULL_ADDITIONS = [
    ("horizon",    "parthenon-horizon",     30),
    ("python-ai",  "python-ai",            120),
    ("jupyterhub", "parthenon-jupyterhub",  60),
    ("darkstar",   "parthenon-darkstar",   120),
]

SOLR_SERVICE = ("solr", "parthenon-solr", 60)
CHROMADB_SERVICE = ("chromadb", "parthenon-chromadb", 60)

# Optional sidecar services (enabled via cfg["enable_*"] flags)
OPTIONAL_SERVICES = {
    "study_agent":  ("study-agent",   "parthenon-study-agent",   120),
    "qdrant":       ("qdrant",        "parthenon-qdrant",         60),
    "hecate":       ("hecate",        "parthenon-hecate",         60),
    "blackrabbit":  ("blackrabbit",   "parthenon-blackrabbit",    60),
    "fhir_to_cdm":  ("fhir-to-cdm",   "parthenon-fhir-to-cdm",    60),
    "orthanc":      ("orthanc",       "parthenon-orthanc",        60),
}

# Back-compat alias — older callers import BASE_SERVICES / SERVICES.
BASE_SERVICES = CE_CORE_SERVICES + FULL_ADDITIONS
SERVICES = BASE_SERVICES


def _is_community(cfg: dict[str, Any] | None) -> bool:
    return bool(cfg and cfg.get("edition") == "Community Edition")


def _compose_service_names(cfg: dict[str, Any] | None = None) -> list[str]:
    if _is_community(cfg):
        base = [service for service, _, _ in CE_CORE_SERVICES]
    else:
        base = [service for service, _, _ in (CE_CORE_SERVICES + FULL_ADDITIONS)]
    names = list(base)
    if cfg is None or cfg.get("enable_solr", True):
        names.append(SOLR_SERVICE[0])
    if cfg and cfg.get("ollama_url") and not _is_community(cfg):
        names.append(CHROMADB_SERVICE[0])
    if cfg is None or cfg.get("enable_study_agent"):
        names.append(OPTIONAL_SERVICES["study_agent"][0])
    if cfg is None or cfg.get("enable_hecate"):
        names.extend([OPTIONAL_SERVICES["qdrant"][0], OPTIONAL_SERVICES["hecate"][0]])
    if cfg is None or cfg.get("enable_blackrabbit"):
        names.append(OPTIONAL_SERVICES["blackrabbit"][0])
    if cfg is None or cfg.get("enable_fhir_to_cdm"):
        names.append(OPTIONAL_SERVICES["fhir_to_cdm"][0])
    if cfg is None or cfg.get("enable_orthanc"):
        names.append(OPTIONAL_SERVICES["orthanc"][0])
    deduped: list[str] = []
    for name in names:
        if name not in deduped:
            deduped.append(name)
    return deduped


def _ensure_external_networks() -> None:
    """Create external networks referenced by docker-compose.yml if missing.

    docker-compose.yml declares the `acumenus` network as external (shared
    with the Acropolis infrastructure stack). On a fresh machine that network
    does not exist and compose fails immediately. On a dev machine it already
    exists — `docker network create` is idempotent via the check below.
    """
    for net in ("acumenus",):
        inspect = utils.run(
            ["docker", "network", "inspect", net],
            capture=True, check=False,
        )
        if inspect.returncode != 0:
            utils.run(
                ["docker", "network", "create", net],
                capture=True, check=False,
            )


def pull(cfg: dict[str, Any] | None = None) -> None:
    """docker compose pull — only pulls images for services we'll actually start."""
    services = _compose_service_names(cfg)
    console.print(f"[cyan][1/3] Pulling Docker images for {len(services)} service(s)…[/cyan]")
    rc = utils.run_stream(["docker", "compose", "pull", *services])
    if rc != 0:
        console.print("[yellow]⚠ Some images failed to pull — continuing with local images.[/yellow]")


def build(cfg: dict[str, Any] | None = None) -> None:
    """docker compose build — only builds services we'll actually start."""
    services = _compose_service_names(cfg)
    console.print(f"[cyan][2/3] Building Docker images for {len(services)} service(s)…[/cyan]")
    rc = utils.run_stream(["docker", "compose", "build", *services])
    if rc != 0:
        console.print("[red]✗ Build failed.[/red]")
        sys.exit(1)


def start(cfg: dict[str, Any] | None = None) -> None:
    """docker compose up -d — start the selected services."""
    _ensure_external_networks()
    console.print("[cyan][3/3] Starting services…[/cyan]")
    result = utils.docker_compose(["up", "-d", *_compose_service_names(cfg)], check=False)
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
    """Return list of services to poll, matching the set started by `start()`."""
    if _is_community(cfg):
        services = list(CE_CORE_SERVICES)
    else:
        services = list(CE_CORE_SERVICES + FULL_ADDITIONS)
    if cfg is None or cfg.get("enable_solr", True):
        services.append(SOLR_SERVICE)
    # ChromaDB ships with the AI service and only polls when AI is enabled.
    if cfg and cfg.get("ollama_url") and not _is_community(cfg):
        services.append(CHROMADB_SERVICE)
    # Optional sidecars — only poll what we actually started.
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
    pull(cfg)
    build(cfg)
    start(cfg)
    wait_for_services(cfg)
