"""CE Phase 5 — Domain / TLS / credentials and config-file generation."""
from __future__ import annotations

from acropolis.installer.config import (
    InstallConfig,
    collect_config,
    write_credentials_file,
    write_env_file,
    write_pgadmin_servers,
    write_wazuh_configs,
)
from acropolis.installer.phases.base import InstallerContext, Phase, PhaseResult


class ConfigurationPhase(Phase):
    """Collect operator answers and write env/credentials files."""

    id = "community.configuration"
    order = 500
    depends_on = ["community.edition", "community.discovery"]
    legacy_state_id = 5

    def run(self, ctx: InstallerContext) -> PhaseResult:
        if ctx.state.is_completed(self.legacy_state_id or -1):
            cfg = ctx.state.data.get("config", {})
            ctx.config = InstallConfig(
                domain=cfg.get("domain", "acumenus.net"),
                timezone=cfg.get("timezone", "UTC"),
                tls_mode=cfg.get("tls_mode", "letsencrypt"),
                acme_email=cfg.get("acme_email", ""),
                parthenon_admin_email=cfg.get("parthenon_admin_email", ""),
                parthenon_admin_name=cfg.get("parthenon_admin_name", ""),
                parthenon_admin_password=cfg.get("parthenon_admin_password", ""),
            )
            return PhaseResult(self.id, success=True, skipped=True, message="resumed from state")

        if ctx.topology is None or ctx.edition is None:
            return PhaseResult(self.id, success=False, message="topology + edition must run before configuration")

        ctx.state.start_phase(self.legacy_state_id or 5)
        ctx.state.save()

        config = collect_config(ctx.topology, ctx.edition, ctx.console)
        write_env_file(config, ctx.topology, ctx.edition)
        write_credentials_file(config, ctx.edition, ctx.topology)
        if ctx.edition.tier in ("community", "enterprise"):
            write_pgadmin_servers(config)
        if ctx.edition.tier == "enterprise":
            write_wazuh_configs(config)
        ctx.console.print("[green]Configuration files written.[/]")

        ctx.config = config
        ctx.state.data["config"] = {
            "domain": config.domain,
            "timezone": config.timezone,
            "tls_mode": config.tls_mode,
            "acme_email": config.acme_email,
            "parthenon_admin_email": config.parthenon_admin_email,
            "parthenon_admin_name": config.parthenon_admin_name,
            "parthenon_admin_password": config.parthenon_admin_password,
        }
        ctx.state.complete_phase(self.legacy_state_id or 5)
        ctx.state.save()
        return PhaseResult(self.id, success=True)
