# Acropolis Two-Tier Network Topology + Alfresco Authentik SSO

**Date:** 2026-04-10
**Author:** Dr. Sanjay Udoshi
**Status:** Complete — committed as `a11ba5703`
**Impact:** Fleet-wide forward-auth restored (8/8 services returning 302 to Authentik), database tier isolated on `acropolis-backend` network per HIGHSEC §1, Alfresco SSO migrated off Keycloak onto the same forward-auth pattern used by the rest of the fleet

---

## Summary

What started as "get Authentik SSO working for Alfresco and eliminate Keycloak from the value chain" turned into uncovering and fixing a fleet-wide breakage of the Acropolis forward-auth path. The two pieces of work are reported together because the Alfresco SSO work is unshippable without the network fix.

**Two problems fixed in one commit:**

1. **Fleet breakage:** 22 Acropolis containers (all of Authentik, Superset, DataHub, Wazuh, plus Grafana, pgAdmin, Portainer) were stranded on an orphaned docker network (`acropolis_network`, 172.28.0.0/16) while `acropolis-traefik` had been moved to `acumenus` (172.22.0.0/16). The `authentik@docker` forward-auth middleware pointed at `http://acropolis-authentik-server:9000/outpost.goauthentik.io/auth/traefik`, but DNS lookup failed (`SERVFAIL`) and TCP timed out — the middleware had no route. Every gated service was returning HTTP 500. **The "Grafana done (2026-04-03)" memory entry was stale; the pattern had silently broken on 2026-04-08 when the acumenus network was created.**

2. **Alfresco SSO:** The prior "solution" was a 5-hop ouroboros — `Browser → Apache → Authentik LDAP outpost → Keycloak SAML broker → Authentik (again) → Alfresco`. Keycloak existed purely because Alfresco's docs still recommend the EOL'd `alfresco-identity-service` adapter. Community 26.1 supports the `external` auth subsystem natively, which works perfectly with Authentik's existing forward-auth pattern.

## Starting State

```
acumenus (172.22.0.0/16):        acropolis-traefik, acropolis-n8n, alfresco stack, openproject stack, parthenon-php
acropolis_network (172.28.0.0/16, orphan): everything else Acropolis (22 containers)
```

- `curl -H 'Host: grafana.acumenus.net' http://127.0.0.1:8081/` → HTTP 500 (forward-auth fails, Traefik errors out)
- `curl -sI https://grafana.acumenus.net/` → empty, connection closed
- Apache proxied `docs.acumenus.net` directly to `127.0.0.1:18081/18082/18084/18085` — bypassing Traefik entirely
- Keycloak stack running on ports 18086 and 15433
- Authentik LDAP outpost container running on 13389

## Architecture (after)

Two-tier pattern, matching the standard 3-tier ingress/app/backend model:

```
┌──────────────────────────────────────────────────────────┐
│  acumenus (external, shared)                             │
│  ┌─ acropolis-traefik                                    │
│  ├─ authentik-server          ← HTTP ingress             │
│  ├─ superset                  ← HTTP ingress             │
│  ├─ datahub-frontend          ← HTTP ingress             │
│  ├─ wazuh-dashboard           ← HTTP ingress             │
│  ├─ grafana (+parthenon net)  ← HTTP ingress             │
│  ├─ pgadmin, portainer, n8n   ← HTTP ingress             │
│  └─ [alfresco/openproject/parthenon-php — unchanged]     │
└──────────────────────────────────────────────────────────┘
┌──────────────────────────────────────────────────────────┐
│  acropolis-backend (internal: true, no external route)   │
│  ┌─ authentik-db, authentik-redis, authentik-worker      │
│  ├─ superset-db, -cache, -worker, -beat                  │
│  ├─ datahub-mysql, -opensearch, -broker,                 │
│  │    -schema-registry, -upgrade, -gms, -actions         │
│  └─ wazuh-manager, wazuh-indexer                         │
└──────────────────────────────────────────────────────────┘
```

Ingress services (`authentik-server`, `superset`, `datahub-frontend`, `wazuh-dashboard`) sit on **both** networks so they can serve HTTP to Traefik on `acumenus` and talk to their DB/Redis/Kafka on `acropolis-backend`. The backend network is declared `internal: true` — Docker installs no NAT rules for it, so nothing on `acumenus` (including alfresco-share, openproject, parthenon-php) can reach `authentik-db:5432`, `superset-db:5432`, `datahub-mysql:3306`, or `datahub-opensearch:9200` even at the IP level.

This satisfies HIGHSEC §1.1 (principle of least privilege). An attacker who compromises alfresco-share (public-facing CMS, plugin ecosystem, historical CVE count) can no longer pivot to internal databases.

## Changes

### `acropolis/docker-compose.base.yml`

