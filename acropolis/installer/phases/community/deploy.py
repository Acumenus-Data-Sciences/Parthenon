"""CE Phase 7 — Docker compose up of the infrastructure stack."""
from __future__ import annotations

import sys

from acropolis.installer.deploy import deploy, teardown
from acropolis.installer.network import rollback_network
from acropolis.installer.phases.base import InstallerContext, Phase, PhaseResult


class DeployPhase(Phase):
    """Bring up Traefik, Portainer, pgAdmin, optional EE services."""

    id = "community.deploy"
    order = 700
    depends_on = ["community.network"]
    legacy_state_id = 7

    def run(self, ctx: InstallerContext) -> PhaseResult:
        if ctx.state.is_completed(self.legacy_state_id or -1):
            return PhaseResult(self.id, success=True, skipped=True, message="resumed from state")

        if ctx.edition is None or ctx.config is None:
            return PhaseResult(self.id, success=False, message="edition + config must run first")

        ctx.state.start_phase(self.legacy_state_id or 7)
        ctx.state.save()

        success = deploy(ctx.edition, ctx.console, domain=ctx.config.domain)
        if not success:
            ctx.console.print("[red]Deployment aborted.[/]")
            teardown(ctx.edition, ctx.console)
            rollback_network(ctx.connections, ctx.console)
            sys.exit(1)

        ctx.state.complete_phase(self.legacy_state_id or 7)
        ctx.state.save()
        return PhaseResult(self.id, success=True)
