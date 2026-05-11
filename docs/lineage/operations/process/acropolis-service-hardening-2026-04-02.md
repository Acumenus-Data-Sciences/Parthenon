# Acropolis Service Hardening — 2026-04-02

## Context

After deploying the full Acropolis enterprise stack (Traefik, Authentik SSO, Wazuh, Superset, DataHub, n8n, Portainer, pgAdmin, Grafana), several services were unreachable through the reverse proxy and one container was in a crash loop. A comprehensive audit and fix session ensured all 49 containers and 23 Traefik routes are operational.

## Issues Found & Fixed

### 1. Wazuh Dashboard — 502 Bad Gateway

**Root cause:** The Wazuh dashboard serves HTTPS on port 5601 (self-signed TLS certs), but Traefik was connecting via plain HTTP.

**Fix:** Added two Docker labels in `docker-compose.enterprise.yml`:
- `traefik.http.services.wazuh.loadbalancer.server.scheme=https`
- `traefik.http.services.wazuh.loadbalancer.serversTransport=insecureTransport@file`

The `insecureTransport` was already defined in `traefik/dynamic/acropolis.yml` for Portainer (which also uses self-signed HTTPS).

### 2. Hecate Semantic Search — 502 Bad Gateway

**Root cause:** Traefik config in `traefik/dynamic/parthenon.yml` pointed to port 8088, but Hecate (Rust binary) actually listens on port **8080**.

**Fix:** Changed URL from `http://parthenon-hecate:8088` to `http://parthenon-hecate:8080`.

### 3. Morpheus Ingest — 502 Bad Gateway

**Root cause:** Traefik config pointed to port 8000, but the Morpheus FastAPI service runs on port **8004** (set in its Dockerfile CMD).

**Fix:** Changed URL from `http://parthenon-morpheus-ingest:8000` to `http://parthenon-morpheus-ingest:8004`.

### 4. Superset Beat — Unhealthy

**Root cause:** The celery beat container inherited the base Superset image's healthcheck which curls `localhost:8088`. Beat is a scheduler process with no HTTP server — the check always fails.

**Fix:** Added an explicit healthcheck that verifies the celery beat PID file exists and the process is alive:
```yaml
healthcheck:
  test: ["CMD-SHELL", "test -f /tmp/celerybeat.pid && kill -0 $(cat /tmp/celerybeat.pid)"]
```

### 5. Poseidon Daemon — Crash Loop (Exit Code 2)

**Root cause:** The Docker image contained a stale entrypoint.sh that ran `dbt deps` directly on the read-only volume mount (`./poseidon:/app/poseidon`). The updated entrypoint copies the dbt project to a writable directory first, but the image was never rebuilt after the fix.

**Fix:** Rebuilt the image with `docker compose build --no-cache poseidon-daemon` to pick up the corrected entrypoint that copies dbt files to `$DAGSTER_HOME/dbt_work` before running `dbt deps`.

## Verification

### Route Audit — 23/23 Passing

**Acropolis (8 services, Authentik SSO):**
| Service | URL | Status |
|---------|-----|--------|
| Authentik | auth.acumenus.net | 302 (SSO) |
| Portainer | portainer.acumenus.net | 302 (SSO) |
| pgAdmin | pgadmin.acumenus.net | 302 (SSO) |
| Grafana | grafana.acumenus.net | 302 (SSO) |
| n8n | n8n.acumenus.net | 302 (SSO) |
| Superset | superset.acumenus.net | 302 (SSO) |
| DataHub | datahub.acumenus.net | 302 (SSO) |
| Wazuh | wazuh.acumenus.net | 302 (SSO) |

**Parthenon (15 services, dynamic Traefik config):**
| Service | URL | Status |
|---------|-----|--------|
| Parthenon | parthenon.acumenus.net | 200 |
| Poseidon | poseidon.acumenus.net | 200 |
| Morpheus | morpheus.acumenus.net/health | 200 |
| AI Service | ai.acumenus.net/health | 200 |
| FinnGen | finngen.acumenus.net/health | 200 |
| FHIR-to-CDM | fhir.acumenus.net/health | 200 |
| Darkstar | darkstar.acumenus.net/__docs__/ | 200 |
| Prometheus | prometheus.acumenus.net | 302 (redirect) |
| Solr | solr.acumenus.net | 302 (redirect) |
| Orthanc | orthanc.acumenus.net | 401 (auth) |
| Study Agent | study-agent.acumenus.net | 404 (no root) |
| Hecate | hecate.acumenus.net | 404 (no root) |
| BlackRabbit | blackrabbit.acumenus.net | 404 (no root) |
| JupyterHub | jupyter.acumenus.net | 404 (no root) |
| WebSocket | ws.acumenus.net | 404 (no root) |

### Container Health — 49 Running, 0 Unhealthy, 0 Restarting

All containers with healthchecks report healthy. All `restart: unless-stopped` policies ensure services survive reboot.

## Reboot Survival

All services have `restart: unless-stopped` in their compose files. Docker daemon is enabled as a systemd service. After reboot:

1. Docker starts automatically
2. All containers restart in dependency order
3. Traefik picks up both Docker labels and file-based dynamic config
4. Authentik SSO middleware gates all Acropolis services

To verify after reboot:
```bash
cd /home/smudoshi/Github/Parthenon/acropolis
docker compose -f docker-compose.community.yml -f docker-compose.enterprise.yml ps
cd /home/smudoshi/Github/Parthenon
docker compose ps
```

## Files Modified

- `acropolis/docker-compose.enterprise.yml` — Wazuh HTTPS labels, superset-beat healthcheck
- `acropolis/traefik/dynamic/parthenon.yml` — Hecate port 8080, Morpheus port 8004
- `poseidon/docker/poseidon/entrypoint.sh` — Already correct on disk (rebuilt image to match)
