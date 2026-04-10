# Alfresco SSO Prerequisites

This directory now contains the Alfresco SSO staging and cutover artifacts.

The current live stack uses these pieces successfully for the browser login flow:

- an optional Keycloak-compatible identity layer for Alfresco
- a realm import for the `alfresco` realm plus the `alfresco` and `share` clients
- the ACS/Share cutover overlay
- example ACS and Share property files that match the live overlay

## Intended architecture

The target design keeps Authentik as the only real identity source:

1. Users, groups, passwords, and MFA stay in Authentik.
2. Authentik exposes LDAP for sync by means of an LDAP outpost.
3. Keycloak/Identity Service is used only because Alfresco’s supported SSO path expects it.
4. Alfresco Content Services and Share authenticate against the identity layer.

That avoids turning Keycloak into a second human directory.

## Start the staging identity layer

```bash
docker compose -f docker-compose.yml -f docker-compose.sso-prereqs.yml up -d
```

This starts:

- `alfresco-keycloak-db` on `127.0.0.1:15433`
- `alfresco-authentik-ldap` on `127.0.0.1:13389` and `127.0.0.1:16636`
- `alfresco-keycloak` on `127.0.0.1:18086`

No ACS/Share auth settings are changed by that command.

## Files used for cutover

- `config/sso/keycloak/realm-import/alfresco-realm.json`
- `docker-compose.sso-cutover.yml`
- `config/sso/acs/alfresco-global.sso.properties.example`
- `config/sso/share/share-config.properties.example`

The example property files are templates only. The live cutover currently comes from
`docker-compose.sso-cutover.yml`.

## Manual work still required

1. Decide whether to keep the Keycloak login page with the `Authentik` broker button or add automatic IdP redirection for a seamless Authentik handoff.
2. Add any Keycloak group mappers you want before using realm groups for authorization inside Alfresco.
3. Decide whether to keep LDAP sync exactly as-is or narrow it further before broader user rollout.

## Live staging status

These prerequisites are already in place in the current staging environment:

- Authentik is configured as the upstream SAML identity provider for the `alfresco` realm.
- The `alfresco` and `share` clients are imported in Keycloak.
- The Authentik LDAP outpost is running and reachable as `alfresco-authentik-ldap:3389`.
- Keycloak LDAP federation is configured against the Authentik outpost in read-only mode.
- The Keycloak LDAP provider is filtered to human users with email addresses.
- `ids.acumenus.net` is routed through Apache to Traefik and then to the staged Keycloak service.
- Share is configured to use `https://docs.acumenus.net/share/page/` as the OIDC callback and post-logout target.
- ACS is configured to use `https://ids.acumenus.net` as the identity-service base URL.

Current validation checks:

- Keycloak OIDC discovery is available from the staged realm.
- Keycloak issues secure session cookies on `https://ids.acumenus.net`.
- Keycloak broker requests redirect into the Authentik SAML flow.
- A full Keycloak LDAP sync imports the expected human Authentik users into the staged realm.
- The full Share login flow completes successfully and lands on the authenticated user dashboard.

## Current behavior

- Fresh browser logins are redirected straight from the Keycloak browser flow into the `authentik` broker.
- Users can still authenticate through the LDAP-backed Keycloak form if they are routed there explicitly for troubleshooting.
- The browser-facing Alfresco login flow no longer 404s on the OIDC callback and now completes the Share ticket exchange successfully.

## Official references

- Alfresco SSO guide for ACS 7.3+: <https://docs.alfresco.com/identity-service/latest/tutorial/sso/>
- Alfresco SAML path: <https://docs.alfresco.com/content-services/latest/tutorial/sso/saml/>
- Authentik LDAP provider: <https://docs.goauthentik.io/add-secure-apps/providers/ldap/>
- Authentik outposts: <https://docs.goauthentik.io/add-secure-apps/outposts/>
