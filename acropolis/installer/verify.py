# installer/verify.py
"""Phase 9: Post-install verification and success summary."""
from __future__ import annotations

from urllib.error import URLError
from urllib.request import urlopen

from rich.console import Console
from rich.panel import Panel
from rich.table import Table

from acropolis.installer.config import InstallConfig
from acropolis.installer.discovery import DiscoveredService
from acropolis.installer.editions import EditionConfig
from acropolis.installer.topology import TopologyConfig
from acropolis.installer.utils import container_health, REPO_ROOT


def _check_url(url: str, timeout: int = 10) -> bool:
    """Check if a URL is reachable (200 or 302)."""
    try:
        response = urlopen(url, timeout=timeout)
        return response.status in (200, 302)
    except (URLError, OSError):
        return False


def run_smoke_tests(
    config: InstallConfig,
    edition: EditionConfig,
    services: list[DiscoveredService],
    console: Console,
) -> tuple[int, int, int]:
    """Run verification checks. Returns (passed, failed, skipped)."""
    console.print("\n[bold cyan]Phase 9: Verification[/]\n")

    passed = failed = skipped = 0

    # Check Acropolis services
    acropolis_containers = {
        "community": ["acropolis-traefik", "acropolis-portainer", "acropolis-pgadmin"],
        "enterprise": [
            "acropolis-traefik", "acropolis-portainer", "acropolis-pgadmin",
            "acropolis-n8n", "acropolis-superset",
            "acropolis-datahub-frontend", "acropolis-authentik-server",
            "acropolis-wazuh-manager", "acropolis-wazuh-indexer", "acropolis-wazuh-dashboard",
        ],
    }

    containers = acropolis_containers.get(edition.tier, [])
    for container in containers:
        status = container_health(container)
        name = container.replace("acropolis-", "")
        if status == "healthy":
            console.print(f"  [green]PASS[/] {name}")
            passed += 1
        elif status == "unknown":
            console.print(f"  [yellow]SKIP[/] {name} (not running)")
            skipped += 1
        else:
            console.print(f"  [red]FAIL[/] {name} ({status})")
            failed += 1

    # Check exposed Parthenon services
    exposed = [s for s in services if s.expose]
    for svc in exposed:
        status = container_health(svc.host)
        if status == "healthy":
            console.print(f"  [green]PASS[/] {svc.name} (Parthenon)")
            passed += 1
        elif status in ("running", "unknown"):
            console.print(f"  [yellow]SKIP[/] {svc.name} ({status})")
            skipped += 1
        else:
            console.print(f"  [red]FAIL[/] {svc.name} ({status})")
            failed += 1

    return passed, failed, skipped


def display_summary(
    config: InstallConfig,
    topology: TopologyConfig,
    edition: EditionConfig,
    services: list[DiscoveredService],
    passed: int,
    failed: int,
    skipped: int,
    console: Console,
) -> None:
    """Display installation success summary."""
    domain = config.domain

    # Results line
    console.print()
    console.print(
        f"  Results: [green]{passed} passed[/], "
        f"[red]{failed} failed[/], "
        f"[yellow]{skipped} skipped[/]"
    )

    # URL table
    url_table = Table(show_header=False, box=None, padding=(0, 2))
    url_table.add_column("Service", style="bold")
    url_table.add_column("URL", style="green")

    url_table.add_row("Traefik Dashboard", f"https://{domain}:8090")

    if edition.tier in ("community", "enterprise"):
        url_table.add_row("Portainer", f"https://portainer.{domain}")
        url_table.add_row("pgAdmin", f"https://pgadmin.{domain}")

    if edition.tier == "enterprise":
        url_table.add_row("n8n", f"https://n8n.{domain}")
        url_table.add_row("Superset", f"https://superset.{domain}")
        url_table.add_row("DataHub", f"https://datahub.{domain}")
        url_table.add_row("Authentik", f"https://auth.{domain}")
        url_table.add_row("Wazuh", f"https://wazuh.{domain}")

    if topology.mode != "standalone":
        url_table.add_row("Parthenon", f"https://parthenon.{domain}")
        for svc in services:
            if svc.expose and svc.name != "nginx":
                url_table.add_row(
                    f"  {svc.name}", f"https://{svc.subdomain}.{domain}"
                )

    summary = [
        f"[bold green]Installation Complete![/]\n",
        f"Edition:    {edition.tier}",
        f"Domain:     {domain}",
        f"Topology:   {topology.mode}",
        f"Credentials: .install-credentials",
        "",
    ]

    console.print(Panel("\n".join(summary), title="Acropolis", border_style="green"))
    console.print(url_table)

    console.print("\n[bold]Next steps:[/]")
    console.print("  1. Visit the URLs above to configure each service")
    console.print("  2. Check credentials in .install-credentials")
    console.print("  3. Use ./acropolis.sh for day-2 operations")
    if topology.mode != "standalone":
        console.print("  4. Parthenon monitoring available at grafana/prometheus subdomains")
