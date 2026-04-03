---
phase: quick-15
plan: 01
subsystem: acropolis-installer
tags: [authentik, sso, oidc, saml, wazuh, infrastructure]
dependency_graph:
  requires: []
  provides: [native-sso-bootstrap, dual-app-pattern, wazuh-saml]
  affects: [acropolis/installer/authentik.py, acropolis/installer/config.py]
tech_stack:
  added: []
  patterns: [dual-app-pattern, idempotent-bootstrap, oidc-provider, saml-provider]
key_files:
  created: []
  modified:
    - acropolis/installer/authentik.py
    - acropolis/installer/config.py
decisions:
  - Dual-app pattern: each service keeps forward-auth app + gets new native SSO app
  - NativeSsoDef frozen dataclass as declarative definition for 6 services
  - Client ID alphabet uses ascii_letters + digits + "-_" (no "!" character)
  - SAML exchange key via secrets.token_hex(32) for Wazuh
  - Removed _cleanup_oauth2_providers — OAuth2 providers are now intentional
metrics:
  duration: 5min
  completed: "2026-04-03T23:51:11Z"
---

# Quick Task 15: Native SSO Bootstrap for Acropolis Installer

Native OIDC/SAML SSO bootstrap alongside existing forward-auth for all 7 Acropolis services, eliminating manual Authentik SSO configuration.

## Changes

### Task 1: Data model and config fields (24678b7e4)

**config.py:**
- Added 11 OAuth/SAML credential fields to `InstallConfig` dataclass
- Updated `.env` generation comment to reflect dual-app model
- Added SSO credentials section to `.install-credentials` file output

**authentik.py:**
- Updated module docstring to reflect dual-app authentication model
- Added `NativeSsoDef` frozen dataclass with 6 definitions (5 OIDC + 1 SAML)
- Removed `_cleanup_oauth2_providers()` function and its call (OAuth2 providers are now intentional)

### Task 2: Provider/application creation and Wazuh SAML (052467c97)

**AuthentikAPI new methods:**
- `list_saml_providers()` — list all SAML providers
- `list_property_mappings(managed_prefix)` — list scope/property mappings with filter
- `list_certificate_keypairs()` — list certificate-key pairs for signing

**New functions:**
- `_generate_client_id(length)` — URL-safe random ID generation (no `!` character)
- `_lookup_oidc_prerequisites()` — discovers openid/profile/email scope mapping PKs and signing key
- `_lookup_saml_prerequisites()` — discovers SAML property mapping PKs and signing key
- `_bootstrap_oidc_provider()` — creates/updates OAuth2 provider, persists credentials to .env
- `_bootstrap_saml_provider()` — creates/updates SAML provider for Wazuh, generates exchange key
- `_create_native_sso_application()` — creates application with `-oidc`/`-saml` slug suffix
- `_download_wazuh_idp_metadata()` — fetches SAML metadata XML, replaces localhost:9000 URLs
- `_apply_wazuh_security_config()` — runs securityadmin.sh in Wazuh indexer container

**bootstrap_authentik() updates:**
- New "Native SSO Providers" section after outpost configuration
- Iterates NATIVE_SSO_DEFS, dispatches to OIDC or SAML bootstrap per type
- Downloads Wazuh IdP metadata and applies security config if indexer is healthy
- Updated summary output to show both forward-auth and native SSO counts

## Deviations from Plan

None -- plan executed exactly as written.

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| 1 | 24678b7e4 | Data model, config fields, cleanup removal |
| 2 | 052467c97 | Provider creation, SAML bootstrap, metadata download |

## Self-Check: PASSED