```yaml
networks:
  # Ingress network — shared with Alfresco, OpenProject, parthenon-php.
  acropolis:
    external: true
    name: acumenus
  # Backend tier — DB, Redis, Kafka, OpenSearch, Celery workers.
  # internal: true disables NAT rules — not reachable from acumenus.
  backend:
    name: acropolis-backend
    driver: bridge
    internal: true
  parthenon:
    external: true
    name: parthenon
```

### `acropolis/docker-compose.enterprise.yml`

Every service's `networks:` block re-tiered. Summary:

| Service | Before | After |
|---|---|---|
| n8n | acropolis | acropolis |
| superset-db, -cache, -worker, -beat | acropolis | **backend** |
| superset | acropolis | **acropolis + backend** |
| datahub-mysql, -opensearch, -broker, -schema-registry, -upgrade, -gms, -actions | acropolis | **backend** |
| datahub-frontend | acropolis | **acropolis + backend** |
| authentik-db, -redis, -worker | acropolis | **backend** |
| authentik-server | acropolis | **acropolis + backend** |
| wazuh-manager, -indexer | acropolis (aliases) | **backend** (aliases) |
| wazuh-dashboard | acropolis (aliases) | **acropolis + backend** (aliases) |

Also included: an unrelated but small n8n env-var fix that was already in the working tree (`N8N_RESTRICT_ENVIRONMENT_VARIABLES_ACCESS` → `N8N_BLOCK_ENV_ACCESS_IN_NODE`).

### `alfresco/docker-compose.sso-authentik.yml` (new, replaces `sso-cutover.yml`)

