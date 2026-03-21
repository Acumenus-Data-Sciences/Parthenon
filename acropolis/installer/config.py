# installer/config.py
"""Phase 5: Configuration — domain, TLS, credentials collection."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import questionary
from rich.console import Console

from acropolis.installer.editions import EditionConfig
from acropolis.installer.topology import TopologyConfig
from acropolis.installer.utils import generate_password, REPO_ROOT


@dataclass
class InstallConfig:
    domain: str = "acumenus.net"
    acme_email: str = ""
    tls_mode: str = "letsencrypt"  # letsencrypt, selfsigned, none
    timezone: str = "UTC"
    parthenon_db_host: str = "host.docker.internal"
    parthenon_db_port: int = 5480
    parthenon_db_name: str = "parthenon"
    parthenon_db_user: str = "parthenon"
    # Per-service credentials
    pgadmin_email: str = ""
    pgadmin_password: str = ""
    portainer_password: str = ""
    n8n_user: str = "admin"
    n8n_password: str = ""
    superset_user: str = "admin"
    superset_password: str = ""
    superset_secret: str = ""
    superset_db_password: str = ""
    datahub_mysql_password: str = ""
    datahub_mysql_root_password: str = ""
    datahub_secret: str = ""
    authentik_secret: str = ""
    authentik_db_password: str = ""
    # Parthenon admin (collected for fresh_install topology)
    parthenon_admin_email: str = ""
    parthenon_admin_name: str = ""
    parthenon_admin_password: str = ""


def _detect_timezone() -> str:
    """Try to detect system timezone."""
    try:
        tz_path = Path("/etc/timezone")
        if tz_path.exists():
            return tz_path.read_text().strip()
        tz_link = Path("/etc/localtime")
        if tz_link.is_symlink():
            target = str(tz_link.resolve())
            if "zoneinfo/" in target:
                return target.split("zoneinfo/")[1]
    except OSError:
        pass
    return os.environ.get("TZ", "UTC")


def _read_parthenon_env(topology: TopologyConfig) -> dict[str, str]:
    """Read Parthenon's .env file for database connection info."""
    env_vars: dict[str, str] = {}
    if topology.parthenon_path:
        env_file = Path(topology.parthenon_path) / ".env"
        if env_file.exists():
            for line in env_file.read_text().splitlines():
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    key, _, value = line.partition("=")
                    env_vars[key.strip()] = value.strip()
    return env_vars


def collect_config(
    topology: TopologyConfig,
    edition: EditionConfig,
    console: Console,
) -> InstallConfig:
    """Phase 5: Collect all configuration."""
    console.print("\n[bold cyan]Phase 5: Configuration[/]\n")

    config = InstallConfig()

    # Domain & TLS
    config.domain = questionary.text("Domain:", default="acumenus.net").ask()
    config.acme_email = questionary.text(
        "ACME email (Let's Encrypt):",
        default=f"admin@{config.domain}",
    ).ask()
    config.tls_mode = questionary.select(
        "TLS mode:",
        choices=[
            questionary.Choice("Let's Encrypt (production)", value="letsencrypt"),
            questionary.Choice("Self-signed (development)", value="selfsigned"),
            questionary.Choice("None (HTTP only)", value="none"),
        ],
        default="letsencrypt",
    ).ask()

    # Timezone
    detected_tz = _detect_timezone()
    config.timezone = questionary.text("Timezone:", default=detected_tz).ask()

    # Auto-populate from Parthenon .env if local
    parthenon_env = _read_parthenon_env(topology)
    if parthenon_env:
        config.parthenon_db_host = "host.docker.internal"
        config.parthenon_db_port = int(parthenon_env.get("POSTGRES_PORT", "5480"))
        config.parthenon_db_name = parthenon_env.get("DB_DATABASE", "parthenon")
        config.parthenon_db_user = parthenon_env.get("DB_USERNAME", "parthenon")
        console.print(
            f"[green]Auto-detected Parthenon DB: "
            f"{config.parthenon_db_user}@:{config.parthenon_db_port}/{config.parthenon_db_name}[/]"
        )

    # Parthenon admin credentials (fresh install only)
    if topology.mode == "fresh_install":
        console.print("\n[bold]Parthenon Admin Account:[/]")
        config.parthenon_admin_email = questionary.text(
            "Parthenon admin email:", default=f"admin@{config.domain}"
        ).ask()
        config.parthenon_admin_name = questionary.text(
            "Parthenon admin name:", default="Administrator"
        ).ask()
        config.parthenon_admin_password = questionary.text(
            "Parthenon admin password:", default=generate_password(16)
        ).ask()

    # Community credentials
    if edition.tier in ("community", "enterprise"):
        console.print("\n[bold]Community Service Credentials:[/]")
        config.pgadmin_email = questionary.text(
            "pgAdmin admin email:", default=f"admin@{config.domain}"
        ).ask()
        config.pgadmin_password = questionary.text(
            "pgAdmin password:", default=generate_password(24)
        ).ask()
        config.portainer_password = questionary.text(
            "Portainer admin password:", default=generate_password(16)
        ).ask()

    # Enterprise credentials
    if edition.tier == "enterprise":
        console.print("\n[bold]Enterprise Service Credentials:[/]")
        config.n8n_user = questionary.text("n8n username:", default="admin").ask()
        config.n8n_password = questionary.text(
            "n8n password:", default=generate_password(16)
        ).ask()
        config.superset_user = questionary.text("Superset admin user:", default="admin").ask()
        config.superset_password = questionary.text(
            "Superset admin password:", default=generate_password(16)
        ).ask()
        config.superset_secret = generate_password(48)
        config.superset_db_password = generate_password(24)
        config.datahub_mysql_password = generate_password(24)
        config.datahub_mysql_root_password = generate_password(24)
        config.datahub_secret = generate_password(32)
        config.authentik_secret = generate_password(48)
        config.authentik_db_password = generate_password(24)

    return config


