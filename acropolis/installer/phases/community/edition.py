"""CE Phase 3 — Edition selection (community vs enterprise)."""
from __future__ import annotations

from acropolis.installer.editions import EditionConfig, collect_edition
from acropolis.installer.phases.base import InstallerContext, Phase, PhaseResult


class EditionSelectionPhase(Phase):
    """Ask the operator which tier to install."""

    id = "community.edition"
    order = 300
    depends_on = ["community.topology"]
    legacy_state_id = 3

    def run(self, ctx: InstallerContext) -> PhaseResult:
        if ctx.state.is_completed(self.legacy_state_id or -1):
            ed_data = ctx.state.data.get("edition", {})
            ctx.edition = EditionConfig(
                tier=ed_data.get("tier", "community"),
                license_key=ed_data.get("license_key"),
            )
            return PhaseResult(self.id, success=True, skipped=True, message="resumed from state")

        ctx.state.start_phase(self.legacy_state_id or 3)
        ctx.state.save()

        edition = collect_edition(ctx.console)
        ctx.edition = edition
        ctx.state.data["edition"] = {
            "tier": edition.tier,
            "license_key": edition.license_key,
        }
        ctx.state.complete_phase(self.legacy_state_id or 3)
        ctx.state.save()
        return PhaseResult(self.id, success=True)
