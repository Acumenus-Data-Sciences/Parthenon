"""CE Phase 2 — Detect / collect local Parthenon topology."""
from __future__ import annotations

from dataclasses import asdict

from acropolis.installer.phases.base import InstallerContext, Phase, PhaseResult
from acropolis.installer.topology import TopologyConfig, collect_topology


class TopologyPhase(Phase):
    """Resolve where Parthenon is running (compose vs k8s, network, etc.)."""

    id = "community.topology"
    order = 200
    depends_on = ["community.preflight"]
    legacy_state_id = 2

    def run(self, ctx: InstallerContext) -> PhaseResult:
        if ctx.state.is_completed(self.legacy_state_id or -1):
            topo_data = ctx.state.data.get("topology", {})
            ctx.topology = TopologyConfig(**topo_data)
            return PhaseResult(self.id, success=True, skipped=True, message="resumed from state")

        ctx.state.start_phase(self.legacy_state_id or 2)
        ctx.state.save()

        topology = collect_topology(ctx.console)
        ctx.topology = topology
        ctx.state.data["topology"] = asdict(topology)
        ctx.state.complete_phase(self.legacy_state_id or 2)
        ctx.state.save()
        return PhaseResult(self.id, success=True)