def write_env_file(
    config: InstallConfig,
    topology: TopologyConfig,
    edition: EditionConfig,
) -> None:
    """Write .env file to repo root."""
    lines = [
        "# Generated by Acropolis Installer",
        f"DOMAIN={config.domain}",
        f"TZ={config.timezone}",
        f"ACROPOLIS_EDITION={edition.tier}",
        "",
        f"PARTHENON_MODE={topology.mode}",
    ]
    if topology.parthenon_path:
        lines.append(f"PARTHENON_PATH={topology.parthenon_path}")
    if topology.parthenon_url:
        lines.append(f"PARTHENON_URL={topology.parthenon_url}")
    if topology.parthenon_network:
        lines.append(f"PARTHENON_NETWORK={topology.parthenon_network}")

    lines.extend([
        "",
        f"TRAEFIK_HTTP_PORT=80",
        f"TRAEFIK_HTTPS_PORT=443",
        f"TRAEFIK_DASHBOARD_PORT=8090",
        f"ACME_EMAIL={config.acme_email}",
        "",
        f"DB_HOST={config.parthenon_db_host}",
        f"DB_PORT={config.parthenon_db_port}",
        f"DB_USER={config.parthenon_db_user}",
        f"DB_NAME={config.parthenon_db_name}",
    ])

    if edition.tier in ("community", "enterprise"):
        lines.extend([
            "",
            f"PGADMIN_EMAIL={config.pgadmin_email}",
            f"PGADMIN_PASSWORD={config.pgadmin_password}",
        ])

    if edition.tier == "enterprise":
        lines.extend([
            "",
            f"N8N_AUTH_USER={config.n8n_user}",
            f"N8N_AUTH_PASSWORD={config.n8n_password}",
            "",
            f"SUPERSET_SECRET_KEY={config.superset_secret}",
            f"SUPERSET_DB_PASSWORD={config.superset_db_password}",
            f"SUPERSET_ADMIN_USER={config.superset_user}",
            f"SUPERSET_ADMIN_PASSWORD={config.superset_password}",
            "",
            f"DATAHUB_MYSQL_PASSWORD={config.datahub_mysql_password}",
            f"DATAHUB_MYSQL_ROOT_PASSWORD={config.datahub_mysql_root_password}",
            f"DATAHUB_SECRET={config.datahub_secret}",
            "",
            f"AUTHENTIK_SECRET_KEY={config.authentik_secret}",
            f"AUTHENTIK_DB_PASSWORD={config.authentik_db_password}",
        ])

    if edition.license_key:
        lines.extend(["", f"ACROPOLIS_LICENSE_KEY={edition.license_key}"])

    env_path = REPO_ROOT / ".env"
    env_path.write_text("\n".join(lines) + "\n")


def write_pgadmin_servers(config: InstallConfig) -> None:
    """Write config/pgadmin/servers.json with Parthenon connection."""
    import json

    servers = {
        "Servers": {
            "1": {
                "Name": "Parthenon (Docker PG 16)",
                "Group": "Acropolis",
                "Host": config.parthenon_db_host,
                "Port": config.parthenon_db_port,
                "MaintenanceDB": config.parthenon_db_name,
                "Username": config.parthenon_db_user,
                "SSLMode": "prefer",
                "Comment": "Parthenon application database",
            }
        }
    }

    servers_path = REPO_ROOT / "config" / "pgadmin" / "servers.json"
    servers_path.parent.mkdir(parents=True, exist_ok=True)
    servers_path.write_text(json.dumps(servers, indent=2) + "\n")


def write_credentials_file(
    config: InstallConfig,
    edition: EditionConfig,
    topology: TopologyConfig,
) -> None:
    """Write .install-credentials file (chmod 0600)."""
    lines = [
        "# Acropolis Installation Credentials",
        "# Generated by installer — DO NOT COMMIT",
        "",
    ]

    if config.parthenon_admin_email:
        lines.extend([
            f"Parthenon: {config.parthenon_admin_email} / {config.parthenon_admin_password}",
            "",
        ])

    if edition.tier in ("community", "enterprise"):
        lines.extend([
            f"pgAdmin: {config.pgadmin_email} / {config.pgadmin_password}",
            f"Portainer: admin / {config.portainer_password}",
        ])

    if edition.tier == "enterprise":
        lines.extend([
            f"n8n: {config.n8n_user} / {config.n8n_password}",
            f"Superset: {config.superset_user} / {config.superset_password}",
            f"DataHub: datahub / {config.datahub_mysql_password}",
            f"Authentik: akadmin / (set on first login)",
        ])

    cred_path = REPO_ROOT / ".install-credentials"
    cred_path.write_text("\n".join(lines) + "\n")
    os.chmod(cred_path, 0o600)


def write_parthenon_defaults(config: InstallConfig, topology: TopologyConfig) -> Optional[Path]:
    """Write a defaults JSON for Parthenon's --defaults-file flag.

    Returns the path to the defaults file, or None if not applicable.
    """
    import json

    if topology.mode != "fresh_install" or not config.parthenon_admin_email:
        return None

    defaults = {
        "admin_email": config.parthenon_admin_email,
        "admin_name": config.parthenon_admin_name,
        "admin_password": config.parthenon_admin_password,
        "app_url": f"https://parthenon.{config.domain}",
        "timezone": config.timezone,
    }

    defaults_path = REPO_ROOT / ".parthenon-defaults.json"
    defaults_path.write_text(json.dumps(defaults, indent=2) + "\n")
    os.chmod(defaults_path, 0o600)
    return defaults_path
