# installer/editions.py
"""Phase 3: Edition selection — Community or Enterprise."""
from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

import questionary
from rich.console import Console
from rich.table import Table

from acropolis.installer.preflight import run_edition_port_check, has_failures

# Add Parthenon project root to sys.path so we can import the shared license module
_PARTHENON_ROOT = Path(__file__).resolve().parent.parent.parent
if str(_PARTHENON_ROOT) not in sys.path:
    sys.path.insert(0, str(_PARTHENON_ROOT))

from installer.license import validate_format as _validate_license_format  # noqa: E402
from installer.license import validate_against_db as _validate_license_db  # noqa: E402
from installer.license import LICENSE_PATTERN  # noqa: E402


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


def _display_tier_table(console: Console) -> None:
    """Display edition comparison table."""
    table = Table(title="Acropolis Editions", show_lines=True)
    table.add_column("Tier", style="bold")
    table.add_column("Services")
    table.add_column("License")

    table.add_row("Community", "Traefik, Portainer, pgAdmin", "None")
    table.add_row("Enterprise", "+ n8n, Superset, DataHub, Authentik, Wazuh", "Key required")

    console.print(table)


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
            if not _validate_license_format(license_key):
                console.print("[red]Invalid license key format. Expected: ACRO-XXXX-XXXX-XXXX[/]")
                continue
            license_key = license_key.strip().upper()
            console.print("[dim]Validating license key...[/]")
            valid, msg = _validate_license_db(license_key)
            if valid:
                console.print(f"[green]{msg}[/]")
                break
            console.print(f"[red]{msg}[/]")

    # Supplemental port check
    port_result = run_edition_port_check(tier)
    if has_failures([port_result]):
        console.print(f"[red]Port conflict: {port_result.detail}[/]")
        console.print("Free the listed ports before continuing.")
        if not questionary.confirm("Continue anyway?", default=False).ask():
            raise SystemExit(1)

    return EditionConfig(tier=tier, license_key=license_key)
