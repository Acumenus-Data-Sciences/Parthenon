# Managed OHDSI Shiny Runtime Operations

Date: 2026-05-09

## What This Covers

Managed OHDSI Shiny is the compatibility layer for vetted official OHDSI result
viewers. Native Parthenon React pages remain primary. Managed Shiny launches are
short-lived, signed, audited, and scoped to a study artifact or native study
result that exposes a recognized OHDSI result bundle.

## Active Sessions

Operators can inspect active sessions from System Health:

- Open **Administration -> System Health**.
- Check the **Managed OHDSI Shiny** service row.
- Service detail metrics include `active_sessions`, `pending_launches`,
  `expired_unresolved`, `issued_last_24h`, `resolved_last_24h`,
  `failed_last_24h`, `average_resolution_seconds`, and `failure_reasons`.

CLI checks:

```bash
cd backend
php artisan tinker --execute='dump(app(\App\Services\Shiny\ManagedShinyLaunchMetrics::class)->snapshot());'
php artisan shiny:cleanup-workspaces --dry-run
```

## Golden Smoke Fixture

Generate deterministic SQLite result databases:

```bash
Rscript docker/shiny-ohdsi/tests/golden/create_golden_result_databases.R
Rscript docker/shiny-ohdsi/tests/golden_result_database_test.R
```

For browser smoke against a deployed backend, copy a golden database into the
backend local storage disk and point Playwright at the storage-relative path:

```bash
mkdir -p backend/storage/app/private/testing/golden
cp docker/shiny-ohdsi/tests/golden/plp-results.sqlite backend/storage/app/private/testing/golden/plp-results.sqlite
cd e2e
PLAYWRIGHT_ENABLE_SHINY_SMOKE=1 \
PLAYWRIGHT_SHINY_GOLDEN_FILE_PATH=testing/golden/plp-results.sqlite \
npm run test:shiny
```

## Posit Connect Adapter

Licensed deployments can use Posit Connect as the managed runtime while keeping
the same Parthenon launch-token contract.

Required configuration:

```dotenv
SHINY_PROXY_RUNTIME=posit_connect
SHINY_PROXY_BASE_URL=https://connect.example.org
SHINY_WORKSPACE_ROOT=/srv/parthenon-shiny
SHINY_CONTAINER_WORKSPACE_ROOT=/srv/parthenon-shiny
SHINY_LAUNCH_TTL_MINUTES=15
```

Adapter expectations:

- The Connect app must call `POST /api/v1/shiny/launch-context` with the
  `parthenon_launch` query token.
- The app must mount or read the shared workspace path containing
  `context.json`, `managed-shiny-manifest.json`, and materialized artifacts.
- User-supplied app paths remain disabled; publish only the vetted app variants
  registered in `ManagedShinyAppRegistry`.

## Recovery Steps

Docker socket or ShinyProxy cannot start containers:

```bash
getent group docker
stat -c '%g %a %n' /var/run/docker.sock
docker compose ps shinyproxy
docker compose logs --tail=200 shinyproxy
```

Verify `SHINY_PROXY_DOCKER_GID` matches the Docker socket group id, then restart:

```bash
docker compose up -d shinyproxy
```

App image failures:

```bash
docker compose build shiny-ohdsi
docker compose up -d shinyproxy
docker images | grep parthenon-shiny-ohdsi
```

Workspace or launch-token failures:

```bash
cd backend
php artisan shiny:cleanup-workspaces --dry-run
php artisan shiny:cleanup-workspaces --grace-minutes=60
```

Check `managed_shiny_launches.failure_reason` for `expired`,
`context_unavailable`, `artifact_mismatch`, or `workspace_prepare_failed`.

## Production Smoke Checklist

After code or runtime changes:

```bash
curl -fsS https://parthenon.acumenus.net/ >/dev/null
curl -fsS https://parthenon.acumenus.net/login >/dev/null
curl -fsS https://parthenon.acumenus.net/jobs >/dev/null
curl -fsS https://parthenon.acumenus.net/api/v1/hades/packages | jq '.data.parity_status,.data.freshness_status'
```

Then verify in-browser:

- System Health shows Darkstar and Managed OHDSI Shiny.
- `/api/v1/hades/packages` reports no required missing packages.
- One managed viewer launches from either Study Artifacts or Study Results.
- Direct `/shiny/app/plp-results` access without a launch token is blocked.
