# Managed OHDSI Shiny Subproject Completion

Date: 2026-05-09

## Completion Status

The OHDSI/HADES managed Shiny parity subproject is complete for repository
implementation. Parthenon now has:

- real golden SQLite result databases for every supported official viewer
  family,
- official OHDSI module handoff through the managed Shiny runtime,
- native Study Artifact and Study Result launch surfaces,
- browser smoke coverage through ShinyProxy into the official module handoff,
- HADES target-version drift automation,
- launch auditing, cleanup, active-session metrics, and operator runbooks.

## Completed This Pass

- Moved the Shiny app code out of `/srv/parthenon-shiny` and into
  `/opt/parthenon-shiny/app` so the ShinyProxy workspace volume no longer masks
  the image-baked app helpers.
- Added conservative RDS/RData/JSON table-bundle conversion into SQLite for the
  official OHDSI module handoff path. HTML remains artifact-only unless paired
  with a result database.
- Added a backend seeder for a launchable native `StudyResult` backed by the
  golden PLP SQLite database.
- Hardened native result-page browser smoke by suppressing the What's New modal
  and proving the Study Results tab launch action opens the managed Shiny
  official module handoff.
- Rebuilt the local managed Shiny image and verified the complete Playwright
  managed Shiny suite through ShinyProxy:
  artifact launch, golden SQLite official handoff, native result-page discovery,
  and direct app access denial.
- Closed the runtime-operations track with active-session visibility, Posit
  Connect deployment guidance, and recovery documentation for Docker socket,
  ShinyProxy, image, workspace, and launch-token failures.

## Current Verification

```bash
Rscript docker/shiny-ohdsi/tests/handoff_registry_test.R
Rscript docker/shiny-ohdsi/tests/golden_result_database_test.R
Rscript docker/shiny-ohdsi/tests/loader_registry_test.R
PARTHENON_DARKSTAR_IMAGE=ghcr.io/sudoshi/parthenon-darkstar:latest docker compose --profile build build shiny-ohdsi
cd e2e
PLAYWRIGHT_ENABLE_SHINY_SMOKE=1 \
PLAYWRIGHT_SHINY_GOLDEN_FILE_PATH=testing/golden/plp-results.sqlite \
PLAYWRIGHT_ENABLE_RESULT_VIEWER_DISCOVERY=1 \
PLAYWRIGHT_SEED_GOLDEN_RESULT=1 \
npx playwright test tests/managed-shiny.spec.ts --project=chromium
```

## Post-Closeout Live Runtime Validation

The local ShinyProxy-backed smoke environment was brought up and validated after
the repository closeout. The host already had Docker access, the Docker socket
group matched the `SHINY_PROXY_DOCKER_GID` default, the managed Shiny image was
present locally, and `parthenon-shinyproxy` was running healthy behind nginx.

Setup and verification performed:

```bash
./deploy.sh --frontend
docker compose exec -T php php artisan migrate:status
docker compose exec -T php php artisan shiny:seed-golden-result --cleanup --json
cd e2e
PLAYWRIGHT_BASE_URL=http://localhost:8082 \
PLAYWRIGHT_ENABLE_SHINY_SMOKE=1 \
PLAYWRIGHT_SHINY_GOLDEN_FILE_PATH=testing/golden/plp-results.sqlite \
PLAYWRIGHT_ENABLE_RESULT_VIEWER_DISCOVERY=1 \
PLAYWRIGHT_SEED_GOLDEN_RESULT=1 \
npm run test:shiny
```

The full managed Shiny Playwright suite passed against the live runtime:

- study artifact launch through ShinyProxy,
- golden SQLite official module handoff,
- native Study Results tab viewer discovery,
- direct Shiny app access denial without a Parthenon launch token.

During setup, the live database exposed a role-split defect outside the managed
Shiny code path: `app.tenants` had been created by the migrator role without
runtime grants for `parthenon_app`, so normal runtime lookups could fail with
`permission denied for table tenants`. The migration now includes the same
conditional `parthenon_app` table and sequence grants used by the managed Shiny
launch audit migration. The live database was granted the same privileges before
rerunning smoke.

Final live checks:

```bash
curl http://localhost:8082/
curl http://localhost:8082/login
curl http://localhost:8082/jobs
curl http://localhost:8082/shiny/
curl -H "Authorization: Bearer <token>" \
  http://localhost:8082/api/v1/hades/packages
```

The frontend routes and `/shiny/` returned `200`. The HADES package endpoint
reported `parity=ready` and `freshness=current`. Smoke study records and
ShinyProxy-generated app containers were cleaned up after the browser run.

## Completion Boundary

The codebase now satisfies the original managed Shiny parity backlog. Remaining
items are not blockers for this subproject; they are follow-on hardening or
environment-bound validation:

- Run the scheduled HADES drift workflow once in GitHub after merge to prove the
  hosted schedule and PR authoring path.
- Broaden browser smoke from the PLP golden path to every registered viewer
  family. R-level golden coverage already spans the full viewer family set.
- Test the Posit Connect adapter contract in a licensed Connect deployment.
- Replace or supplement synthetic golden SQLite databases with upstream
  package-exported Eunomia artifacts when those exports are available and small
  enough for repo fixtures.
- Add deeper per-stage app-start telemetry only if operators need more detail
  than the current launch issue, resolution, failure, and active-session
  metrics.
