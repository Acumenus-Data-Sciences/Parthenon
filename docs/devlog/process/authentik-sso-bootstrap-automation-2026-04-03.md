# Authentik SSO Bootstrap Automation

**Date:** 2026-04-03
**Status:** Complete
**Impact:** Mission-critical — ensures all Acropolis Enterprise deployments have working SSO

## Problem

Authentik SSO was deployed as part of the Acropolis Enterprise stack, but none of the
downstream services (Superset, DataHub, pgAdmin, Grafana) could complete native OAuth2/OIDC
login. The root cause: the installer generated placeholder client IDs (`superset`, `datahub`,
`pgadmin`, `grafana`) in `.env` but never registered them as OAuth2 providers in Authentik's
database. Every native OIDC authorization request was rejected with "Invalid client identifier."

Traefik forward-auth (the embedded outpost) still worked because it uses its own
auto-generated credentials. But services that do their own OIDC flow (Superset via
Flask-AppBuilder, DataHub via `AUTH_OIDC_*`, pgAdmin via `OAUTH2_CONFIG`, Grafana via
`GF_AUTH_GENERIC_OAUTH_*`) all failed.

## Root Cause Analysis

The Acropolis installer had a gap between Phase 5 (config generation) and Phase 9
(verification):

1. **Phase 5** generated `.env` with placeholder client IDs and random secrets
2. **Phase 7** deployed all containers (including Authentik)
3. **Missing step**: Nobody called the Authentik API to register the OAuth2 providers
4. **Phase 9** smoke-tested container health but not OIDC flow

Additionally, the Superset, pgAdmin, and DataHub service configs hardcoded `acumenus.net`
as the Authentik domain, making them non-portable to other deployments.

## Solution

### New Module: `acropolis/installer/authentik.py`

Created a complete Authentik API bootstrap module that:

- **Waits** for Authentik container health + API readiness
- **Looks up** prerequisite resources (authorization/invalidation flows, signing keys,
  OIDC scope property mappings)
- **Creates** OAuth2/OIDC providers for 6 services: Grafana, Superset, DataHub, pgAdmin,
  Portainer, n8n
- **Creates or updates** Authentik applications linked to the correct providers
- **Configures** the embedded outpost with all provider PKs
- **Writes** the real auto-generated client IDs/secrets back to `.env`
- **Self-heals** expired bootstrap tokens via Django shell fallback
- **Is fully idempotent** — safe to re-run on existing installations

### Domain Portability Fixes

Removed hardcoded `acumenus.net` from service configs:

| File | Before | After |
|------|--------|-------|
| `config/superset/superset_config.py` | `auth.acumenus.net` | `auth.{os.environ.get('DOMAIN')}` |
| `config/pgadmin/config_local.py` | `auth.acumenus.net` | `auth.{os.environ.get('DOMAIN')}` |
| `docker-compose.enterprise.yml` (DataHub) | `auth.acumenus.net` | `auth.${DOMAIN}` |

Added `DOMAIN` env var passthrough to pgAdmin and Superset containers in their
respective compose files.

### Pipeline Integration

- **`deploy.py`**: `run_post_init()` now calls `bootstrap_authentik()` after Superset init
- **`config.py`**: `write_env_file()` generates `AUTHENTIK_BOOTSTRAP_TOKEN`,
  `AUTHENTIK_BOOTSTRAP_EMAIL`, and empty OAuth credential slots
- **`cli.py`**: Passes domain to `deploy()` for bootstrap

### Deployment Flow (Updated)

```
Phase 5: Config → .env with bootstrap token + empty OAuth slots
Phase 7: Deploy → containers start, Authentik bootstraps admin account
Phase 7 (post-init): Authentik SSO Bootstrap
  ├── Wait for Authentik API
  ├── Create OAuth2 providers (auto-generated client IDs)
  ├── Create/update applications
  ├── Configure embedded outpost
  └── Write real credentials to .env
Phase 9: Verify → all services healthy, OIDC endpoints responding
```

## Verification

All 11 tests passed:

| Test | Result |
|------|--------|
| Bootstrap idempotency | PASS |
| Token reset fallback | PASS |
| `_update_env_var` edge cases (5 scenarios) | PASS |
| Python compilation (6 files) | PASS |
| `deploy.py` function signatures | PASS |
| `config.py` env generation | PASS |
| OIDC authorization flow (Grafana, Superset, DataHub, pgAdmin) | 4/4 PASS |
| Invalid client rejection (negative test) | PASS |
| Grafana dual env var consistency | PASS |
| Docker Compose YAML validation | PASS |
| Zero real "Invalid client" errors in logs | PASS |

## Files Changed

- `acropolis/installer/authentik.py` — **New**: Authentik API bootstrap module
- `acropolis/installer/deploy.py` — Added `domain` param, calls bootstrap after post-init
- `acropolis/installer/config.py` — Generates bootstrap token and OAuth credential slots
- `acropolis/installer/cli.py` — Passes domain to deploy
- `acropolis/config/superset/superset_config.py` — Domain from env var
- `acropolis/config/pgadmin/config_local.py` — Domain from env var
- `acropolis/docker-compose.enterprise.yml` — DataHub OIDC uses `${DOMAIN}`, Superset gets `DOMAIN`
- `acropolis/docker-compose.community.yml` — pgAdmin gets `DOMAIN` env var

## Mission-Critical Guarantee

Every new Acropolis Enterprise deployment now automatically:
1. Generates cryptographically secure bootstrap credentials
2. Registers all OAuth2 providers in Authentik via API
3. Links applications to providers with correct redirect URIs
4. Writes real client IDs/secrets to `.env` before services read them
5. Configures the embedded outpost for Traefik forward-auth

No manual Authentik admin UI configuration required.
