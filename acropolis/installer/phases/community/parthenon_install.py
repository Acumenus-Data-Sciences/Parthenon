"""Sub-Phase between 5 and 6 — install Parthenon itself if not already running.

This phase is unique in the legacy state machine: it has no numeric ID
because it isn't tracked through ``InstallState.completed_phases``;
instead it consults the topology's ``parthenon_install_completed`` flag
and re-runs service discovery afterwards. The registry preserves that
behavior — ``legacy_state_id`` stays ``None``.
"""
from __future__ import annotations

import importlib
import sys

from acropolis.installer.discovery import discover_services
from acropolis.installer.phases.base import InstallerContext, Phase, PhaseResult
from acropolis.installer.phases.community.discovery import _service_to_dict
from acropolis.installer.utils import PARTHENON_ROOT


def _run_parthenon_installer(ctx: InstallerContext) -> bool:
    if ctx.config is None:
        return False
    config = ctx.config
    console = ctx.console

    console.print("\n[bold cyan]Installing Parthenon Application[/]\n")

    pre_seed = {
        "admin_email": config.parthenon_admin_email,
        "admin_name": config.parthenon_admin_name,
        "admin_password": config.parthenon_admin_password,
        "app_url": f"https://parthenon.{config.domain}",
        "timezone": config.timezone,
        "experience": "Experienced",
    }
    pre_seed = {k: v for k, v in pre_seed.items() if v}

    try:
        parthenon_str = str(PARTHENON_ROOT)
        if parthenon_str not in sys.path:
            sys.path.insert(0, parthenon_str)

        installer_cli = importlib.import_module("installer.cli")
        installer_cli.run(pre_seed=pre_seed)
        console.print("[green]Parthenon installation complete.[/]\n")
        return True
    except SystemExit as exc:
        if exc.code == 0:
            console.print("[green]Parthenon installation complete.[/]\n")
            return True
        console.print("[yellow]Parthenon installer did not complete.[/]")
        console.print("Fix Parthenon manually, then re-run this installer.")
        return False
    except Exception as exc:  # noqa: BLE001 — boundary
        console.print(f"[red]Parthenon installer error: {exc}[/]")
        return False


class ParthenonInstallPhase(Phase):
    """Install Parthenon if its containers aren't already running."""

    id = "community.parthenon_install"
    order = 550  # Between configuration (500) and network (600).
    depends_on = ["community.configuration"]
    legacy_state_id = None  # Not in InstallState.completed_phases.

    def run(self, ctx: InstallerContext) -> PhaseResult:
        if ctx.topology is None or ctx.config is None:
            return PhaseResult(self.id, success=False, message="topology + config must run first")

        if ctx.topology.parthenon_install_completed:
            return PhaseResult(self.id, success=True, skipped=True, message="parthenon already installed")

        completed = _run_parthenon_installer(ctx)
        ctx.topology.parthenon_install_completed = completed
        ctx.state.data.setdefault("topology", {})["parthenon_install_completed"] = completed
        ctx.state.save()

        if not completed:
            ctx.console.print("[red]Cannot continue without Parthenon. Exiting.[/]")
            sys.exit(1)

        # Re-discover services now that Parthenon is up.
        services = discover_services(ctx.topology, ctx.console)
        ctx.services = services
        ctx.state.data["services"] = [_service_to_dict(s) for s in services]
        ctx.state.save()
        return PhaseResult(self.id, success=True)
