"""CE Phase 6 — Docker network setup (acumenus + parthenon bridges)."""
from __future__ import annotations

import sys

from acropolis.installer.network import setup_network
from acropolis.installer.phases.base import InstallerContext, Phase, PhaseResult


class NetworkSetupPhase(Phase):
    """Bring up Docker networks the rest of the stack lives on."""

    id = "community.network"
    order = 600
    depends_on = ["community.parthenon_install"]
    legacy_state_id = 6

    def run(self, ctx: InstallerContext) -> PhaseResult:
        if ctx.state.is_completed(self.legacy_state_id or -1):
            ctx.connections = ctx.state.data.get("network_connections", [])
            return PhaseResult(self.id, success=True, skipped=True, message="resumed from state")

        if ctx.topology is None:
            return PhaseResult(self.id, success=False, message="topology must run first")

        ctx.state.start_phase(self.legacy_state_id or 6)
        ctx.state.save()

        try:
            connections = setup_network(ctx.topology, ctx.services, ctx.console)
        except RuntimeError as exc:
            ctx.console.print(f"[red]Network setup failed: {exc}[/]")
            sys.exit(1)

        ctx.connections = connections
        ctx.state.data["network_connections"] = connections
        ctx.state.complete_phase(self.legacy_state_id or 6)
        ctx.state.save()
        return PhaseResult(self.id, success=True)
