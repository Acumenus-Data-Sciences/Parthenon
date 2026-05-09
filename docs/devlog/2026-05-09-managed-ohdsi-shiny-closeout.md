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
