"""CE Phase 1 — Preflight checks (Docker, ports, disk)."""
from __future__ import annotations

import sys

import questionary

from acropolis.installer.phases.base import InstallerContext, Phase, PhaseResult
from acropolis.installer.preflight import (
    display_results,
    has_failures,
    has_warnings,
    run_preflight,
)


class PreflightPhase(Phase):
    """Validate the host before touching anything."""

    id = "community.preflight"
    order = 100
    legacy_state_id = 1

    def run(self, ctx: InstallerContext) -> PhaseResult:
        if ctx.state.is_completed(self.legacy_state_id or -1):
            return PhaseResult(self.id, success=True, skipped=True, message="already completed (resumed)")

        ctx.console.print("\n[bold cyan]Phase 1: Preflight Checks[/]\n")
        ctx.state.start_phase(self.legacy_state_id or 1)
        ctx.state.save()

        results = run_preflight()
        display_results(results, ctx.console)

        if has_failures(results):
            ctx.console.print("[red]Fix the issues above before continuing.[/]")
            sys.exit(1)

        if has_warnings(results):
            if not questionary.confirm(
                "Warnings detected. Continue?", default=True
            ).ask():
                sys.exit(0)

        ctx.state.complete_phase(self.legacy_state_id or 1)
        ctx.state.save()
        return PhaseResult(self.id, success=True)
