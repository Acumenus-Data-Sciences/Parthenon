# installer/network.py
"""Phase 6: Docker network setup and cross-network linking."""
from __future__ import annotations

from rich.console import Console

from acropolis.installer.discovery import DiscoveredService
from acropolis.installer.topology import TopologyConfig
from acropolis.installer.utils import (
    connect_container_to_network,
    create_network,
    disconnect_container_from_network,
    network_exists,
    remove_network,
)

ACROPOLIS_NETWORK = "acropolis_network"


def setup_network(
    topology: TopologyConfig,
    services: list[DiscoveredService],
    console: Console,
) -> list[str]:
    """Phase 6: Set up Docker networks and cross-network connections.

    Returns list of connections made (for rollback tracking).
    Format: ["container_name:network_name", ...]
    """
    console.print("\n[bold cyan]Phase 6: Network Setup[/]\n")

    connections: list[str] = []

    # Create acropolis_network if needed
    if not network_exists(ACROPOLIS_NETWORK):
        console.print(f"[cyan]Creating network: {ACROPOLIS_NETWORK}[/]")
        if not create_network(ACROPOLIS_NETWORK):
            console.print(f"[red]Failed to create {ACROPOLIS_NETWORK}[/]")
            raise RuntimeError(f"Could not create Docker network {ACROPOLIS_NETWORK}")
        console.print(f"[green]Network {ACROPOLIS_NETWORK} created.[/]")
    else:
        console.print(f"[green]Network {ACROPOLIS_NETWORK} already exists.[/]")

    # docker-compose.yml declares 'parthenon' as external (name: parthenon).
    # This network MUST exist or docker compose up will fail.
    # It may differ from the actual Parthenon network (e.g. parthenon_parthenon).
    COMPOSE_PARTHENON_NETWORK = "parthenon"
    if not network_exists(COMPOSE_PARTHENON_NETWORK):
        console.print(f"[cyan]Creating network: {COMPOSE_PARTHENON_NETWORK}[/]")
        if not create_network(COMPOSE_PARTHENON_NETWORK):
            console.print(f"[red]Failed to create {COMPOSE_PARTHENON_NETWORK}[/]")
            raise RuntimeError(f"Could not create Docker network {COMPOSE_PARTHENON_NETWORK}")
        console.print(f"[green]Network {COMPOSE_PARTHENON_NETWORK} created.[/]")
    else:
        console.print(f"[green]Network {COMPOSE_PARTHENON_NETWORK} already exists.[/]")

    if topology.mode == "standalone":
        console.print("[dim]Standalone mode — no cross-network linking needed.[/]")
        return connections

    if topology.mode == "remote":
        console.print("[dim]Remote mode — Traefik routes via external URL.[/]")
        return connections

    # Local mode: connect Parthenon containers to acropolis_network
    exposed = [s for s in services if s.expose]
    if not exposed:
        console.print("[dim]No services to expose — skipping network linking.[/]")
        return connections

    console.print(f"[cyan]Connecting {len(exposed)} Parthenon containers to {ACROPOLIS_NETWORK}...[/]")

    for svc in exposed:
        console.print(f"  Connecting {svc.host}...", end=" ")
        if connect_container_to_network(svc.host, ACROPOLIS_NETWORK):
            connections.append(f"{svc.host}:{ACROPOLIS_NETWORK}")
            console.print("[green]OK[/]")
        else:
            console.print("[yellow]already connected or failed[/]")

    console.print(f"[green]Network setup complete. {len(connections)} connections made.[/]")
    return connections


def rollback_network(connections: list[str], console: Console) -> None:
    """Undo network connections made during setup."""
    if not connections:
        return

    console.print("[yellow]Rolling back network connections...[/]")
    for conn in connections:
        container, network = conn.split(":")
        console.print(f"  Disconnecting {container} from {network}...", end=" ")
        if disconnect_container_from_network(container, network):
            console.print("[green]OK[/]")
        else:
            console.print("[yellow]failed (may already be disconnected)[/]")

    # Remove acropolis_network if we created it and it's now empty
    if network_exists(ACROPOLIS_NETWORK):
        console.print(f"  Removing {ACROPOLIS_NETWORK}...", end=" ")
        if remove_network(ACROPOLIS_NETWORK):
            console.print("[green]OK[/]")
        else:
            console.print("[yellow]failed (may have attached containers)[/]")
