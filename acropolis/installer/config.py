# installer/config.py
"""Phase 5: Configuration — domain, TLS, credentials collection."""
from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from textwrap import dedent
from typing import Optional

import questionary
from rich.console import Console

from acropolis.installer.editions import EditionConfig
from acropolis.installer.topology import TopologyConfig
from acropolis.installer.utils import REPO_ROOT, generate_password, generate_wazuh_password


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
    wazuh_api_password: str = ""
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
        config.wazuh_api_password = generate_wazuh_password(24)

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
        bootstrap_token = generate_password(48)
        bootstrap_password = generate_password(32)
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
            f"AUTHENTIK_BOOTSTRAP_EMAIL=akadmin@{config.domain}",
            f"AUTHENTIK_BOOTSTRAP_PASSWORD={bootstrap_password}",
            f"AUTHENTIK_BOOTSTRAP_TOKEN={bootstrap_token}",
            "",
            "# Authentik SSO — OAuth2/OIDC Credentials",
            "# Auto-populated by Authentik bootstrap (Phase 7.5)",
            "AUTHENTIK_GRAFANA_CLIENT_ID=",
            "AUTHENTIK_GRAFANA_CLIENT_SECRET=",
            "GRAFANA_OAUTH_CLIENT_ID=",
            "GRAFANA_OAUTH_CLIENT_SECRET=",
            "AUTHENTIK_SUPERSET_CLIENT_ID=",
            "AUTHENTIK_SUPERSET_CLIENT_SECRET=",
            "AUTHENTIK_DATAHUB_CLIENT_ID=",
            "AUTHENTIK_DATAHUB_CLIENT_SECRET=",
            "AUTHENTIK_PGADMIN_CLIENT_ID=",
            "AUTHENTIK_PGADMIN_CLIENT_SECRET=",
            "AUTHENTIK_PORTAINER_CLIENT_ID=",
            "AUTHENTIK_PORTAINER_CLIENT_SECRET=",
            "",
            "WAZUH_INDEXER_PASSWORD=SecretPassword",
            "WAZUH_DASHBOARD_PASSWORD=kibanaserver",
            f"WAZUH_API_PASSWORD={config.wazuh_api_password}",
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


