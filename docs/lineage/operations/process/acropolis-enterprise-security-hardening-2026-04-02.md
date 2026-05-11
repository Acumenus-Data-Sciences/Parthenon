# Acropolis Enterprise Deployment & Security Hardening

**Date:** 2026-04-02
**Scope:** Infrastructure, Security, SSO, Firewall

---

## Summary

Deployed the full Acropolis Enterprise stack (8 services), configured Authentik SSO across all services, deployed Wazuh SIEM with active response, and hardened the host firewall. This establishes the security foundation for the Parthenon platform.

## Acropolis Enterprise Services Deployed

All services are running as Docker containers managed by the Acropolis compose stack (`docker-compose.base.yml` + `community.yml` + `enterprise.yml` + `local.yml`). Apache serves as the reverse proxy with Let's Encrypt TLS termination.

| Service | Image | Purpose | URL |
|---------|-------|---------|-----|
| **Authentik** | goauthentik/server:2025.2 | SSO / Identity Provider | https://auth.acumenus.net |
| **Wazuh** | wazuh/wazuh-*:4.14.4 | SIEM / XDR (3 containers) | https://wazuh.acumenus.net |
| **Grafana** | grafana/grafana:11.4.0 | Monitoring dashboards | https://grafana.acumenus.net |
| **n8n** | n8nio/n8n:latest | Workflow automation | https://n8n.acumenus.net |
| **Superset** | apache/superset:4.1.2 | BI / Analytics (5 containers) | https://superset.acumenus.net |
| **DataHub** | acryldata/datahub-*:v0.15.0 | Data catalog (5 containers) | https://datahub.acumenus.net |
| **Portainer** | portainer/portainer-ce:2.25.1 | Container management | https://portainer.acumenus.net |
| **pgAdmin** | dpage/pgadmin4:9 | PostgreSQL admin | https://pgadmin.acumenus.net |

Total: 21 Acropolis containers.

## Authentik SSO Integration

Centralized authentication via Authentik for all Acropolis services. Each service uses the most capable auth method it supports:

| Service | SSO Method | Integration |
|---------|-----------|-------------|
| Grafana | Native OIDC (auto-redirect) | `GF_AUTH_GENERIC_OAUTH_*` env vars |
| Superset | Native OIDC | `superset_config.py` + `AUTH_OAUTH` + `CustomSsoSecurityManager` |
| DataHub | Native OIDC | `AUTH_OIDC_*` env vars on frontend container |
| pgAdmin | Native OIDC | `config_local.py` with `OAUTH2_CONFIG` |
| n8n | Forward-auth proxy | Traefik `authentik@docker` middleware (CE limitation) |
| Wazuh | Native SAML | Indexer `config.yml` + dashboard `opensearch_dashboards.yml` |
| Portainer | Native OAuth2 | Configured via UI (no env var support) |

### Key Configuration Details

