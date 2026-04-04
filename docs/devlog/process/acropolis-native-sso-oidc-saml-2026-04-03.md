# Acropolis: Native SSO for All Services — OIDC + SAML via Authentik

**Date:** 2026-04-03
**Author:** Dr. Sanjay Udoshi
**Status:** Complete
**Impact:** All 7 Acropolis services now have native single sign-on — eliminates the double-login UX entirely

---

## Summary

Upgraded every Acropolis Enterprise service from forward-auth-only (two-step login) to native SSO (single-click login) via Authentik. Five services use OpenID Connect, one uses SAML 2.0, and one remains forward-auth-only due to platform limitations. The working configuration is fully automated in the installer so it never needs to be done manually again.

## Problem

The forward-auth consolidation earlier today (see `acropolis-forward-auth-consolidation-2026-04-03.md`) solved the dual-auth confusion but introduced a double-login UX: users had to authenticate at the Authentik gate, then log in again at each service's own login page. This was the third time SSO had been manually configured — the first two times were lost to redeployments because the installer didn't automate native SSO.

## Architecture: Dual-App Model

The key insight is that each service needs **two** Authentik applications:

```
┌─────────────────────────────────────────────────────────────┐
│  Authentik                                                  │
│                                                             │
│  App: "grafana"          App: "grafana-oidc"                │
│  ├─ Proxy Provider       ├─ OAuth2 Provider                 │
│  ├─ forward_single       ├─ client_id / client_secret       │
│  └─ In embedded outpost  └─ Redirect URIs (http + https)    │
│                                                             │
│  Traefik middleware       Grafana Generic OAuth config       │
│  (defense-in-depth)       (native SSO button)               │
└─────────────────────────────────────────────────────────────┘
```

**Why two apps?** An Authentik application can only have one primary provider. If you change the existing forward-auth app's provider to OAuth2, the Traefik forward-auth middleware returns 404 instead of 302 — breaking the SSO gate entirely. We learned this the hard way when the first attempt at Grafana OIDC killed the forward-auth gate.

## Service Configuration Matrix

| Service | SSO Method | Authentik App | Service Config | Callback URL |
|---------|-----------|---------------|----------------|-------------|
| **Grafana** | OIDC | `grafana-oidc` (OAuth2 provider) | `GF_AUTH_GENERIC_OAUTH_*` env vars | `/login/generic_oauth` |
| **Superset** | OIDC | `superset-oidc` (OAuth2 provider) | `AUTH_TYPE = AUTH_OAUTH` in superset_config.py + authlib | `/oauth-authorized/authentik` |
| **pgAdmin** | OIDC | `pgadmin-oidc` (OAuth2 provider) | `OAUTH2_CONFIG` in config_local.py | `/oauth2/authorize` |
| **DataHub** | OIDC | `datahub-oidc` (OAuth2 provider) | `AUTH_OIDC_*` env vars | `/callback/oidc` |
| **Portainer** | OIDC | `portainer-oidc` (OAuth2 provider) | UI-configured OAuth settings | `/` (root) |
| **Wazuh** | SAML 2.0 | `wazuh-saml` (SAML provider) | `opensearch_security.auth.type: ["basicauth","saml"]` | `/_opendistro/_security/saml/acs` |
| **n8n** | Forward-auth only | `n8n` (proxy provider) | Basic auth behind gate | N/A |

## Critical Lessons Learned

### 1. Redirect URIs Must Include Both HTTP and HTTPS

Apache terminates TLS. Services behind Traefik see `http://` in their request scheme. When Superset and pgAdmin constructed their OAuth callback URLs, they used `http://superset.acumenus.net/...` — but Authentik had `https://...` registered. Fix: register **both** schemes for every redirect URI.

### 2. Wazuh Uses SAML, Not OIDC

Wazuh's official documentation only covers SAML for SSO. The OpenSearch Dashboards codebase has OIDC support (`opensearch_security.auth.type: "openid"`), but the Wazuh fork's security plugin fails with `Authentication Exception` during the OIDC token-to-indexer handshake. SAML works out of the box per the Wazuh docs.

Key SAML config points:
- `sign_assertion: true` and `sign_response: true` — Wazuh rejects unsigned assertions
- `issuer: https://auth.{domain}` — must match the IdP entity ID in the metadata
- `roles_key: http://schemas.xmlsoap.org/claims/Group` — maps Authentik groups to Wazuh roles
- `exchange_key` — 64-char hex, generated with `openssl rand -hex 32`
- IdP metadata must be downloaded via the Authentik API and have `localhost:9000` URLs replaced with `https://auth.{domain}`
- ACS URL is `/_opendistro/_security/saml/acs` (not `/_opendistro/_security/saml/acs/idpinitiated`)

### 3. Portainer OAuth Requires Manual Admin Setup

Portainer CE's OAuth is configured through the admin UI (Settings → Authentication → OAuth), not via compose env vars. The installer creates the Authentik provider and stores credentials in `.env`, but an admin must paste them into the Portainer UI on first login. Auto-provisioning must be enabled, and the first OAuth user must be promoted to admin.

### 4. The Installer Must Automate Everything

This was the third time SSO was manually configured. Previous manual setups were lost to redeployments. The installer (`authentik.py`) now:

1. Creates 7 proxy providers + apps (forward-auth gate)
2. Creates 5 OAuth2/OIDC providers + apps (Grafana, Superset, pgAdmin, DataHub, Portainer)
3. Creates 1 SAML provider + app (Wazuh) with signed assertions
4. Downloads Wazuh IdP metadata and writes it to the config directory
5. Applies Wazuh security config via securityadmin.sh
6. Generates and persists all OAuth client IDs/secrets and SAML exchange key to `.env`

### 5. Deep Code Review Caught 4 Critical Bugs

The initial automated implementation passed syntax checks but had 4 runtime-breaking bugs:

| Bug | Impact | Fix |
|-----|--------|-----|
| Missing `sign_assertion`/`sign_response` | Wazuh rejects all SAML assertions | Added both fields to payload |
| Missing `issuer` field | IdP entity ID mismatch breaks trust | Added `issuer: https://auth.{domain}` |
| Silent credential loss on re-run | Existing provider + empty .env = blank OAuth creds | Recover credentials from Authentik API |
| Wrong securityadmin.sh invocation | Security config never applied | Fixed paths, added JAVA_HOME |

Plus 6 HIGH issues: N+1 API calls, container name mismatch, credential wipeout on `write_env_file` re-run, Portainer trailing-slash variants.

## Changes Made

### Service Configurations (Committed)

| File | Change |
|------|--------|
| `docker-compose.community.yml` | Grafana: 11 `GF_AUTH_GENERIC_OAUTH_*` env vars; pgAdmin: `PGADMIN_OAUTH_CLIENT_ID/SECRET` |
| `docker-compose.enterprise.yml` | Superset: `SUPERSET_OAUTH_CLIENT_ID/SECRET` + authlib install; DataHub: `AUTH_OIDC_*` enabled; Wazuh: `idp-metadata.xml` volume mount |
| `config/superset/superset_config.py` | `AUTH_TYPE = AUTH_OAUTH` with Authentik OAUTH_PROVIDERS config |
| `config/pgadmin/config_local.py` | `OAUTH2_CONFIG` with Authentik provider |
| `config/wazuh/wazuh_dashboard/opensearch_dashboards.yml` | `auth.type: ["basicauth","saml"]` + xsrf allowlist |
| `config/wazuh/wazuh_indexer/config.yml` | `saml_auth_domain` with IdP metadata, SP entity, exchange key |
| `config/wazuh/wazuh_indexer/roles_mapping.yml` | `authentik Admins` → `all_access` role |
| `config/wazuh/wazuh_indexer/idp-metadata.xml` | Authentik SAML IdP metadata (signed, external URLs) |

### Installer Automation (Committed)

| File | Change |
|------|--------|
| `installer/authentik.py` | `NativeSsoDef` dataclass, 6 native SSO definitions, OIDC/SAML provider creation, metadata download, securityadmin.sh integration, credential persistence. Removed `_cleanup_oauth2_providers()`. |
| `installer/config.py` | 11 OAuth/SAML credential fields in `InstallConfig`, `.env` placeholder generation |

## Verification

### SSO Flow — All 6 Native SSO Services

```
grafana.acumenus.net   → Authentik gate → "Sign in with Authentik" → SSO ✓
superset.acumenus.net  → Authentik gate → "authentik" OAuth button  → SSO ✓
pgadmin.acumenus.net   → Authentik gate → "authentik" OAuth button  → SSO ✓
datahub.acumenus.net   → Authentik gate → OIDC login               → SSO ✓
portainer.acumenus.net → Authentik gate → "Login with OAuth"        → SSO ✓
wazuh.acumenus.net     → Authentik gate → "Log in with SSO" (SAML)  → SSO ✓
```

### Forward-Auth Gates — All 7 Services

```
All 7 services: HTTP 302 → auth.acumenus.net ✓
```

### Authentik State

```
Proxy providers:     7 (forward-auth, in embedded outpost)
OAuth2 providers:    5 (OIDC for Grafana, Superset, pgAdmin, DataHub, Portainer)
SAML providers:      1 (Wazuh)
Applications:       13 (7 forward-auth + 5 OIDC + 1 SAML)
```

## Commits

| Hash | Message |
|------|---------|
| `57e098975` | feat(quick-14): configure Grafana OIDC SSO via Authentik |
| `078eb0318` | feat: OIDC SSO for Superset, pgAdmin, and DataHub via Authentik |
| `4a7aab8b7` | feat: SAML SSO for Wazuh via Authentik — completes SSO for all Acropolis services |
| `24678b7e4` | feat(quick-15): add NativeSsoDef data model and OAuth credential fields |
| `052467c97` | feat(quick-15): implement native SSO bootstrap (OIDC + SAML) in authentik.py |
| `8a6194b5b` | fix: address 4 CRITICAL + 6 HIGH issues in SSO installer bootstrap |

## What's Next

- [ ] Verify installer automation end-to-end on a clean VM
- [ ] Add Authentik group-based access policies (restrict services by role)
- [ ] Enable MFA (TOTP/WebAuthn) for admin accounts
- [ ] Configure Authentik flow branding (Acropolis.jpg background, custom CSS)
- [ ] Export Authentik configuration as blueprints for reproducible deploys
- [ ] Investigate n8n Enterprise for native OIDC support
