# DataHub Data Catalog Integration & User Avatar System

**Date:** 2026-04-02
**Category:** Infrastructure, UX
**Status:** Complete

## Summary

Integrated DataHub as the enterprise data catalog for Parthenon, ingested the full `app` schema with 2,100+ descriptions, created a comprehensive data dictionary, and implemented user avatar display across the entire Commons collaboration workspace.

## DataHub Setup

### Infrastructure
- Connected DataHub to host PostgreSQL (PG17) by adding UFW firewall rule for Docker subnet (172.16.0.0/12 → port 5432)
- Added `DATAHUB_SYSTEM_CLIENT_ID` and `DATAHUB_SYSTEM_CLIENT_SECRET` to GMS and actions services for internal service-to-service auth
- Generated a `NO_EXPIRY` personal access token for CLI ingestion
- Enabled Kafka consumers on GMS (`MAE_CONSUMER_ENABLED`, `MCL_CONSUMER_ENABLED`, `PE_CONSUMER_ENABLED`) — without these, ingested metadata was stored but never indexed in OpenSearch
- Built custom `datahub-actions` Docker image (`Dockerfile.actions`) with `acryl-datahub[postgres]` baked in to survive container restarts
- Mounted persistent ingestion recipe at `/etc/datahub/pg_recipe.yml`

### Data Ingestion
- **370 datasets** cataloged across 11 schemas (app, omop, vocab, results, irsf, pancreas, atlantic_health, mimiciv, poseidon_dagster, etc.)
- **2,115 descriptions** pushed via GraphQL API — every table and column in the `app` schema has clinical-informatics-grade documentation
- Ownership assigned to `akadmin@acumenus.net` with Admin role via `batchAssignRole` mutation
- Ingestion recipe stored at `acropolis/config/datahub/pg_recipe.yml` with env-var token

### Authentik SSO
- Assigned Admin role to `akadmin@acumenus.net` in DataHub
- JAAS enabled alongside OIDC for admin token generation

## Data Dictionary

Created comprehensive reference document at `docs/data-dictionary/app-schema.md`:
- **3,635 lines** covering **170 tables** across **26 domain groups**
- Full column tables with Type, Nullable, Default, and Description for ~1,500 columns
- References OMOP CDM, OHDSI tools, FHIR R4, LOINC, SNOMED CT conventions
- Ingested into DataHub via Python script that parses markdown and pushes descriptions via GraphQL

## User Avatar System

### Problem
- Avatar upload worked but image never displayed — caused by missing Apache `/storage/` proxy rule (requests hit SPA fallback → React Router 404)
- Browser cache with `immutable` directive prevented re-fetches after upload
- Commons workspace showed colored initials instead of real avatars

### Fixes
1. **Apache proxy** — Added `ProxyPass /storage/` rule to route avatar requests to Nginx instead of SPA
2. **Nginx cache headers** — Changed `/storage/avatars/` from `immutable` to `must-revalidate` with 1-minute expiry
3. **Backend** — Avatar filenames now include hash suffix (`117_a831abb1.png`) for cache-busting on re-upload
4. **AvatarUpload component** — Instant client-side preview via `URL.createObjectURL()`, preloads server image before clearing blob
5. **UserAvatar component** — New shared component with image + fallback-to-initials + error handling
6. **Commons integration** — All 12 Commons components updated to use `UserAvatar`, all 9 backend controllers updated to include `avatar` in user eager-loads
7. **Header** — `onError` fallback to User icon if avatar fails to load

### Components Updated
- `UserAvatar.tsx` (new shared component)
- `MessageItem`, `MessageComposer`, `OnlineUsers`, `ChannelList`, `NotificationBell`, `CreateDirectMessageModal`
- `MemberList`, `ReviewList`, `SearchPanel`, `ActivityFeed`
- `AnnouncementBoard`, `WikiPage`

## Portainer & pgAdmin SSO

- Added `authentik@docker` middleware to Portainer and pgAdmin Traefik labels in `docker-compose.community.yml`

## UFW Firewall

- Added rule for server's own public IP (50.32.55.173) to reach PG — Docker containers resolving `pgsql.acumenus.net` hairpin through the public IP, which UFW was blocking

## Files Changed

### New
- `docs/data-dictionary/app-schema.md` — Complete app schema data dictionary
- `frontend/src/features/commons/components/UserAvatar.tsx` — Shared avatar component
- `acropolis/config/datahub/Dockerfile.actions` — Custom datahub-actions image with postgres plugin
- `acropolis/config/datahub/pg_recipe.yml` — PostgreSQL ingestion recipe

### Modified
- `acropolis/docker-compose.enterprise.yml` — DataHub MAE/MCL consumers, system client auth, schema registry
- `acropolis/docker-compose.community.yml` — Authentik SSO for Portainer and pgAdmin
- `frontend/src/features/commons/types.ts` — Added `avatar` to `ChannelUser` interface
- 8 Commons backend controllers — Added `avatar` to user eager-loads
- 12 Commons frontend components — Replaced initials with `UserAvatar`
