# Acropolis: Authentik SSO Gateway — Unified Authentication for Enterprise Services

**Date:** 2026-04-02
**Author:** Dr. Sanjay Udoshi
**Status:** Complete
**Phase:** Acropolis Enterprise Stack — SSO Integration

---

## Summary

Deployed Authentik 2026.2.1 as the centralized Single Sign-On (SSO) gateway for all Acropolis enterprise services. Every service in the stack now requires Authentik authentication before granting access, creating a unified security perimeter across 8 services.

## Architecture

```
Internet → Apache (TLS/443) → Traefik (HTTP/8081) → Authentik Forward Auth → Backend Service
                                                          ↓ (unauthenticated)
                                                   302 → auth.acumenus.net
                                                          ↓ (authenticated)
                                                   200 → Backend Service
```

**Key Design Decision:** Apache terminates TLS (Let's Encrypt certificates), Traefik handles internal routing and middleware orchestration, and Authentik's embedded outpost provides forward authentication. This three-layer model keeps TLS management in Apache (where certbot operates) while giving Traefik full control over authentication middleware.

## Services Protected

| Service | URL | Auth Mode | Provider |
|---------|-----|-----------|----------|
| n8n | n8n.acumenus.net | Forward Auth | Proxy Provider |
| Apache Superset | superset.acumenus.net | Forward Auth | Proxy Provider |
| DataHub | datahub.acumenus.net | Forward Auth | Proxy Provider |
| Wazuh SIEM | wazuh.acumenus.net | Forward Auth | Proxy Provider |
| Portainer | portainer.acumenus.net | Forward Auth | Proxy Provider |
| pgAdmin | pgadmin.acumenus.net | Forward Auth | Proxy Provider |
| Grafana | grafana.acumenus.net | Forward Auth + OAuth2 | Proxy + OAuth Provider |
| Authentik | auth.acumenus.net | Native | — |

Grafana has dual authentication: Traefik forward auth for the SSO gate, plus native OAuth2 integration for role mapping (Grafana Admins group → Admin role).

## Infrastructure Changes

### Authentik Upgrade: 2025.2 → 2026.2.1

The existing Authentik 2025.2 instance had a corrupted database — the `authenticatedsession` table had been partially migrated (column `session_key` renamed to `session_id`) but the running code still referenced the old schema. The direct upgrade path from 2025.2 to 2026.2.1 failed due to intermediate schema changes (`group_id` field).

**Resolution:** Fresh database initialization. The Authentik DB contained only 3 users (default AnonymousUser, embedded outpost service account, akadmin) with no configured providers or applications — effectively a fresh install. The DB was dropped and recreated, allowing 2026.2.1 to bootstrap cleanly.

- Image: `ghcr.io/goauthentik/server:2026.2.1`
- Port 9000 mapped to host (Apache proxies to it directly)
- Bootstrap credentials stored in `acropolis/.env`

### Traefik Entrypoint Fix

All service routers were configured for a `websecure` entrypoint that didn't exist in Traefik's static configuration. Since Apache handles TLS termination, Traefik only needs the `web` (HTTP/80) entrypoint.

**Changed:** All `entrypoints=websecure` labels → `entrypoints=web`, removed `tls.certresolver=letsencrypt` labels from all 7 services across `docker-compose.enterprise.yml` and `docker-compose.community.yml`.

### Apache Vhost Rewrite

All 8 Apache SSL vhosts were updated to proxy through Traefik instead of directly to containers:

```
Before: ProxyPass / http://127.0.0.1:{service_port}/
After:  ProxyPass / http://127.0.0.1:8081/
```

Traefik uses the preserved `Host` header (`ProxyPreserveHost On`) to route to the correct backend. This ensures the Authentik forward auth middleware is always invoked.

Services that previously used SSL proxy (Wazuh, Portainer with self-signed certs) no longer need `SSLProxyEngine` — Traefik handles the backend connection.

### Grafana Migration: Parthenon → Acropolis

Grafana was moved from the main Parthenon `docker-compose.yml` to `acropolis/docker-compose.community.yml`. Key considerations:

- **Dual network membership:** `acropolis_network` (for Traefik routing) + `parthenon` (for Prometheus/Loki data sources)
- **Volume preservation:** Uses the existing `parthenon_grafana_data` Docker volume (declared as external) — all dashboards and settings preserved
- **OAuth credentials:** Moved from hardcoded environment vars to `acropolis/.env` (`GRAFANA_OAUTH_CLIENT_ID`, `GRAFANA_OAUTH_CLIENT_SECRET`)
- **Traefik label:** `traefik.docker.network=acropolis_network` ensures Traefik routes via the correct network
- Monitoring stack (Prometheus, Loki, Alloy, cAdvisor, node-exporter) remains in Parthenon compose — these need host-level access for scraping

### Superset psycopg2 Fix

Superset 6.0.0 doesn't bundle `psycopg2`. Container recreation during Traefik label changes lost the runtime-installed package. The Superset image uses a virtualenv (`/app/.venv`) without pip, so standard `pip install` doesn't reach the correct site-packages.

**Solution:** System pip installs to `/app/superset_home/.local/lib/python3.10/site-packages/` (user install), which persists via the `superset_home` volume. Added `PYTHONPATH` environment variable to all three Superset containers (server, worker, beat) so the venv's Python can find the user-installed packages.

```yaml
command: >
  bash -c "pip install psycopg2-binary 2>/dev/null; /app/docker/entrypoints/run-server.sh"
environment:
  - PYTHONPATH=/app/superset_home/.local/lib/python3.10/site-packages
```

## Authentik Configuration

All providers and applications were created via the Authentik REST API (`/api/v3/`):

- **7 Proxy Providers** (forward_single mode) — one per service
- **1 OAuth2 Provider** (confidential client) — Grafana native SSO
- **8 Applications** — each linked to its provider
- **Embedded Outpost** — all 8 proxy providers assigned

The forward auth middleware is defined on the Authentik server container's Traefik labels:

```
traefik.http.middlewares.authentik.forwardauth.address=
  http://acropolis-authentik-server:9000/outpost.goauthentik.io/auth/traefik
```

All services reference this middleware as `authentik@docker`.

## Files Modified

### Acropolis
- `acropolis/docker-compose.enterprise.yml` — Authentik 2026.2.1, port mapping, bootstrap vars, Traefik entrypoint fixes, Superset psycopg2 fix
- `acropolis/docker-compose.community.yml` — Grafana service added, Traefik entrypoint fixes, parthenon network
- `acropolis/traefik/dynamic/parthenon.yml` — Grafana file-provider route removed (Docker labels handle it)
- `acropolis/config/superset/requirements-local.txt` — psycopg2-binary

### Parthenon
- `docker-compose.yml` — Grafana service removed (moved to Acropolis), grafana_data volume removed

### Apache (host)
- `/etc/apache2/sites-available/{n8n,superset,datahub,wazuh,portainer,pgadmin,grafana,auth}.acumenus.net-le-ssl.conf` — All proxying through Traefik on 8081

## Verification

All 8 services return HTTP 302 redirecting to `https://auth.acumenus.net/application/o/authorize/` when accessed without authentication. After Authentik login, requests are proxied through to the backend service with authentication headers.

```
n8n       -> 302 ✓
superset  -> 302 ✓
datahub   -> 302 ✓
wazuh     -> 302 ✓
portainer -> 302 ✓
pgadmin   -> 302 ✓
grafana   -> 302 ✓
auth      -> 302 ✓ (login page)
```

## Lessons Learned

1. **Authentik version jumps require fresh DB** — jumping more than one major version (2025.x → 2026.x) can fail due to intermediate Django migrations. For fresh installs with minimal config, nuke and recreate.

2. **Apache + Traefik + Authentik three-layer model works** — but entrypoints must align. Traefik only needs `web` when Apache handles TLS.

3. **Authentik forward auth requires both provider AND application** — a proxy provider without an associated application returns 404 from the outpost. The outpost resolves providers through their linked applications.

4. **Superset 6.0.0 venv has no pip** — can't install packages into the venv directly. Use system pip with `--target` or user install + `PYTHONPATH`.

5. **Docker `env_file` loads at creation time** — `docker compose restart` does NOT reload env vars. Must `docker compose up -d` to pick up `.env` changes.

## What's Next

- Configure Authentik groups and role-based access policies per service
- Enable MFA (TOTP/WebAuthn) for admin accounts
- Set up Authentik LDAP/SCIM integration if Active Directory is needed
- Create Authentik blueprints for reproducible configuration (export current state)
