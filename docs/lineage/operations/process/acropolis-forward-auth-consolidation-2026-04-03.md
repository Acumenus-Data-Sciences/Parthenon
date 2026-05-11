# Acropolis: Forward Auth Consolidation & Mission-Critical Hardening

**Date:** 2026-04-03
**Author:** Dr. Sanjay Udoshi
**Status:** Complete
**Impact:** Mission-critical — eliminates 5 failure modes, makes fresh installs work out of the box

---

## Summary

Consolidated Acropolis Enterprise SSO from a fragile dual-auth model (forward auth + native OAuth2/OIDC per service) to a single, uniform forward-auth-only architecture. Identified and fixed 9 issues across 3 layers: live infrastructure, service configuration, and the installer pipeline. The result is a stack that survives cold reboots with zero manual intervention and an installer that produces a working deployment on the first run.

## Problem

After the initial Authentik SSO deployment (2026-04-02), the stack had accumulated technical debt from the integration process:

1. **Dual authentication model** — Each service had both a Traefik forward-auth provider AND a native OAuth2/OIDC provider in Authentik. This created 12 providers (7 proxy + 5 OAuth2) and 11 applications (7 forward-auth + 4 OAuth2 duplicates). The applications competed for the same slugs, the outpost had all 11 providers loaded, and there was no clear "which auth path is canonical?"

2. **DataHub couldn't provision users** — The DataHub frontend was missing `DATAHUB_SYSTEM_CLIENT_ID` and `DATAHUB_SYSTEM_CLIENT_SECRET` environment variables. With `METADATA_SERVICE_AUTH_ENABLED=true` on GMS, every post-OIDC user provisioning call to `/entities` was rejected as unauthenticated: *"Failed to provision user with urn urn:li:corpuser:root@example.com"*.

3. **Wazuh login broken** — The dashboard's `opensearch_dashboards.yml` had `opensearch_security.auth.type: "saml"` set without a matching SAML IdP configured in the OpenSearch indexer, causing every login attempt to return 401. The Wazuh indexer's `config.yml` also had a full SAML auth domain with hardcoded `auth.acumenus.net` URLs.

4. **Traefik orphan risk** — The 4 compose files (base + community + enterprise + local) had to be specified manually on every `docker compose` command. If any file was missed, Traefik would become an orphan container. Running `--remove-orphans` would kill the entire SSO gate.

5. **Installer gaps** — A fresh `install.py` deployment would produce broken DataHub (missing system credentials), default Grafana passwords (admin/changeme), a cluttered `.env` with 12 unused OAuth2 placeholder variables, and no unified compose entrypoint.

## Architecture Decision: Forward Auth Only

All Acropolis services now use a single authentication model:

```
Internet → Apache (TLS/443) → Traefik (HTTP/8081) → Authentik Forward Auth → Service
                                                          ↓ (unauthenticated)
                                                   302 → auth.acumenus.net
                                                          ↓ (authenticated)
                                                   200 → Service (internal login)
```

**Why not native OAuth2/OIDC?**

- Forward auth is **stateless at the service level** — services don't need OAuth2 libraries, client IDs, or OIDC discovery URIs
- Authentik manages the SSO session in one place — adding a new service means adding one proxy provider and one Traefik label
- Native OIDC requires per-service configuration (Flask-AppBuilder for Superset, `AUTH_OIDC_*` for DataHub, `OAUTH2_CONFIG` for pgAdmin, `GF_AUTH_GENERIC_OAUTH_*` for Grafana) — 4 different OAuth2 integration patterns to maintain
- Forward auth failures are visible in Traefik logs; native OIDC failures are buried in each service's logs

**What services use for internal auth after the SSO gate:**

| Service | Internal Auth |
|---------|--------------|
| n8n | Basic auth (N8N_BASIC_AUTH) |
| Superset | DB auth (admin/password) |
| DataHub | JAAS (native login) |
| Grafana | Admin login (GF_SECURITY_ADMIN_*) |
| Portainer | First-login setup |
| pgAdmin | Email/password (PGADMIN_DEFAULT_*) |
| Wazuh | OpenSearch basic auth |

## Changes Made

### Layer 1: Live Infrastructure (Authentik API)

| Action | Before | After |
|--------|--------|-------|
| Delete 4 OAuth2 applications | `superset`, `datahub`, `grafana`, `pgadmin` linked to OAuth2 providers | Removed |
| Delete 5 OAuth2 providers | Grafana OAuth Provider, Grafana OAuth2, Superset OAuth2, DataHub OAuth2, pgAdmin OAuth2 | Removed |
| Rename 7 forward-auth apps | `-fwd` suffix: `n8n-fwd`, `superset-fwd`, etc. | Clean slugs: `n8n`, `superset`, etc. |
| Rename 7 proxy providers | Inconsistent names: "Provider", "Forward Auth Provider" | Uniform: `{name} Forward Auth` |
| Update embedded outpost | 11 providers (proxy + OAuth2) | 7 providers (proxy only) |
| Set flow backgrounds | Default Authentik background | `Acropolis.jpg` on all 14 flows |

### Layer 2: Service Configuration

