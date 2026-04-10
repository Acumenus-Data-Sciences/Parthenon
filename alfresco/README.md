# Alfresco Stack

This directory owns the standalone Alfresco deployment for `docs.acumenus.net`.

Usage:

```bash
cp .env.example .env
docker compose up -d
docker compose ps
```

Optional SSO staging layer:

```bash
docker compose -f docker-compose.yml -f docker-compose.sso-prereqs.yml up -d
```

That overlay starts the Keycloak-compatible identity layer needed for the Alfresco
SSO path without changing the live ACS/Share authentication flow. See
`SSO-PREREQS.md` for the cutover plan and staging files.

Container names are intentionally explicit so Docker does not append project suffixes.
The stack joins the external `acumenus` network and exposes loopback-only ports for
Apache:

- `18081` -> Alfresco repository
- `18082` -> Alfresco Share
- `18084` -> Alfresco Content App
- `18085` -> Alfresco Control Center

Persistent data uses the existing Docker volumes:

- `acropolis_alfresco_repository_data`
- `acropolis_alfresco_postgres_data`