- **Authentik providers and applications** created programmatically via the Authentik API (`/api/v3/providers/oauth2/`, `/api/v3/providers/saml/`, `/api/v3/core/applications/`)
- **SAML metadata** for Wazuh downloaded as XML file and mounted into the indexer container (`metadata_file` approach, not `metadata_url` — Authentik's runtime metadata endpoint had issues)
- **Wazuh SAML** required `securityadmin.sh` to apply the security config after container creation
- **Proxy awareness**: All Apache SSL vhosts require `RequestHeader set X-Forwarded-Proto "https"` for services behind the reverse proxy. Authentik additionally requires `AUTHENTIK_LISTEN__TRUSTED_PROXY_CIDRS: 0.0.0.0/0` since Apache's requests arrive from the public IP, not a private Docker network IP.
- **Superset** needs both `ENABLE_PROXY_FIX = True` and `authlib` pip package (not included in the official image — installed via command override in `docker-compose.local.yml`)

### Credentials Location

All OAuth2 client IDs and secrets stored in `acropolis/.env` under the `# Authentik SSO` section. Grafana credentials hardcoded in `docker-compose.yml` because the `env_file` mechanism doesn't feed into `${}` variable substitution in compose environment blocks.

## Wazuh SIEM Deployment

Three-container stack: Manager (event processing, API), Indexer (OpenSearch-based search), Dashboard (Kibana fork).

### Agent Deployment

- `beastmode` registered as Agent 001
- Ubuntu 24.04 CIS benchmark installed (`cis_ubuntu24-04.yml`) — closest match for Ubuntu 25.10
- SCA scanning enabled on agent startup

### Active Response (Auto-Remediation)

Configured in `wazuh_manager.conf`:

| Trigger | Action | Duration |
|---------|--------|----------|
| Rule 5763 (SSH brute force — 8+ failures) | `firewall-drop` | 30min, escalating (1h, 2h, 12h, 24h) |
| Rules 31151-31163 (Web attacks — SQLi, XSS, path traversal) | `firewall-drop` | 1 hour |

## Firewall Hardening

UFW configured with deny-all-incoming policy. Only three ports exposed:

| Port | Protocol | Purpose |
|------|----------|---------|
| 22 | TCP (rate-limited) | SSH |
| 80 | TCP | HTTP (Apache + Let's Encrypt ACME) |
| 443 | TCP | HTTPS (Apache reverse proxy for ALL services) |

Prior state: ~60 Docker-mapped ports exposed directly to the internet (Redis, PostgreSQL, Solr, Qdrant, etc.). All now blocked — services accessible only through Apache's authenticated reverse proxy.

## System Health Dashboard

The Parthenon System Health page was updated to segregate Parthenon and Acropolis services:

- **Backend**: Added `TIER_ACROPOLIS = 'Acropolis Infrastructure'` tier with 8 health checkers (Authentik, Wazuh, n8n, Superset, DataHub, Portainer, pgAdmin, Grafana)
- **Frontend**: Added `Building2` icon for Acropolis tier, external launch links for Acropolis cards (open in new tab instead of internal detail page)
- Health checks use `host.docker.internal` to reach services from the PHP container

## Files Modified

### Acropolis Infrastructure
- `acropolis/.env` — Domain, passwords, SSO credentials
- `acropolis/docker-compose.enterprise.yml` — DataHub OIDC, Superset env vars, Authentik HTTPS config, Wazuh SAML mounts, active response
- `acropolis/docker-compose.community.yml` — pgAdmin OAuth2 config
- `acropolis/docker-compose.local.yml` — Port mappings, psycopg2+authlib installs
- `acropolis/traefik/traefik.yml` — Internal routing config
- `acropolis/traefik/dynamic/parthenon.yml` — Parthenon service routes (acumenus.net domain)
- `acropolis/traefik/dynamic/acropolis.yml` — Shared transport config

### Service Configs
- `acropolis/config/superset/superset_config.py` — `ENABLE_PROXY_FIX`, Authentik OAuth, `CustomSsoSecurityManager`
- `acropolis/config/pgadmin/config_local.py` — New file, OAuth2 config for Authentik
- `acropolis/config/wazuh/wazuh_cluster/wazuh_manager.conf` — Active response rules
- `acropolis/config/wazuh/wazuh_indexer/config.yml` — SAML auth domain config
- `acropolis/config/wazuh/wazuh_indexer/roles_mapping.yml` — SAML role mappings
- `acropolis/config/wazuh/wazuh_indexer/idp-metadata.xml` — Authentik SAML metadata
- `acropolis/config/wazuh/wazuh_dashboard/opensearch_dashboards.yml` — SAML auth type
- `acropolis/config/wazuh/wazuh_dashboard/wazuh.yml` — Manager API credentials

### Parthenon Application
- `docker-compose.yml` — Grafana OIDC env vars, port mapping
- `backend/app/Http/Controllers/Api/V1/Admin/SystemHealthController.php` — Acropolis tier + 8 health checkers
- `frontend/src/features/administration/pages/SystemHealthPage.tsx` — Acropolis tier UI, external links

### Apache Vhosts (host system)
- `/etc/apache2/sites-enabled/auth.acumenus.net-le-ssl.conf` — `X-Forwarded-Proto` headers
- `/etc/apache2/sites-enabled/grafana.acumenus.net-le-ssl.conf` — New vhost
- All SSL vhosts — Added `X-Forwarded-Proto` and `X-Forwarded-Ssl` headers

## Lessons Learned

1. **Authentik `AUTHENTIK_LISTEN__TRUSTED_PROXY_CIDRS`** is critical when Apache proxies from a public IP. Without it, Authentik ignores `X-Forwarded-Proto` and generates `http://` URLs, causing mixed-content errors.

2. **Docker Compose `env_file` vs `${}`**: Variables loaded via `env_file` are injected into the container environment but do NOT participate in `${}` interpolation in the compose file itself. Use hardcoded values or the project-level `.env` for interpolation.

3. **Superset 4.1.2** doesn't include `psycopg2-binary` or `authlib` — both must be installed at runtime via command override.

4. **Wazuh SAML `exchange_key`** must be a 64-char hex string (post-4.9). Using the X.509 cert blob (pre-4.9 format) causes `Illegal base64 character` errors.

5. **Wazuh SAML metadata**: Use `metadata_file` (downloaded XML) instead of `metadata_url` (runtime fetch). The runtime endpoint can return empty if the Authentik application isn't properly linked to the SAML provider.

6. **`docker compose restart` does NOT reload `env_file`** — must use `docker compose up -d` to recreate containers with new environment variables.