| File | Change |
|------|--------|
| `docker-compose.enterprise.yml` | Added `DATAHUB_SYSTEM_CLIENT_ID` + `DATAHUB_SYSTEM_CLIENT_SECRET` to frontend; disabled `AUTH_OIDC_ENABLED`; removed `idp-metadata.xml` mount from indexer; improved Wazuh healthcheck |
| `docker-compose.community.yml` | Removed pgAdmin `AUTHENTIK_PGADMIN_CLIENT_ID/SECRET`; disabled `GF_AUTH_GENERIC_OAUTH_ENABLED` |
| `docker-compose.local.yml` | Removed `authlib` from Superset pip install commands |
| `config/superset/superset_config.py` | Removed `AUTH_OAUTH`, `OAUTH_PROVIDERS`, `CustomSsoSecurityManager` (55 lines of Flask-AppBuilder SSO) |
| `config/pgadmin/config_local.py` | Removed `OAUTH2_CONFIG` block (20 lines of OIDC config) |
| `config/wazuh/wazuh_dashboard/opensearch_dashboards.yml` | Removed `opensearch_security.auth.type: "saml"` and SAML xsrf allowlist |
| `config/wazuh/wazuh_indexer/config.yml` | Removed `saml_auth_domain` entirely, set basic auth `challenge: true` |

### Layer 3: Unified Compose

Created `acropolis/docker-compose.yml`:

```yaml
include:
  - docker-compose.base.yml       # Traefik + networks
  - docker-compose.community.yml  # Portainer, pgAdmin, Grafana
  - docker-compose.enterprise.yml # n8n, Superset, DataHub, Authentik, Wazuh
  - docker-compose.local.yml      # Port overrides for Apache proxy
```

All `docker compose` commands now work from this single entrypoint. No more orphan containers.

### Layer 4: Installer Pipeline

| File | Change |
|------|--------|
| `installer/deploy.py` | `COMPOSE_FILES` now uses unified `docker-compose.yml` for all tiers |
| `installer/config.py` | Added `datahub_system_client_secret`, `datahub_token_signing_key`, `datahub_token_salt` to `InstallConfig` and `.env` generation |
| `installer/config.py` | Added `grafana_admin_user`, `grafana_admin_password` to collection and `.env` |
| `installer/config.py` | Removed 12 OAuth2 placeholder vars from `.env` generation |
| `installer/config.py` | Removed `portainer_password` collection (Portainer uses first-login) |
| `installer/authentik.py` | Complete rewrite: forward-auth only, no OAuth2 creation, legacy cleanup on re-run |

## Verification

### Forward Auth — All 7 Services

```
n8n.acumenus.net       → 302 → auth.acumenus.net ✓
superset.acumenus.net  → 302 → auth.acumenus.net ✓
datahub.acumenus.net   → 302 → auth.acumenus.net ✓
grafana.acumenus.net   → 302 → auth.acumenus.net ✓
portainer.acumenus.net → 302 → auth.acumenus.net ✓
pgadmin.acumenus.net   → 302 → auth.acumenus.net ✓
wazuh.acumenus.net     → 302 → auth.acumenus.net ✓
```

### Authentik State — Clean

```
Providers:  7 (all proxy, forward_single mode)
Applications: 7 (clean slugs, no duplicates)
Outpost: 7 providers (proxy only)
OAuth2: 0 (all deleted)
```

### Container Health — All 24 Services

```
24/24 healthy, 0 orphans, 0 restart loops
Traefik: belongs to unified compose project
```

### Reboot Safety

- All 27 volumes: named and persistent
- All services: `restart: unless-stopped`
- Authentik bootstrap token: non-expiring
- Traefik port overrides: in `.env` (no Apache 443 conflict)
- Dependency chains: Authentik waits for DB/Redis, Wazuh waits for indexer/manager

## Commits

| Hash | Message |
|------|---------|
| `7a35a8f14` | fix: DataHub OIDC user provisioning and Wazuh dashboard login |
| `8eb88f095` | fix: standardize Authentik to forward-auth only — remove all native OAuth2/OIDC |
| `2fb7e61a5` | fix: Acropolis reboot safety — unified compose, Wazuh SAML cleanup, authlib removal |
| `f93986ac9` | fix: installer produces working Acropolis deployment out of the box |

## Lessons Learned

1. **Dual auth models create invisible failure modes.** The OAuth2 providers sat alongside the proxy providers for days without causing obvious problems — until a user tried to log into DataHub via OIDC and hit the provisioning failure. Forward-auth-only eliminates an entire class of "which auth path am I on?" bugs.

2. **Compose file layering needs a single entrypoint.** The 4-file stack worked perfectly when invoked correctly, but "invoke correctly" meant remembering all 4 files on every command. Docker Compose's `include:` directive makes this a non-issue — one file to rule them all.

3. **The installer IS the deployment contract.** If the installer doesn't generate `DATAHUB_SYSTEM_CLIENT_SECRET`, then DataHub is broken on every fresh install. Manual fixes on a live system are necessary but not sufficient — the fix must flow back to the installer or it's just a time bomb waiting for the next deployment.

4. **SAML configuration is viral.** Setting `opensearch_security.auth.type: "saml"` on the Wazuh dashboard broke login immediately, but the SAML config in the OpenSearch indexer's `config.yml` was a dormant threat — it would only fire if security config reloaded. Both layers had to be cleaned.

5. **Healthchecks should prove service function, not just HTTP response.** The Wazuh dashboard returned 401 on `/login` with basic auth, which `curl` treats as success (got a response, exit 0). A healthcheck that doesn't authenticate what it's checking isn't checking anything.

## What's Next

- Configure Authentik groups and role-based access policies per service
- Enable MFA (TOTP/WebAuthn) for admin accounts
- Add Authentik flow background image deployment to the installer pipeline
- Create Authentik blueprints for reproducible configuration export
