"""CE Phase 8 — Generate Traefik dynamic routing configs."""
from __future__ import annotations

from acropolis.installer.phases.base import InstallerContext, Phase, PhaseResult
from acropolis.installer.routing import write_route_configs


class TraefikPhase(Phase):
    """Materialize Traefik routes for every exposed service."""

    id = "community.traefik"
    order = 800
    depends_on = ["community.deploy"]
    legacy_state_id = 8

    def run(self, ctx: InstallerContext) -> PhaseResult:
        if ctx.state.is_completed(self.legacy_state_id or -1):
            return PhaseResult(self.id, success=True, skipped=True, message="resumed from state")

        if ctx.topology is None or ctx.edition is None or ctx.config is None:
            return PhaseResult(self.id, success=False, message="topology + edition + config must run first")

        ctx.state.start_phase(self.legacy_state_id or 8)
        ctx.state.save()

        write_route_configs(
            services=ctx.services,
            domain=ctx.config.domain,
            topology_mode=ctx.topology.mode,
            tier=ctx.edition.tier,
            tls_mode=ctx.config.tls_mode,
            acme_email=ctx.config.acme_email,
            console=ctx.console,
        )
        ctx.state.complete_phase(self.legacy_state_id or 8)
        ctx.state.save()
        return PhaseResult(self.id, success=True)
