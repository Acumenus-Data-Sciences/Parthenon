"""Infrastructure installer orchestrator — runs all phases with state persistence.

This is the Acropolis infrastructure installer, now integrated into the
Parthenon monorepo. It adds Traefik, Portainer, pgAdmin, and optionally
enterprise services (n8n, Superset, DataHub, Authentik) on top of Parthenon.

Flow:
  Phase 1: Preflight checks (Docker, ports, disk)
  Phase 2: Detect local Parthenon installation
  Phase 3: Edition selection (Community / Enterprise)
  Phase 4: Service discovery (enumerate Parthenon containers)
  Phase 5: Configuration (domain, TLS, credentials)
  Phase 5.5: Run Parthenon installer if not already installed
  Phase 6: Network setup (acropolis_network + bridge)
  Phase 7: Deploy infrastructure services
  Phase 8: Traefik routing configuration
  Phase 9: Verification + generate day-2 CLI
"""
from __future__ import annotations

import sys
from dataclasses import asdict
from pathlib import Path

import questionary
from rich.console import Console
from rich.panel import Panel

from acropolis.installer.config import (
    InstallConfig,
    collect_config,
    write_env_file,
    write_credentials_file,
    write_pgadmin_servers,
)
from acropolis.installer.deploy import deploy, teardown
from acropolis.installer.discovery import DiscoveredService, discover_services
from acropolis.installer.editions import EditionConfig, collect_edition
from acropolis.installer.generator import write_acropolis_sh
from acropolis.installer.network import rollback_network, setup_network
from acropolis.installer.preflight import display_results, has_failures, has_warnings, run_preflight
from acropolis.installer.routing import write_route_configs
from acropolis.installer.state import InstallState
from acropolis.installer.topology import TopologyConfig, collect_topology
from acropolis.installer.verify import display_summary, run_smoke_tests
from acropolis.installer.utils import ACROPOLIS_ROOT, PARTHENON_ROOT


def _banner(console: Console) -> None:
    console.print(
        Panel(
            "[bold cyan]Parthenon Infrastructure Installer[/]\n"
            "Traefik + Portainer + pgAdmin + Enterprise Services\n\n"
            "[dim]Adds production infrastructure on top of Parthenon.[/]",
            border_style="cyan",
        )
    )


def _run_parthenon_installer(config: InstallConfig, console: Console) -> bool:
    """Run Parthenon's own installer with pre-seeded credentials.

    Instead of a subprocess call (as in the old two-repo model), we import
    Parthenon's installer directly since we're in the same repo.
    """
    console.print("\n[bold cyan]Installing Parthenon Application[/]\n")

    pre_seed = {
        "admin_email": config.parthenon_admin_email,
        "admin_name": config.parthenon_admin_name,
        "admin_password": config.parthenon_admin_password,
        "app_url": f"https://parthenon.{config.domain}",
        "timezone": config.timezone,
        "experience": "Experienced",
    }

    # Remove empty values so they don't override real defaults
    pre_seed = {k: v for k, v in pre_seed.items() if v}

    try:
        # Import Parthenon's installer — it's at the repo root level
        import importlib
        import sys as _sys

        # Ensure Parthenon root is on sys.path so `installer` package resolves
        parthenon_str = str(PARTHENON_ROOT)
        if parthenon_str not in _sys.path:
            _sys.path.insert(0, parthenon_str)

        installer_cli = importlib.import_module("installer.cli")
        installer_cli.run(pre_seed=pre_seed)
        console.print("[green]Parthenon installation complete.[/]\n")
        return True
    except SystemExit as e:
        if e.code == 0:
            console.print("[green]Parthenon installation complete.[/]\n")
            return True
        console.print("[yellow]Parthenon installer did not complete.[/]")
        console.print("Fix Parthenon manually, then re-run this installer.")
        return False
    except Exception as e:
        console.print(f"[red]Parthenon installer error: {e}[/]")
        return False


