# Managed OHDSI Shiny Closeout

Date: 2026-05-09

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

## Still Left

- Validate `.github/workflows/hades-version-drift.yml` in GitHub after this
  branch is rebased onto the current `origin/main`. Local scripts and workflow
  wiring exist, but the scheduled workflow needs one hosted run as final proof.
- Broaden browser smoke beyond the PLP golden database. R-level golden coverage
  now spans all registered viewer families, but browser coverage currently
  launches PLP plus the generic OHDSI report artifact path.
- Test a real licensed Posit Connect deployment. The adapter contract and
  operator configuration are documented, but this repo cannot prove a licensed
  Connect environment locally.
- Replace or supplement the synthetic golden SQLite databases with upstream
  package-exported Eunomia artifacts when those exports are available and small
  enough for repo fixtures.
- Add deeper per-stage app-start telemetry only if operators need more detail
  than the current launch issue, resolution, failure, and active-session
  metrics.
