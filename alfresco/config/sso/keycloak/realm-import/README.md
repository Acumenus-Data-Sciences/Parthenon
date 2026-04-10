This directory is mounted into the Alfresco SSO staging Keycloak container and is
imported on startup via `--import-realm`.

`alfresco-realm.json` bootstraps:
- Realm: `alfresco`
- Client: `alfresco` for ACS
- Client: `share` for Alfresco Share
- Upstream identity provider: Authentik via SAML

Still manual:
- Browser flow redirector config for seamless auto-redirect to the `authentik` broker on existing realms
- User federation component import, if you want Keycloak LDAP wired by file rather than live admin bootstrap
- Optional group mappers for LDAP-backed realm groups

Current live staging behavior:
- Fresh authorization requests are redirected straight to the `authentik` broker instead of rendering the Keycloak username/password form.
- This is implemented by the browser flow `Identity Provider Redirector` with `defaultProvider=authentik`.