def write_wazuh_configs(config: InstallConfig) -> None:
    """Write Wazuh single-node config files used by the enterprise stack."""
    wazuh_root = REPO_ROOT / "config" / "wazuh"
    cert_dir = wazuh_root / "certs"
    cert_dir.mkdir(parents=True, exist_ok=True)

    (wazuh_root / "certs.yml").write_text(
        dedent(
            """\
            nodes:
              indexer:
                - name: wazuh.indexer
                  ip: wazuh.indexer

              server:
                - name: wazuh.manager
                  ip: wazuh.manager

              dashboard:
                - name: wazuh.dashboard
                  ip: wazuh.dashboard
            """
        )
    )

    indexer_dir = wazuh_root / "wazuh_indexer"
    indexer_dir.mkdir(parents=True, exist_ok=True)
    (indexer_dir / "wazuh.indexer.yml").write_text(
        dedent(
            """\
            network.host: "0.0.0.0"
            node.name: "wazuh.indexer"
            cluster.name: "wazuh-cluster"
            path.data: /var/lib/wazuh-indexer
            path.logs: /var/log/wazuh-indexer
            discovery.type: single-node
            compatibility.override_main_response_version: true
            plugins.security.ssl.http.pemcert_filepath: /usr/share/wazuh-indexer/config/certs/wazuh.indexer.pem
            plugins.security.ssl.http.pemkey_filepath: /usr/share/wazuh-indexer/config/certs/wazuh.indexer.key
            plugins.security.ssl.http.pemtrustedcas_filepath: /usr/share/wazuh-indexer/config/certs/root-ca.pem
            plugins.security.ssl.transport.pemcert_filepath: /usr/share/wazuh-indexer/config/certs/wazuh.indexer.pem
            plugins.security.ssl.transport.pemkey_filepath: /usr/share/wazuh-indexer/config/certs/wazuh.indexer.key
            plugins.security.ssl.transport.pemtrustedcas_filepath: /usr/share/wazuh-indexer/config/certs/root-ca.pem
            plugins.security.ssl.http.enabled: true
            plugins.security.ssl.transport.enforce_hostname_verification: false
            plugins.security.ssl.transport.resolve_hostname: false
            plugins.security.ssl.http.enabled_ciphers:
              - "TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256"
              - "TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384"
              - "TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256"
              - "TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384"
            plugins.security.ssl.http.enabled_protocols:
              - "TLSv1.2"
            plugins.security.authcz.admin_dn:
              - "CN=admin,OU=Wazuh,O=Wazuh,L=California,C=US"
            plugins.security.check_snapshot_restore_write_privileges: true
            plugins.security.enable_snapshot_restore_privilege: true
            plugins.security.nodes_dn:
              - "CN=wazuh.indexer,OU=Wazuh,O=Wazuh,L=California,C=US"
            plugins.security.restapi.roles_enabled:
              - "all_access"
              - "security_rest_api_access"
            plugins.security.system_indices.enabled: true
            plugins.security.system_indices.indices: [".opendistro-alerting-config", ".opendistro-alerting-alert*", ".opendistro-anomaly-results*", ".opendistro-anomaly-detector*", ".opendistro-anomaly-checkpoints", ".opendistro-anomaly-detection-state", ".opendistro-reports-*", ".opendistro-notifications-*", ".opendistro-notebooks", ".opensearch-observability", ".opendistro-asynchronous-search-response*", ".replication-metadata-store"]
            plugins.security.allow_default_init_securityindex: true
            cluster.routing.allocation.disk.threshold_enabled: false
            """
        )
    )
    (indexer_dir / "internal_users.yml").write_text(
        dedent(
            """\
            ---
            _meta:
              type: "internalusers"
              config_version: 2

            admin:
              hash: "$2y$12$K/SpwjtB.wOHJ/Nc6GVRDuc1h0rM1DfvziFRNPtk27P.c4yDr9njO"
              reserved: true
              backend_roles:
                - "admin"
              description: "Demo admin user"

            kibanaserver:
              hash: "$2a$12$4AcgAt3xwOWadA5s5blL6ev39OXDNhmOesEoo33eZtrq2N0YrU3H."
              reserved: true
              description: "Demo kibanaserver user"

            kibanaro:
              hash: "$2a$12$JJSXNfTowz7Uu5ttXfeYpeYE0arACvcwlPBStB1F.MI7f0U9Z4DGC"
              reserved: false
              backend_roles:
                - "kibanauser"
                - "readall"
              attributes:
                attribute1: "value1"
                attribute2: "value2"
                attribute3: "value3"
              description: "Demo kibanaro user"

            logstash:
              hash: "$2a$12$u1ShR4l4uBS3Uv59Pa2y5.1uQuZBrZtmNfqB3iM/.jL0XoV9sghS2"
              reserved: false
              backend_roles:
                - "logstash"
              description: "Demo logstash user"

            readall:
              hash: "$2a$12$ae4ycwzwvLtZxwZ82RmiEunBbIPiAmGZduBAjKN0TXdwQFtCwARz2"
              reserved: false
              backend_roles:
                - "readall"
              description: "Demo readall user"

            snapshotrestore:
              hash: "$2y$12$DpwmetHKwgYnorbgdvORCenv4NAK8cPUg8AI6pxLCuWf/ALc0.v7W"
              reserved: false
              backend_roles:
                - "snapshotrestore"
              description: "Demo snapshotrestore user"
            """
        )
    )

    dashboard_dir = wazuh_root / "wazuh_dashboard"
    dashboard_dir.mkdir(parents=True, exist_ok=True)
    (dashboard_dir / "opensearch_dashboards.yml").write_text(
        dedent(
            """\
            server.host: 0.0.0.0
            server.port: 5601
            opensearch.hosts: https://wazuh.indexer:9200
            opensearch.ssl.verificationMode: certificate
            opensearch.requestHeadersWhitelist: ["securitytenant","Authorization"]
            opensearch_security.multitenancy.enabled: false
            opensearch_security.readonly_mode.roles: ["kibana_read_only"]
            server.ssl.enabled: true
            server.ssl.key: "/usr/share/wazuh-dashboard/certs/wazuh.dashboard-key.pem"
            server.ssl.certificate: "/usr/share/wazuh-dashboard/certs/wazuh.dashboard.pem"
            opensearch.ssl.certificateAuthorities: ["/usr/share/wazuh-dashboard/certs/root-ca.pem"]
            uiSettings.overrides.defaultRoute: /app/wz-home
            opensearch_security.cookie.ttl: 900000
            opensearch_security.session.ttl: 900000
            opensearch_security.session.keepalive: true
            """
        )
    )
    (dashboard_dir / "wazuh.yml").write_text(
        dedent(
            f"""\
            hosts:
              - 1513629884013:
                  url: "https://wazuh.manager"
                  port: 55000
                  username: wazuh-wui
                  password: "{config.wazuh_api_password}"
                  run_as: true
            """
        )
    )

    cluster_dir = wazuh_root / "wazuh_cluster"
    cluster_dir.mkdir(parents=True, exist_ok=True)
    (cluster_dir / "wazuh_manager.conf").write_text(
        dedent(
            """\
            <ossec_config>
              <global>
                <jsonout_output>yes</jsonout_output>
                <alerts_log>yes</alerts_log>
                <logall>no</logall>
                <logall_json>no</logall_json>
                <email_notification>no</email_notification>
                <smtp_server>smtp.example.wazuh.com</smtp_server>
                <email_from>wazuh@example.wazuh.com</email_from>
                <email_to>recipient@example.wazuh.com</email_to>
                <email_maxperhour>12</email_maxperhour>
                <email_log_source>alerts.log</email_log_source>
                <agents_disconnection_time>10m</agents_disconnection_time>
                <agents_disconnection_alert_time>0</agents_disconnection_alert_time>
              </global>

              <alerts>
                <log_alert_level>3</log_alert_level>
                <email_alert_level>12</email_alert_level>
              </alerts>

              <logging>
                <log_format>plain</log_format>
              </logging>

              <remote>
                <connection>secure</connection>
                <port>1514</port>
                <protocol>tcp</protocol>
                <queue_size>131072</queue_size>
              </remote>

              <wodle name="syscollector">
                <disabled>no</disabled>
                <interval>1h</interval>
                <scan_on_start>yes</scan_on_start>
                <hardware>yes</hardware>
                <os>yes</os>
                <network>yes</network>
                <packages>yes</packages>
                <ports all="yes">yes</ports>
                <processes>yes</processes>
                <synchronization>
                  <max_eps>10</max_eps>
                </synchronization>
              </wodle>

              <sca>
                <enabled>yes</enabled>
                <scan_on_start>yes</scan_on_start>
                <interval>12h</interval>
                <skip_nfs>yes</skip_nfs>
              </sca>

              <vulnerability-detection>
                <enabled>yes</enabled>
                <index-status>yes</index-status>
                <feed-update-interval>60m</feed-update-interval>
              </vulnerability-detection>

              <indexer>
                <enabled>yes</enabled>
                <hosts>
                  <host>https://wazuh.indexer:9200</host>
                </hosts>
                <ssl>
                  <certificate_authorities>
                    <ca>/etc/ssl/root-ca.pem</ca>
                  </certificate_authorities>
                  <certificate>/etc/ssl/filebeat.pem</certificate>
                  <key>/etc/ssl/filebeat.key</key>
                </ssl>
              </indexer>

              <auth>
                <disabled>no</disabled>
                <port>1515</port>
                <use_source_ip>no</use_source_ip>
                <purge>yes</purge>
                <use_password>no</use_password>
                <ssl_verify_host>no</ssl_verify_host>
                <ssl_manager_cert>etc/sslmanager.cert</ssl_manager_cert>
                <ssl_manager_key>etc/sslmanager.key</ssl_manager_key>
                <ssl_auto_negotiate>no</ssl_auto_negotiate>
              </auth>

              <cluster>
                <name>wazuh</name>
                <node_name>node01</node_name>
                <node_type>master</node_type>
                <key>aa093264ef885029653eea20dfcf51ae</key>
                <port>1516</port>
                <bind_addr>0.0.0.0</bind_addr>
                <nodes>
                  <node>wazuh.manager</node>
                </nodes>
                <hidden>no</hidden>
                <disabled>yes</disabled>
              </cluster>

              <localfile>
                <log_format>syslog</log_format>
                <location>/var/ossec/logs/active-responses.log</location>
              </localfile>
            </ossec_config>
            """
        )
    )


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
            "Wazuh Dashboard: admin / SecretPassword",
            f"Wazuh API: wazuh-wui / {config.wazuh_api_password}",
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
