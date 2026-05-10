"""CE Phase 9 — Smoke tests + day-2 CLI generator + state cleanup."""
from __future__ import annotations

from acropolis.installer.generator import write_acropolis_sh
from acropolis.installer.phases.base import InstallerContext, Phase, PhaseResult
from acropolis.installer.verify import display_summary, run_smoke_tests
from acropolis.installer.version import write_version


class VerifyPhase(Phase):
    """Run smoke tests, write the day-2 ``acropolis.sh`` helper, clear state."""

    id = "community.verify"
    order = 900
    depends_on = ["community.traefik"]
    legacy_state_id = 9

    def run(self, ctx: InstallerContext) -> PhaseResult:
        if ctx.config is None or ctx.edition is None or ctx.topology is None:
            return PhaseResult(self.id, success=False, message="topology + edition + config must run first")

        ctx.state.start_phase(self.legacy_state_id or 9)
        ctx.state.save()

        passed, failed, skipped = run_smoke_tests(
            ctx.config, ctx.edition, ctx.services, ctx.console
        )
        ctx.smoke_passed = passed
        ctx.smoke_failed = failed
        ctx.smoke_skipped = skipped

        service_names = [s.name for s in ctx.services if s.expose]
        write_acropolis_sh(
            tier=ctx.edition.tier,
            domain=ctx.config.domain,
            topology_mode=ctx.topology.mode,
            services=service_names,
            parthenon_path=ctx.topology.parthenon_path,
            parthenon_url=ctx.topology.parthenon_url,
            parthenon_network=ctx.topology.parthenon_network,
            console=ctx.console,
        )

        display_summary(
            ctx.config,
            ctx.topology,
            ctx.edition,
            ctx.services,
            passed,
            failed,
            skipped,
            ctx.console,
        )

        write_version(edition=ctx.edition.tier)
        ctx.state.clear()
        return PhaseResult(self.id, success=True)
