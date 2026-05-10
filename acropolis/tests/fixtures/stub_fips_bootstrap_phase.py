"""Pluggability fixture — proves an EE-style phase plugs in without CE patches."""
from __future__ import annotations

from acropolis.installer.phases.base import InstallerContext, Phase, PhaseResult


class StubFipsBootstrapPhase(Phase):
    """Synthetic enterprise phase used in registry tests.

    Mirrors the shape EE's real ``FipsBootstrapPhase`` will take: declares
    ``requires_enterprise=True``, depends on a CE phase (preflight),
    runs at a slot that respects every CE depends_on chain.
    """

    id = "stub.enterprise.fips_bootstrap"
    order = 350
    requires_enterprise = True
    depends_on = ["community.preflight"]

    def run(self, ctx: InstallerContext) -> PhaseResult:
        return PhaseResult(
            self.id,
            success=True,
            message="FIPS provider stub OK",
            diagnostics={"provider": "stub-fips"},
        )