- `alfresco` (repo) JVM flags: `authentication.chain=external1:external,alfrescoNtlm1:alfrescoNtlm`, `external.authentication.enabled=true`, `external.authentication.proxyHeader=X-authentik-username`, `synchronization.autoCreatePeopleOnLogin=true`
- Traefik labels on all four Alfresco containers (repo, share, content-app, control-center) with `Host(docs.acumenus.net)` + `PathPrefix` rules, all gated by `middlewares=authentik@docker`
- `alfresco-share` entrypoint wrapper to work around an image bug: `substituter.sh` runs `sed -i` on `share-config-custom.xml`, which fails with EBUSY if the file is a docker bind-mount (`rename(2)` can't replace a bind-mount target). The wrapper `cp`s the staged file into the real `web-extension/` path before calling `substituter.sh`.
- Root-redirect middleware: `docs.acumenus.net/` → `/share/` (preserving the old Apache `RedirectMatch` behavior)
- PathPrefix strip middlewares for `/content-app` and `/control-center`

### `alfresco/config/sso/share/share-config-custom.xml` (new)

- `alfrescoHeader` connector with `<userHeader>X-authentik-username</userHeader>`
- Endpoint with `<external-auth>true</external-auth>`
- `<logout-url>` pointing at `/outpost.goauthentik.io/sign_out?rd=https://docs.acumenus.net/share/page/` so Share's logout button kills both the Share and Authentik sessions
- CSRFPolicy block with empty `<referer></referer>` / `<origin></origin>` markers so `substituter.sh` has something to fill from env vars

### `alfresco/scripts/configure_authentik.py` (new)

Standalone stdlib-only idempotent provisioner that creates:

1. **Proxy Provider** "Alfresco Forward Auth" (mode: `forward_single`, external_host: `https://docs.acumenus.net`)
2. **Application** slug=`alfresco`, bound to the proxy provider
3. **Outpost binding** — adds the provider PK to the embedded outpost's provider list

Token is read from CLI arg, `AUTHENTIK_BOOTSTRAP_TOKEN` env var, or `acropolis/.env`. Not added to `acropolis/installer/authentik.py` because Alfresco is an internal Acumenus service, not a Parthenon product component (per the 2026-04-08 correction).

### `/etc/apache2/sites-enabled/docs.acumenus.net-le-ssl.conf` (modified, not in git)

- `ProxyPass /` changed from direct-to-container (`127.0.0.1:18081` etc.) to `127.0.0.1:8081` (acropolis-traefik)
- Added `RequestHeader unset X-Authentik-* early` for all Authentik-emitted headers — **critical spoof defense**, must run before any proxy

## Execution Timeline

| Time | Event |
|---|---|
| 22:30 | Diagnose: 22 stranded containers on orphaned network, forward-auth broken fleet-wide |
| 22:45 | Design: two-tier topology with `acropolis-backend` internal network |
| 22:55 | Edit `docker-compose.base.yml` + `docker-compose.enterprise.yml` (1 replace_all + 5 individual fixups + 3 wazuh tweaks) |
| 23:05 | `docker compose config` validation clean — 9 ingress + 4 hybrid + 15 backend-only |
| 23:10 | `docker compose up -d` — 1:43 outage, all 22 containers recreated onto correct networks, orphan net removed |
| 23:15 | Smoke test: Grafana/Superset/DataHub/Wazuh/pgAdmin/Portainer/n8n all 302 to Authentik |
| 23:20 | Write `share-config-custom.xml` + `docker-compose.sso-authentik.yml` + `configure_authentik.py` |
| 23:33 | Run provisioner: provider pk=34 created, app `alfresco` bound, embedded outpost 7→8 providers |
| 23:35 | Apply Alfresco overlay — first attempt fails (bind-mount sed EBUSY) |
| 23:40 | Fix with entrypoint wrapper that cp's from staging path |
| 23:50 | Traefik sees `alfresco-share@docker` router, all 4 Alfresco routes return 302 |
| 23:55 | Reroute Apache `docs.acumenus.net` vhost + spoof scrub headers |
| 23:58 | Header spoofing acceptance test: 5 attempts (admin/root/administrator/ceo/superuser) all blocked |
| 23:59 | `docker compose -f base -f sso-prereqs down` accidentally takes down Alfresco too; 40s recovery |
| 00:30 | Revoke Authentik LDAP outpost + service accounts (cascade delete) |
| 00:35 | Scrub `alfresco/.env` (28→8 lines), scrub hardcoded client secret in realm-import JSON |
| 00:45 | Un-gitignore `alfresco/` (keep `alfresco/.env` ignored), selective stage, commit as `a11ba5703` |
| 00:50 | OIDC flow verification — Grafana and Alfresco both drive full authorize → flow chain successfully |

Total wall time: ~2.5 hours from first hypothesis to signed commit.

## Verification

### Fleet forward-auth smoke test

```
$ for svc in grafana superset datahub wazuh pgadmin portainer n8n; do
    curl -sI -o /dev/null -w '%{http_code}\n' -H "Host: ${svc}.acumenus.net" http://127.0.0.1:8081/
  done
302  grafana
302  superset
302  datahub
302  wazuh
302  pgadmin
302  portainer
302  n8n
```

### Header spoofing acceptance test (Alfresco)

```
$ for u in admin root administrator ceo superuser; do
    curl -sI -o /dev/null -w '%{http_code}\n' \
      -H "X-authentik-username: ${u}" \
      https://docs.acumenus.net/share/page/
  done
302  admin         (redirected to Authentik login, NOT granted)
302  root
302  administrator
302  ceo
302  superuser
```

### Backend isolation test

```
$ docker exec alfresco-share getent hosts acropolis-authentik-db
(exit 2, "not found")
```

### End-to-end OIDC flow (curl simulation)

```
Grafana:  grafana.acumenus.net/  -> 302 (authorize) -> 302 (flow) -> 200 (login page, 6879 bytes)
Alfresco: docs.acumenus.net/share/page/ -> 302 (authorize) -> 302 (flow) -> 200 (login page, 6879 bytes)
```

Both drive the full OAuth2 authorize + flow executor chain. Real browser login requires human credentials but client registration, redirect chain, and Authentik flow renderer are all validated.

## Incidents Along the Way

### 1. `substituter.sh` + bind-mounted single file = EBUSY

**Symptom:** `alfresco-share` crash-looped with `sed: cannot rename ... Device or resource busy` in logs.

**Cause:** Alfresco Share's entrypoint (`substituter.sh`) runs multiple `sed -i` operations on `share-config-custom.xml` to substitute `REPO_HOST`, `REPO_PORT`, and CSRF env vars. `sed -i` implements atomic in-place editing by writing a tempfile and calling `rename(2)` on it. Linux's `rename(2)` fails with `EBUSY` if the destination is a docker bind-mount target — the kernel holds the mount on that inode.

**Fix:** Bind-mount the XML to a staging path (`/config/share-config-custom.xml`) and override the entrypoint to `cp` it into the real `web-extension/` directory before executing `substituter.sh`:

```yaml
entrypoint:
  - sh
  - -c
  - 'cp /config/share-config-custom.xml /usr/local/tomcat/shared/classes/alfresco/web-extension/share-config-custom.xml && exec /usr/local/tomcat/shared/classes/alfresco/substituter.sh "catalina.sh run"'
```

`sed -i` now operates on a regular file (not a bind-mount target), rename succeeds, container boots normally.

Saved as `feedback_bind_mount_sed_rename.md` in global memory.

### 2. Accidental full-Alfresco teardown

**Command run:** `docker compose -f docker-compose.yml -f docker-compose.sso-prereqs.yml down` — intended to stop only the Keycloak stack defined in `sso-prereqs.yml`.

**What actually happened:** Docker Compose interpreted the two files as the union of services for the project and stopped **everything** — all 8 Alfresco containers plus the 3 Keycloak containers. ~40s unplanned outage on Alfresco while recovering.

**Recovery:** `docker compose -f docker-compose.yml -f docker-compose.sso-authentik.yml up -d` — all 8 Alfresco containers back up, external volumes preserved data, SSO chain immediately functional again.

**Lesson:** To stop a subset of services, use `docker stop svc1 svc2 svc3` or `docker compose stop service_name`, never `docker compose -f base -f overlay down`. Saved as `feedback_compose_down_scope.md` in global memory.

## What Got Retired

- `docker-compose.sso-prereqs.yml` (Keycloak 26.5.5 + Keycloak postgres + Authentik LDAP outpost) — containers removed, volume `acropolis_alfresco_keycloak_db_data` retained for safety
- `docker-compose.sso-cutover.yml` (identity-service + AIMS + LDAP sync JVM flags) — retained as historical reference but not applied
- `config/sso/keycloak/realm-import/alfresco-realm.json` — retained with hardcoded secret replaced by `${ALFRESCO_IDENTITY_CLIENT_SECRET}` placeholder
- Authentik **Alfresco LDAP Outpost** (pk=`7a659eed-e77e-4008-9e49-a3ef0de1f220`) — deleted via API
- Authentik **`ak-outpost-7a659...`** service account — cascade-deleted
- Authentik **`alfresco-sync`** user (LDAP bind identity) — deleted via API
- `alfresco/.env` secrets — `ALFRESCO_KEYCLOAK_*`, `ALFRESCO_IDENTITY_*`, `ALFRESCO_LDAP_SYNC_*`, `AUTHENTIK_LDAP_OUTPOST_TOKEN` all scrubbed

## What Got Preserved (v1.2 Reference)

The user committed to migrating the Acropolis Enterprise SSO layer from Authentik to Keycloak in v1.2 (see `ROADMAP.md` and `project_keycloak_vs_authentik_decision.md` in memory). The retired artifacts are retained as working references for that migration:

- `alfresco/docker-compose.sso-cutover.yml` — shows the identity-service / AIMS JVM flag shape
- `alfresco/config/sso/keycloak/realm-import/alfresco-realm.json` — shows the Keycloak realm + clients + Authentik SAML broker config
- `alfresco/SSO-PREREQS.md` — documents the staging architecture
- `alfresco/apache/ids.acumenus.net*.conf` — Apache vhost for the Keycloak endpoint

When v1.2 rolls around, these serve as a proven starting point — the Keycloak realm config was confirmed functional before retirement, just architecturally needless for Alfresco Community's `external` auth path.

## Memories Saved

- `project_acropolis_network_topology.md` — two-tier pattern design, when to apply, verification commands
- `project_alfresco_authentik_sso.md` — full Alfresco SSO architecture, gotchas, rollback path
- `feedback_compose_down_scope.md` — `docker compose -f base -f overlay down` nukes both stacks
- `feedback_bind_mount_sed_rename.md` — `sed -i` + bind-mount = EBUSY, use staging path pattern

## Files Changed

```
.gitignore                                                       |   5 +-
acropolis/docker-compose.base.yml                                |  21 +-
acropolis/docker-compose.enterprise.yml                          |  44 +-
alfresco/.env.example                                            |  30 +
alfresco/README.md                                               |  35 +
alfresco/SSO-PREREQS.md                                          |  85 ++
alfresco/apache/ids.acumenus.net-le-ssl.conf                     |  26 +
alfresco/apache/ids.acumenus.net.conf                            |  17 +
alfresco/config/sso/acs/alfresco-global.sso.properties.example   |  27 +
alfresco/config/sso/keycloak/realm-import/README.md              |  15 +
alfresco/config/sso/keycloak/realm-import/alfresco-realm.json    |  89 ++
alfresco/config/sso/share/share-config-custom.xml                | 114 +++
alfresco/config/sso/share/share-config.properties.example        |  10 +
alfresco/docker-compose.sso-authentik.yml                        | 127 +++
alfresco/docker-compose.sso-cutover.yml                          |  78 ++
alfresco/docker-compose.sso-prereqs.yml                          |  94 ++
alfresco/docker-compose.yml                                      | 240 ++++++
alfresco/scripts/configure_authentik.py                          | 311 +++++++
18 files changed, 1350 insertions(+), 19 deletions(-)
```

## Next Steps

- **v1.1**: monitor the network topology in production; no follow-up needed
- **v1.2**: author detailed Keycloak migration plan (prerequisite for v1.2 release) — this work validates the `external`-auth header-based pattern transfers cleanly to oauth2-proxy in front of Keycloak
- **Unrelated**: `acropolis/installer/authentik.py` in the working tree adds OpenProject as a native OIDC service. Per the 2026-04-08 rule that OpenProject is Acumenus internal (not an Acropolis product component), that change is flagged for user review and was deliberately excluded from this commit
