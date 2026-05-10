"""CE Phase 4 — Service discovery (enumerate Parthenon containers)."""
from __future__ import annotations

from acropolis.installer.discovery import DiscoveredService, discover_services
from acropolis.installer.phases.base import InstallerContext, Phase, PhaseResult


def _service_to_dict(s: DiscoveredService) -> dict:
    return {
        "name": s.name,
        "host": s.host,
        "port": s.port,
        "subdomain": s.subdomain,
        "expose": s.expose,
    }


class DiscoveryPhase(Phase):
    """Enumerate Parthenon services + record them in installer state."""

    id = "community.discovery"
    order = 400
    depends_on = ["community.topology"]
    legacy_state_id = 4

    def run(self, ctx: InstallerContext) -> PhaseResult:
        if ctx.state.is_completed(self.legacy_state_id or -1):
            ctx.services = [
                DiscoveredService(**s)
                for s in ctx.state.data.get("services", [])
            ]
            return PhaseResult(self.id, success=True, skipped=True, message="resumed from state")

        if ctx.topology is None:
            return PhaseResult(self.id, success=False, message="topology must run before discovery")

        ctx.state.start_phase(self.legacy_state_id or 4)
        ctx.state.save()

        services = discover_services(ctx.topology, ctx.console)
        ctx.services = services
        ctx.state.data["services"] = [_service_to_dict(s) for s in services]
        ctx.state.complete_phase(self.legacy_state_id or 4)
        ctx.state.save()
        return PhaseResult(self.id, success=True)
