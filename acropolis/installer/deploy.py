# installer/deploy.py
"""Phase 7: Docker deploy — pull, build, start, health polling."""
from __future__ import annotations

import time

import questionary
from rich.console import Console
from rich.live import Live
from rich.table import Table

from acropolis.installer.editions import EditionConfig
from acropolis.installer.utils import (
    container_health,
    docker_compose,
    exec_in_container,
    run_stream,
    REPO_ROOT,
)

# Compose file sets by tier
COMPOSE_FILES: dict[str, list[str]] = {
    "community": ["-f", "docker-compose.yml", "-f", "docker-compose.community.yml"],
    "enterprise": [
        "-f", "docker-compose.yml",
        "-f", "docker-compose.community.yml",
        "-f", "docker-compose.enterprise.yml",
    ],
}

# Container names and their health check timeouts
SERVICE_TIMEOUTS: dict[str, dict[str, int]] = {
    "community": {
        "acropolis-traefik": 30,
        "acropolis-portainer": 30,
        "acropolis-pgadmin": 30,
    },
    "enterprise": {
        "acropolis-traefik": 30,
        "acropolis-portainer": 30,
        "acropolis-pgadmin": 30,
        "acropolis-n8n": 60,
        "acropolis-superset": 120,
        "acropolis-superset-worker": 120,
        "acropolis-datahub-frontend": 120,
        "acropolis-datahub-gms": 120,
        "acropolis-authentik-server": 60,
    },
}


def _compose_args(edition: EditionConfig) -> list[str]:
    """Get compose file arguments for the edition."""
    return COMPOSE_FILES.get(edition.tier, COMPOSE_FILES["community"])


def _build_health_table(
    statuses: dict[str, str], elapsed: dict[str, float]
) -> Table:
    """Build a Rich table showing service health status."""
    table = Table(title="Service Health", show_lines=True)
    table.add_column("Service", style="bold")
    table.add_column("Status")
    table.add_column("Time")

    status_styles = {
        "healthy": "[green]healthy[/]",
        "running": "[yellow]starting[/]",
        "starting": "[yellow]starting[/]",
        "unhealthy": "[red]unhealthy[/]",
        "timeout": "[red]timeout[/]",
        "unknown": "[dim]unknown[/]",
    }

    for container, status in statuses.items():
        name = container.replace("acropolis-", "")
        style = status_styles.get(status, f"[dim]{status}[/]")
        secs = f"{elapsed.get(container, 0):.0f}s"
        table.add_row(name, style, secs)

    return table


def pull_images(edition: EditionConfig, console: Console) -> None:
    """Pull Docker images for the edition."""
    console.print("[cyan]Pulling images...[/]")
    args = _compose_args(edition)
    run_stream(["docker", "compose", *args, "pull"], cwd=REPO_ROOT)


def build_images(edition: EditionConfig, console: Console) -> None:
    """Build any custom Docker images."""
    console.print("[cyan]Building images...[/]")
    args = _compose_args(edition)
    run_stream(["docker", "compose", *args, "build"], cwd=REPO_ROOT)


def start_services(edition: EditionConfig, console: Console) -> None:
    """Start all services for the edition."""
    console.print("[cyan]Starting services...[/]")
    args = _compose_args(edition)
    docker_compose(*args, "up", "-d", cwd=REPO_ROOT)


def poll_health(
    edition: EditionConfig, console: Console
) -> dict[str, str]:
    """Poll service health with a live-updating table. Returns final statuses."""
    services = SERVICE_TIMEOUTS.get(edition.tier, SERVICE_TIMEOUTS["community"])
    statuses: dict[str, str] = {name: "starting" for name in services}
    elapsed: dict[str, float] = {name: 0.0 for name in services}
    start_time = time.monotonic()

    with Live(
        _build_health_table(statuses, elapsed),
        console=console,
        refresh_per_second=2,
    ) as live:
        while True:
            all_done = True
            now = time.monotonic()

            for container, timeout in services.items():
                if statuses[container] in ("healthy", "unhealthy", "timeout"):
                    continue

                elapsed[container] = now - start_time
                status = container_health(container)
                statuses[container] = status

                if status == "healthy":
                    continue
                elif status == "unhealthy":
                    continue
                elif elapsed[container] > timeout:
                    statuses[container] = "timeout"
                else:
                    all_done = False

            live.update(_build_health_table(statuses, elapsed))

            if all_done:
                break
            time.sleep(2)

    return statuses


def run_post_init(edition: EditionConfig, console: Console) -> None:
    """Run post-start initialization for services that need it."""
    if edition.tier != "enterprise":
        return

    console.print("\n[cyan]Running post-start initialization...[/]")

    # Superset: db upgrade + admin creation
    console.print("  Superset db upgrade...", end=" ")
    result = exec_in_container(
        "acropolis-superset",
        ["superset", "db", "upgrade"],
    )
    if result.returncode == 0:
        console.print("[green]OK[/]")
    else:
        console.print("[yellow]failed (non-fatal)[/]")

    console.print("  Superset create-admin...", end=" ")
    result = exec_in_container(
        "acropolis-superset",
        ["superset", "fab", "create-admin",
         "--username", "admin", "--firstname", "Admin",
         "--lastname", "User", "--email", "admin@localhost",
         "--password", "admin"],
    )
    if result.returncode == 0:
        console.print("[green]OK[/]")
    else:
        console.print("[yellow]failed (non-fatal)[/]")

    console.print("  Superset init...", end=" ")
    result = exec_in_container(
        "acropolis-superset",
        ["superset", "init"],
    )
    if result.returncode == 0:
        console.print("[green]OK[/]")
    else:
        console.print("[yellow]failed (non-fatal)[/]")


def handle_failures(
    statuses: dict[str, str], edition: EditionConfig, console: Console
) -> bool:
    """Handle unhealthy/timed-out services. Returns True to continue, False to abort."""
    failed = {k: v for k, v in statuses.items() if v in ("unhealthy", "timeout")}
    if not failed:
        return True

    console.print("\n[red]Some services failed to become healthy:[/]")
    args = _compose_args(edition)
    for container, status in failed.items():
        console.print(f"  [red]{container}: {status}[/]")
        # Show last 20 lines of logs
        result = docker_compose(
            *args,
            "logs", "--tail=20", container.replace("acropolis-", ""),
            cwd=REPO_ROOT,
        )
        if result.stdout:
            for line in result.stdout.strip().splitlines()[-10:]:
                console.print(f"    {line}")

    action = questionary.select(
        "How would you like to proceed?",
        choices=[
            questionary.Choice("Continue without failed services", value="continue"),
            questionary.Choice("Retry health checks", value="retry"),
            questionary.Choice("Abort installation", value="abort"),
        ],
    ).ask()

    return action != "abort"


def deploy(edition: EditionConfig, console: Console) -> bool:
    """Phase 7: Full deploy sequence. Returns True on success."""
    console.print("\n[bold cyan]Phase 7: Docker Deploy[/]\n")

    pull_images(edition, console)
    build_images(edition, console)
    start_services(edition, console)

    console.print("\n[cyan]Waiting for services to become healthy...[/]\n")
    statuses = poll_health(edition, console)

    if not handle_failures(statuses, edition, console):
        return False

    run_post_init(edition, console)
    return True


def teardown(edition: EditionConfig, console: Console) -> None:
    """Tear down all services (for rollback)."""
    console.print("[yellow]Stopping Acropolis services...[/]")
    args = _compose_args(edition)
    docker_compose(*args, "down", cwd=REPO_ROOT)
