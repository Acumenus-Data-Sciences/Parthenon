"""Infrastructure installer orchestrator — runs all phases through the registry.

This is the Acropolis infrastructure installer, integrated into the
Parthenon monorepo. It adds Traefik, Portainer, pgAdmin, and optionally
enterprise services (n8n, Superset, DataHub, Authentik, Wazuh) on top of
Parthenon.

Plan 02-07 lifted the legacy 9-step inline flow into a phase registry.
The CE phases live under ``acropolis/installer/phases/community/`` and
preserve the ``InstallState`` resume contract (each CE phase keeps its
legacy numeric ``state_id`` so an old ``.install-state.json`` still
resumes correctly). EE bundles add their phases by registering through
setuptools entry-point group ``parthenon.acropolis.phases``.

Flow (canonical CE order):
  Phase 1: Preflight checks (Docker, ports, disk)               community.preflight
  Phase 2: Topology (compose vs k8s, networks)                  community.topology
  Phase 3: Edition selection (Community / Enterprise)           community.edition
  Phase 4: Service discovery                                    community.discovery
  Phase 5: Configuration (domain, TLS, credentials)             community.configuration
  Phase 5.5: Run Parthenon installer if not already installed   community.parthenon_install
  Phase 6: Network setup (acumenus + parthenon bridges)         community.network
  Phase 7: Deploy infrastructure services                       community.deploy
  Phase 8: Traefik routing configuration                        community.traefik
  Phase 9: Verification + day-2 generator                       community.verify
"""
from __future__ import annotations

import questionary
from rich.console import Console
from rich.panel import Panel

from acropolis.installer.phases import (
    InstallerContext,
    PhaseError,
    PhaseRegistry,
)
from acropolis.installer.phases.community import register_into as register_community_phases
from acropolis.installer.state import InstallState
from acropolis.installer.utils import ACROPOLIS_ROOT


def _banner(console: Console) -> None:
    console.print(
        Panel(
            "[bold cyan]Parthenon Infrastructure Installer[/]\n"
            "Traefik + Portainer + pgAdmin + Enterprise Services\n\n"
            "[dim]Adds production infrastructure on top of Parthenon.[/]",
            border_style="cyan",
        )
    )


def _show_upgrade_banner(console: Console) -> bool:
    """Returns True if the operator confirms the upgrade (or no upgrade is pending)."""
    from acropolis.installer.version import (
        CURRENT_VERSION,
        UPGRADE_NOTES,
        detect_installed_version,
    )

    installed = detect_installed_version()
    if not installed or installed == CURRENT_VERSION:
        return True

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
        return False
    return True


def _resolve_resume(state: InstallState, console: Console) -> None:
    """Show the resume/fresh prompt when an existing state file is found."""
    if not state.exists():
        return
    console.print(
        f"\n[yellow]Previous installation found "
        f"(completed phases: {state.completed_phases}).[/]"
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


def build_registry(console: Console | None = None) -> PhaseRegistry:
    """Build a registry pre-loaded with CE phases + EE entry-point phases.

    Exposed as a public helper so EE wrappers and tests can construct
    a fully populated registry without recreating the wiring.
    """
    registry = PhaseRegistry(console=console)
    register_community_phases(registry)
    registry.discover_entry_points()
    return registry


def run(upgrade: bool = False) -> None:
    """Main infrastructure installer entry point."""
    console = Console()
    _banner(console)

    if upgrade and not _show_upgrade_banner(console):
        return

    state_path = ACROPOLIS_ROOT / ".install-state.json"
    state = InstallState(state_path)
    _resolve_resume(state, console)

    ctx = InstallerContext(state=state, console=console, upgrade=upgrade)
    registry = build_registry(console=console)

    # Edition isn't known until EditionSelectionPhase runs, but the
    # registry's filter applies before any phase runs. We therefore
    # plan with the maximal "enterprise" view so EE phases declared via
    # entry points are scheduled; CE-tier phases that gate on edition
    # at runtime can short-circuit themselves with a skipped result.
    # Since CE has zero requires_enterprise=True phases, the practical
    # behavior on a community-only install is identical to the old
    # inline flow.
    target_edition = "enterprise"

    try:
        registry.run_all(ctx, edition=target_edition)
    except PhaseError as err:
        console.print(f"[red]Installer halted at phase {err.phase_id}: {err}[/]")
        raise
