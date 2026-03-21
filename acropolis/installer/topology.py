"""Phase 2: Deployment topology — always local in monorepo layout."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from rich.console import Console

from acropolis.installer.utils import (
    network_exists,
    containers_on_network,
    PARTHENON_ROOT,
)


@dataclass
class TopologyConfig:
    mode: str = "local"
    parthenon_path: Optional[str] = None
    parthenon_network: Optional[str] = None
    parthenon_url: Optional[str] = None
    parthenon_install_completed: bool = False


def _detect_parthenon_network() -> Optional[str]:
    """Find Parthenon's Docker network.

    Prefers networks with running Parthenon containers over empty ones.
    With the stable `name: parthenon` in docker-compose.yml, the primary
    candidate is just "parthenon".
    """
    candidates = ("parthenon", "parthenon_parthenon", "parthenon_default")
    found_empty: Optional[str] = None
    for name in candidates:
        if network_exists(name):
            containers = containers_on_network(name)
            parthenon_containers = [c for c in containers if c.startswith("parthenon-")]
            if parthenon_containers:
                return name
            if found_empty is None:
                found_empty = name
    return found_empty


def collect_topology(console: Console) -> TopologyConfig:
    """Phase 2: Detect local Parthenon installation.

    In the monorepo layout, Parthenon is always the parent directory.
    No need for fresh_install / remote / standalone modes.
    """
    console.print("\n[bold cyan]Phase 2: Detecting Parthenon[/]\n")

    parthenon_path = str(PARTHENON_ROOT)

    # Check if docker-compose.yml exists
    compose_file = PARTHENON_ROOT / "docker-compose.yml"
    if not compose_file.exists():
        console.print(f"[red]Parthenon docker-compose.yml not found at {compose_file}[/]")
        console.print("[yellow]Parthenon must be installed first. Run: python3 install.py[/]")
        raise SystemExit(1)

    # Detect running Parthenon network
    network = _detect_parthenon_network()
    install_completed = False

    if network:
        containers = containers_on_network(network)
        parthenon_containers = [c for c in containers if c.startswith("parthenon-")]
        if parthenon_containers:
            console.print(
                f"[green]Found Parthenon on '{network}' network "
                f"with {len(parthenon_containers)} containers.[/]"
            )
            install_completed = True
        else:
            console.print(f"[yellow]Found network '{network}' but no Parthenon containers running.[/]")
    else:
        console.print("[yellow]Parthenon Docker network not found — will be created during install.[/]")

    return TopologyConfig(
        mode="local",
        parthenon_path=parthenon_path,
        parthenon_network=network or "parthenon",
        parthenon_install_completed=install_completed,
    )