def run(upgrade: bool = False) -> None:
    """Main infrastructure installer entry point."""
    console = Console()
    _banner(console)

    # ── Upgrade banner ────────────────────────────────────────────────────
    if upgrade:
        from acropolis.installer.version import (
            detect_installed_version, CURRENT_VERSION, UPGRADE_NOTES,
        )

        installed = detect_installed_version()
        if installed and installed != CURRENT_VERSION:
            notes = UPGRADE_NOTES.get(CURRENT_VERSION, {})
            lines = [f"[bold]Upgrading: v{installed} → v{CURRENT_VERSION}[/bold]\n"]
            if notes.get("new"):
                lines.append("[cyan]New Features:[/cyan]")
                for item in notes["new"]:
                    lines.append(f"  ✦ {item}")
            if notes.get("upgraded"):
                lines.append("\n[cyan]Upgraded:[/cyan]")
                for item in notes["upgraded"]:
                    lines.append(f"  ↑ {item}")

            console.print(Panel("\n".join(lines), border_style="cyan", padding=(1, 2)))

            if not questionary.confirm("Proceed with upgrade?", default=True).ask():
                console.print("[dim]Upgrade cancelled.[/dim]")
                return

    state_path = ACROPOLIS_ROOT / ".install-state.json"
    state = InstallState(state_path)

    # Resume check
    if state.exists():
        completed = state.completed_phases
        console.print(
            f"\n[yellow]Previous installation found "
            f"(completed phases: {completed}).[/]"
        )
        action = questionary.select(
            "How would you like to proceed?",
            choices=[
                questionary.Choice("Resume from where I left off", value="resume"),
                questionary.Choice("Start fresh", value="fresh"),
            ],
        ).ask()
        if action == "fresh":
            state.clear()

    # ── Phase 1: Preflight ──────────────────────────────────────────────────
    if not state.is_completed(1):
        console.print("\n[bold cyan]Phase 1: Preflight Checks[/]\n")
        state.start_phase(1)
        state.save()

        results = run_preflight()
        display_results(results, console)

        if has_failures(results):
            console.print("[red]Fix the issues above before continuing.[/]")
            sys.exit(1)

        if has_warnings(results):
            if not questionary.confirm(
                "Warnings detected. Continue?", default=True
            ).ask():
                sys.exit(0)

        state.complete_phase(1)
        state.save()

    # ── Phase 2: Topology ───────────────────────────────────────────────────
    if not state.is_completed(2):
        state.start_phase(2)
        state.save()

        topology = collect_topology(console)
        state.data["topology"] = asdict(topology)
        state.complete_phase(2)
        state.save()
    else:
        topo_data = state.data.get("topology", {})
        topology = TopologyConfig(**topo_data)

    # ── Phase 3: Edition Selection ──────────────────────────────────────────
    if not state.is_completed(3):
        state.start_phase(3)
        state.save()

        edition = collect_edition(console)
        state.data["edition"] = {
            "tier": edition.tier,
            "license_key": edition.license_key,
        }
        state.complete_phase(3)
        state.save()
    else:
        ed_data = state.data.get("edition", {})
        edition = EditionConfig(
            tier=ed_data.get("tier", "community"),
            license_key=ed_data.get("license_key"),
        )

    # ── Phase 4: Service Discovery ──────────────────────────────────────────
    if not state.is_completed(4):
        state.start_phase(4)
        state.save()

        services = discover_services(topology, console)
        state.data["services"] = [
            {
                "name": s.name,
                "host": s.host,
                "port": s.port,
                "subdomain": s.subdomain,
                "expose": s.expose,
            }
            for s in services
        ]
        state.complete_phase(4)
        state.save()
    else:
        services = [
            DiscoveredService(**s)
            for s in state.data.get("services", [])
        ]

    # ── Phase 5: Configuration ──────────────────────────────────────────────
    if not state.is_completed(5):
        state.start_phase(5)
        state.save()

        config = collect_config(topology, edition, console)
        write_env_file(config, topology, edition)
        write_credentials_file(config, edition, topology)
        if edition.tier in ("community", "enterprise"):
            write_pgadmin_servers(config)
        console.print("[green]Configuration files written.[/]")

        state.data["config"] = {
            "domain": config.domain,
            "timezone": config.timezone,
            "tls_mode": config.tls_mode,
            "acme_email": config.acme_email,
            "parthenon_admin_email": config.parthenon_admin_email,
            "parthenon_admin_name": config.parthenon_admin_name,
            "parthenon_admin_password": config.parthenon_admin_password,
        }
        state.complete_phase(5)
        state.save()
    else:
        cfg = state.data.get("config", {})
        config = InstallConfig(
            domain=cfg.get("domain", "acumenus.net"),
            timezone=cfg.get("timezone", "UTC"),
            tls_mode=cfg.get("tls_mode", "letsencrypt"),
            acme_email=cfg.get("acme_email", ""),
            parthenon_admin_email=cfg.get("parthenon_admin_email", ""),
            parthenon_admin_name=cfg.get("parthenon_admin_name", ""),
            parthenon_admin_password=cfg.get("parthenon_admin_password", ""),
        )

    # ── Parthenon Install (if not already running) ──────────────────────────
    if not topology.parthenon_install_completed:
        completed = _run_parthenon_installer(config, console)
        topology.parthenon_install_completed = completed
        state.data["topology"]["parthenon_install_completed"] = completed
        state.save()

        if not completed:
            console.print("[red]Cannot continue without Parthenon. Exiting.[/]")
            sys.exit(1)

        # Re-discover services now that Parthenon is running
        services = discover_services(topology, console)
        state.data["services"] = [
            {
                "name": s.name,
                "host": s.host,
                "port": s.port,
                "subdomain": s.subdomain,
                "expose": s.expose,
            }
            for s in services
        ]
        state.save()

    # ── Phase 6: Network Setup ──────────────────────────────────────────────
    if not state.is_completed(6):
        state.start_phase(6)
        state.save()

        try:
            connections = setup_network(topology, services, console)
            state.data["network_connections"] = connections
            state.complete_phase(6)
            state.save()
        except RuntimeError as e:
            console.print(f"[red]Network setup failed: {e}[/]")
            sys.exit(1)
    else:
        connections = state.data.get("network_connections", [])

    # ── Phase 7: Docker Deploy ──────────────────────────────────────────────
    if not state.is_completed(7):
        state.start_phase(7)
        state.save()

        success = deploy(edition, console)
        if not success:
            console.print("[red]Deployment aborted.[/]")
            teardown(edition, console)
            rollback_network(connections, console)
            sys.exit(1)

        state.complete_phase(7)
        state.save()

    # ── Phase 8: Traefik Routing ────────────────────────────────────────────
    if not state.is_completed(8):
        state.start_phase(8)
        state.save()

        write_route_configs(
            services=services,
            domain=config.domain,
            topology_mode=topology.mode,
            tier=edition.tier,
            tls_mode=config.tls_mode,
            acme_email=config.acme_email,
            console=console,
        )
        state.complete_phase(8)
        state.save()

    # ── Phase 9: Verification + Generator ───────────────────────────────────
    state.start_phase(9)
    state.save()

    passed, failed, skipped = run_smoke_tests(config, edition, services, console)

    # Generate customized acropolis.sh
    service_names = [s.name for s in services if s.expose]
    write_acropolis_sh(
        tier=edition.tier,
        domain=config.domain,
        topology_mode=topology.mode,
        services=service_names,
        parthenon_path=topology.parthenon_path,
        parthenon_url=topology.parthenon_url,
        parthenon_network=topology.parthenon_network,
        console=console,
    )

    display_summary(config, topology, edition, services, passed, failed, skipped, console)

    # Write version file
    from acropolis.installer.version import write_version
    write_version(edition=edition.tier)

    # Clear state on success
    state.clear()
