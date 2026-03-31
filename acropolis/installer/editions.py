# installer/editions.py
"""Phase 3: Edition selection — Community or Enterprise."""
from __future__ import annotations

import re
from dataclasses import dataclass

import questionary
from rich.console import Console
from rich.table import Table

from acropolis.installer.preflight import run_edition_port_check, has_failures


@dataclass
class EditionConfig:
    tier: str  # community, enterprise
    license_key: str | None = None
    enabled_services: list[str] | None = None

    def __post_init__(self):
        if self.enabled_services is None:
            self.enabled_services = TIER_SERVICES.get(self.tier, [])


TIER_SERVICES: dict[str, list[str]] = {
    "community": ["traefik", "portainer", "pgadmin"],
    "enterprise": [
        "traefik", "portainer", "pgadmin",
        "n8n", "superset", "superset-worker", "superset-beat",
        "superset-db", "superset-cache",
        "datahub-frontend", "datahub-gms", "datahub-mysql",
        "datahub-opensearch", "datahub-broker",
        "wazuh-manager", "wazuh-indexer", "wazuh-dashboard",
        "authentik-server", "authentik-worker",
        "authentik-db", "authentik-redis",
    ],
}

LICENSE_PATTERN = re.compile(r"^ACRO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$")


def _display_tier_table(console: Console) -> None:
    """Display edition comparison table."""
    table = Table(title="Acropolis Editions", show_lines=True)
    table.add_column("Tier", style="bold")
    table.add_column("Services")
    table.add_column("License")

    table.add_row("Community", "Traefik, Portainer, pgAdmin", "None")
    table.add_row("Enterprise", "+ n8n, Superset, DataHub, Authentik, Wazuh", "Key required")

    console.print(table)


def _validate_license(key: str) -> bool:
    """Validate license key format."""
    return bool(LICENSE_PATTERN.match(key.strip().upper()))


def collect_edition(console: Console) -> EditionConfig:
    """Phase 3: Collect edition selection."""
    console.print("\n[bold cyan]Phase 3: Edition Selection[/]\n")
    _display_tier_table(console)

    tier = questionary.select(
        "Select your edition:",
        choices=[
            questionary.Choice("Community", value="community"),
            questionary.Choice("Enterprise", value="enterprise"),
        ],
        default="community",
    ).ask()

    license_key = None
    if tier == "enterprise":
        while True:
            license_key = questionary.text(
                "Enter license key (ACRO-XXXX-XXXX-XXXX):",
            ).ask()
            if _validate_license(license_key):
                license_key = license_key.strip().upper()
                break
            console.print("[red]Invalid license key format. Expected: ACRO-XXXX-XXXX-XXXX[/]")

    # Supplemental port check
    port_result = run_edition_port_check(tier)
    if has_failures([port_result]):
        console.print(f"[red]Port conflict: {port_result.detail}[/]")
        console.print("Free the listed ports before continuing.")
        if not questionary.confirm("Continue anyway?", default=False).ask():
            raise SystemExit(1)

    return EditionConfig(tier=tier, license_key=license_key)
