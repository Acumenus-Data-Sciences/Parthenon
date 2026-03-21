# installer/discovery.py
"""Phase 4: Parthenon service discovery — curated registry + auto-discovery."""
from __future__ import annotations

from dataclasses import dataclass
from typing import NamedTuple

import questionary
from rich.console import Console
from rich.table import Table

from acropolis.installer.topology import TopologyConfig
from acropolis.installer.utils import containers_on_network


class CuratedService(NamedTuple):
    name: str
    container: str
    port: int
    subdomain: str
    default: str  # "always" or "if_running"


@dataclass
class DiscoveredService:
    name: str
    host: str
    port: int
    subdomain: str
    expose: bool


CURATED_SERVICES: list[CuratedService] = [
    # Routable services — exposed through Traefik
    # Ports are container-internal (what Traefik connects to), NOT host-mapped.
    # e.g. nginx listens on 80 inside the container; 8082 is only the host mapping.
    CuratedService("nginx", "parthenon-nginx", 80, "parthenon", "always"),
    CuratedService("darkstar", "parthenon-darkstar", 8787, "darkstar", "always"),
    CuratedService("python-ai", "parthenon-ai", 8000, "ai", "always"),
    CuratedService("morpheus-ingest", "parthenon-morpheus-ingest", 8000, "morpheus", "always"),
    CuratedService("solr", "parthenon-solr", 8983, "solr", "if_running"),
    CuratedService("jupyterhub", "parthenon-jupyterhub", 8000, "jupyter", "if_running"),
    CuratedService("finngen-runner", "parthenon-finngen-runner", 8786, "finngen", "if_running"),
    CuratedService("reverb", "parthenon-reverb", 8080, "ws", "if_running"),
    CuratedService("grafana", "parthenon-grafana", 3000, "grafana", "if_running"),
    CuratedService("prometheus", "parthenon-prometheus", 9090, "prometheus", "if_running"),
    CuratedService("study-agent", "parthenon-study-agent", 8765, "study-agent", "if_running"),
    CuratedService("hecate", "parthenon-hecate", 8080, "hecate", "if_running"),
    CuratedService("whiterabbit", "parthenon-whiterabbit", 8090, "whiterabbit", "if_running"),
    CuratedService("fhir-to-cdm", "parthenon-fhir-to-cdm", 8091, "fhir", "if_running"),
    CuratedService("orthanc", "parthenon-orthanc", 8042, "orthanc", "if_running"),
    # Internal services — recognized but not routable (no Traefik exposure)
    CuratedService("php", "parthenon-php", 9000, "", "internal"),
    CuratedService("postgres", "parthenon-postgres", 5432, "", "internal"),
    CuratedService("redis", "parthenon-redis", 6379, "", "internal"),
    CuratedService("horizon", "parthenon-horizon", 0, "", "internal"),
    CuratedService("chromadb", "parthenon-chromadb", 8000, "", "internal"),
    CuratedService("loki", "parthenon-loki", 3100, "", "internal"),
    CuratedService("alloy", "parthenon-alloy", 12345, "", "internal"),
    CuratedService("cadvisor", "parthenon-cadvisor", 8080, "", "internal"),
    CuratedService("node-exporter", "parthenon-node-exporter", 9100, "", "internal"),
]

_CONTAINER_TO_CURATED = {s.container: s for s in CURATED_SERVICES}


def match_containers_to_registry(
    container_names: list[str],
) -> tuple[list[DiscoveredService], list[str]]:
    """Match running container names against curated registry.

    Returns (matched_services, unknown_container_names).
    """
    matched: list[DiscoveredService] = []
    unknown: list[str] = []

    for name in container_names:
        curated = _CONTAINER_TO_CURATED.get(name)
        if curated:
            # Internal services are recognized but never exposed
            if curated.default == "internal":
                continue
            matched.append(
                DiscoveredService(
                    name=curated.name,
                    host=curated.container,
                    port=curated.port,
                    subdomain=curated.subdomain,
                    expose=True,
                )
            )
        else:
            unknown.append(name)

    return matched, unknown


def _discover_local(
    topology: TopologyConfig, console: Console
) -> list[DiscoveredService]:
    """Discover services on a local Parthenon installation."""
    network = topology.parthenon_network or "parthenon"
    containers = containers_on_network(network)
    console.print(f"[cyan]Found {len(containers)} containers on '{network}' network.[/]")

    matched, unknown = match_containers_to_registry(containers)

    if unknown:
        console.print(f"[yellow]Unknown containers: {', '.join(unknown)}[/]")
        for container in unknown:
            expose = questionary.confirm(
                f"Expose '{container}' through Traefik?", default=False
            ).ask()
            if expose:
                subdomain = questionary.text(
                    f"Subdomain for '{container}':",
                    default=container.replace("parthenon-", ""),
                ).ask()
                port = int(
                    questionary.text(
                        f"Internal port for '{container}':",
                        default="8080",
                    ).ask()
                )
                matched.append(
                    DiscoveredService(
                        name=container,
                        host=container,
                        port=port,
                        subdomain=subdomain,
                        expose=True,
                    )
                )

    return matched


def _discover_remote(console: Console) -> list[DiscoveredService]:
    """Let user select which services are running on remote Parthenon."""
    console.print("[cyan]Select which Parthenon services are running remotely:[/]")

    services: list[DiscoveredService] = []
    for curated in CURATED_SERVICES:
        default_on = curated.default == "always"
        enabled = questionary.confirm(
            f"  {curated.name} (:{curated.port})?",
            default=default_on,
        ).ask()
        if enabled:
            services.append(
                DiscoveredService(
                    name=curated.name,
                    host=curated.container,
                    port=curated.port,
                    subdomain=curated.subdomain,
                    expose=True,
                )
            )

    return services


def _display_services(services: list[DiscoveredService], console: Console) -> None:
    """Display discovered services table."""
    table = Table(title="Discovered Parthenon Services", show_lines=True)
    table.add_column("Service", style="bold")
    table.add_column("Host")
    table.add_column("Port")
    table.add_column("Subdomain")
    table.add_column("Expose")

    for s in services:
        expose_str = "[green]Yes[/]" if s.expose else "[dim]No[/]"
        table.add_row(s.name, s.host, str(s.port), s.subdomain, expose_str)

    console.print(table)


def discover_services(
    topology: TopologyConfig, console: Console
) -> list[DiscoveredService]:
    """Phase 4: Discover and confirm Parthenon services."""
    console.print("\n[bold cyan]Phase 4: Parthenon Service Discovery[/]\n")

    if topology.mode == "standalone":
        console.print("[dim]Standalone mode — skipping service discovery.[/]")
        return []

    if topology.mode in ("fresh_install", "local"):
        services = _discover_local(topology, console)
    else:
        services = _discover_remote(console)

    _display_services(services, console)

    # Let user toggle exposure
    if services and questionary.confirm(
        "Modify which services are exposed?", default=False
    ).ask():
        for svc in services:
            svc.expose = questionary.confirm(
                f"  Expose {svc.name}?", default=svc.expose
            ).ask()

    return services
