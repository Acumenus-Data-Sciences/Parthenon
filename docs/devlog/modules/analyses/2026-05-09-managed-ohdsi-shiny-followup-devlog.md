# Managed OHDSI Shiny Follow-Up Devlog

Date: 2026-05-09

## Summary

This follow-up moves the managed OHDSI Shiny runtime from a verified launch
scaffold toward a production-grade compatibility surface. The implementation
adds a durable execution plan, opt-in browser smoke coverage for ShinyProxy,
and persisted launch auditing for study artifact launches.

The shipped slice focuses on guardrails before expanding the R-side viewer
surface. That is intentional: managed Shiny touches Laravel, PostgreSQL,
ShinyProxy, Docker, R package inventory, browser embedding, and filesystem
workspace materialization. Before adding package-specific OHDSI result loaders,
Parthenon now has a repeatable way to prove that the launch path works and that
operators can answer who launched which managed app and whether the token was
resolved.

## Background

The previous HADES parity milestone established that Parthenon can:

- report installed and target HADES package versions through
  `/api/v1/hades/packages`;
- distinguish installed, missing, fresh, pinned, and outdated HADES resources;
- expose the managed OHDSI Shiny app registry to the frontend;
- generate short-lived signed launch tokens for vetted study artifacts;
- route those launches through ShinyProxy into the `docker/shiny-ohdsi` runtime;
- deny direct Shiny app access when a Parthenon launch token is missing.

The known gap after that milestone was not the launch path itself. The gap was
that the Shiny app still presented a managed context scaffold rather than full
package-specific OHDSI result viewers. The new backlog plan therefore starts by
locking down the path that already works, then sequences manifest contracts,
loaders, native launch surfaces, version automation, and runtime operations.

## Feature Set Added In This Slice

### 1. Follow-Up Execution Plan

Added:

- `docs/superpowers/plans/2026-05-09-managed-ohdsi-shiny-followup-execution-plan.md`

The plan defines six implementation phases:

1. Guardrails before more runtime surface.
2. Result bundle loader contract.
3. Package-specific loaders.
4. Native result page launch surfaces.
5. HADES version automation.
6. Runtime operations and golden-data quality.

The plan also includes concrete P0 and P1 todo lists. P0-A through P1-A are
now executed: browser smoke coverage, launch audit persistence, workspace
retention cleanup, launch/runtime metrics, launch-context abuse controls, and
the managed Shiny manifest contract are in place. Real package loaders remain
open follow-up items.

### 2. Opt-In Managed Shiny Browser Smoke Suite

Added:

- `e2e/tests/managed-shiny.spec.ts`
- `e2e/package.json` script: `npm run test:shiny`

The suite is intentionally opt-in through:

```bash
PLAYWRIGHT_ENABLE_SHINY_SMOKE=1
```

This keeps normal Playwright runs fast and avoids requiring ShinyProxy during
every local E2E pass. When enabled, the suite validates the real browser path:

- creates a temporary study through the authenticated API;
- creates a temporary `results_report` study artifact with OHDSI report
  metadata;
- calls the artifact `shiny-launch` endpoint;
- opens the returned launch URL through the browser;
- waits across ShinyProxy parent page and app iframe frames;
- asserts that the frame exposes managed OHDSI Shiny context, the workspace id,
  the artifact title, and expected OHDSI Shiny package availability;
- verifies that direct `/shiny/app/plp-results` access is blocked without a
  Parthenon launch token;
- deletes the temporary study during cleanup.

The smoke test covers the actual embedded user path instead of only asserting
API responses. It also protects the direct-access denial policy, which matters
because these apps are intentionally surfaced inside Parthenon rather than as
arbitrary public Shiny apps.

### 3. Managed Shiny Launch Audit Persistence

Added:

- `backend/app/Models/App/ManagedShinyLaunch.php`
- `backend/database/migrations/2026_05_09_180000_create_managed_shiny_launches_table.php`

Updated:

- `backend/app/Services/Shiny/ManagedShinyLaunchService.php`
- `backend/tests/Feature/Api/V1/StudyArtifactShinyPolicyTest.php`

The new `app.managed_shiny_launches` table records issued managed launch
events. Each row captures:

- workspace id;
- user id;
- study id;
- study artifact id;
- study slug;
- artifact type;
- app key;
- runtime;
- launch mode;
- status;
- launch token hash;
- expiry timestamp;
- resolved timestamp;
- failed timestamp and failure reason placeholders;
- metadata for app label, artifact title, container path, and context path.

The launch token itself is never persisted. The audit stores a SHA-256 hash so
the context resolver can correlate a resolved token to the issued launch record
without retaining bearer material.

When a managed launch is created successfully, the service writes an `issued`
audit row. When `/api/v1/shiny/launch-context` resolves the signed token and
prepares the workspace, the service updates the row to `resolved` and records
`resolved_at`.

The migration is schema-qualified as `app.managed_shiny_launches`. This is
important because some migrations temporarily adjust PostgreSQL search paths,
and schema qualification prevents accidental table creation in a different
schema during tests or targeted migrations.

The migration also grants DML on the table and sequence to `parthenon_app` when
that role exists, preserving the production split between migration credentials
and runtime credentials.

### 4. Workspace Retention Cleanup

Added:

- `backend/app/Console/Commands/Shiny/CleanupManagedShinyWorkspacesCommand.php`

Updated:

- `backend/config/services.php`
- `backend/routes/console.php`
- `backend/tests/Feature/Shiny/CleanupManagedShinyWorkspacesCommandTest.php`

The new `shiny:cleanup-workspaces` command prunes managed Shiny launch
workspaces from `{SHINY_WORKSPACE_ROOT}/launches`. It deletes audited
directories whose launch token has expired past the configured grace period.
It also handles pre-audit orphan workspaces by deleting only valid UUID
directories whose directory mtime is older than the longer orphan grace period.
Malformed directories are reported and skipped rather than deleted.

Deletion eligibility is based on `expires_at` plus a configurable grace period.
The default grace period is controlled by:

```bash
SHINY_WORKSPACE_CLEANUP_GRACE_MINUTES=60
SHINY_WORKSPACE_ORPHAN_CLEANUP_GRACE_MINUTES=1440
```

Operators can override that value per run:

```bash
php artisan shiny:cleanup-workspaces --grace-minutes=120
php artisan shiny:cleanup-workspaces --orphan-grace-minutes=2880
```

The command supports dry-run output for operational review:

```bash
php artisan shiny:cleanup-workspaces --dry-run
```

Output is JSONL-shaped so it can be captured by logs or future metrics
collectors. Successful deletion records `workspace_cleaned_at` in the launch
metadata, preserving a lightweight cleanup trail without changing the launch
outcome status.

The scheduler now runs the cleanup hourly through `routes/console.php`, with
overlap protection and failure logging.

### 5. Launch Metrics and Launch-Context Abuse Controls

Added:

- `backend/app/Services/Shiny/ManagedShinyLaunchMetrics.php`

Updated:

- `backend/app/Providers/AppServiceProvider.php`
- `backend/app/Http/Controllers/Api/V1/Admin/SystemHealthController.php`
- `backend/app/Services/Shiny/ManagedShinyLaunchService.php`
- `backend/config/services.php`
- `backend/routes/api.php`
- `backend/tests/Feature/Api/V1/ManagedShinyLaunchContextRateLimitTest.php`
- `backend/tests/Feature/Shiny/ManagedShinyLaunchMetricsTest.php`
- `backend/tests/Feature/Api/V1/StudyArtifactShinyPolicyTest.php`

The public launch-context resolver now uses a named `shiny-launch-context`
rate limiter instead of a broad numeric route throttle. The limiter is keyed by
client IP and reads its default from:

```bash
SHINY_LAUNCH_CONTEXT_RATE_LIMIT_PER_MINUTE=60
```

The resolver still returns the same public non-disclosing failure envelope for
bad launch tokens. When a token is cryptographically valid enough to correlate
to an issued audit row, failed outcomes are now recorded on
`managed_shiny_launches` without persisting bearer tokens. The first covered
failure class is expired token resolution; the service also records
context-unavailable, artifact-mismatch, and workspace-preparation failures.

`ManagedShinyLaunchMetrics` produces an operator snapshot for System Health:

- total launches;
- counts by status;
- launches, resolutions, and failures in the last 24 hours;
- active sessions;
- pending launches;
- expired unresolved launches;
- average resolution latency;
- last issued, resolved, and failed timestamps;
- failure reason counts;
- launch TTL and launch-context rate-limit configuration.

System Health now exposes a `managed-shiny` service under the AI & Analytics
tier. Its metrics distinguish package/runtime parity work from actual managed
launch runtime behavior.

### 6. Managed Shiny Manifest Contract

Added:

- `docker/shiny-ohdsi/manifest.R`
- `docker/shiny-ohdsi/tests/manifest_parser_test.R`
- fixture manifests under `docker/shiny-ohdsi/tests/fixtures/`

Updated:

- `backend/app/Services/Shiny/ManagedShinyAppRegistry.php`
- `backend/app/Services/Shiny/ManagedShinyLaunchService.php`
- `backend/tests/Feature/Api/V1/StudyArtifactShinyPolicyTest.php`
- `docker/shiny-ohdsi/app.R`
- `docker/shiny-ohdsi/Dockerfile`

Every managed Shiny workspace now receives a `managed-shiny-manifest.json`
alongside `context.json`. The manifest is schema-versioned as
`parthenon.managed_shiny_manifest` version `1.0` and includes:

- launch workspace id and expiry;
- managed app key, runtime app, module family, package, and entrypoint;
- study identity fields;
- artifact type, MIME type, version, detected result types, and safe metadata
  hints;
- materialized artifact file details using container paths and relative paths,
  not host paths;
- loader key, loader selection basis, expected packages, entrypoint, and
  loader status.

The Shiny app now sources `manifest.R`, validates the manifest from the launch
workspace, and renders a visible unsupported-result panel when the manifest is
missing, invalid, or names an unsupported loader. Valid manifests render the
loader family, loader key, selected result types, and relative bundle path.

Fixture manifests cover PLP, population estimation, cohort diagnostics,
characterization, PheValuator, and OHDSI report bundles. The R parser test
validates every fixture plus missing-manifest and unsupported-loader failures.

### 7. Loader Registry and Bundle Readiness

Added:

- `docker/shiny-ohdsi/loaders.R`
- `docker/shiny-ohdsi/tests/loader_registry_test.R`

Updated:

- `docker/shiny-ohdsi/app.R`
- `docker/shiny-ohdsi/Dockerfile`

The Shiny runtime now has a loader registry for every managed OHDSI app family:

- PatientLevelPrediction result bundles;
- population-level estimation bundles for CohortMethod, SCCS, and Evidence
  Synthesis;
- CohortDiagnostics bundles;
- Characterization and CohortIncidence bundles;
- PheValuator bundles;
- OHDSI report and sharing bundles;
- generic managed Shiny bundles for future vetted apps.

This is the first P2 loader slice. It does not yet call the final OHDSI viewer
entrypoints with complete package-specific fixture data. It does add the shared
contract those handoffs need: loader metadata, accepted file extensions,
expected result types, expected packages, official app-builder entrypoints,
safe workspace-relative bundle resolution, readable zip validation, and zip
entry path validation before any future extraction or package handoff.

The Shiny app now renders loader readiness rather than only manifest fields.
Ready bundles show the registered loader, app-builder entrypoint, workspace
relative bundle path, zip entry count, and expected runtime packages. Missing,
unsafe, unsupported, or unreadable bundles render the shared incomplete or
unsupported panel with messages that do not expose host filesystem paths.

The loader registry test covers every fixture manifest by creating a temporary
workspace and a minimal readable zip bundle at the manifest-relative path. It
also verifies the failure modes that matter most before accepting uploaded
artifacts into an R runtime:

- manifest references a bundle that is not present;
- manifest uses an unsafe relative path such as parent traversal;
- manifest points to an extension the selected loader does not accept;
- manifest points to a `.zip` file that is not a readable zip archive;
- manifest points to a readable zip containing unsafe entry paths.

### 8. Official SQLite Result Database Handoff

Added:

- `docker/shiny-ohdsi/handoffs.R`
- `docker/shiny-ohdsi/tests/handoff_registry_test.R`

Updated:

- `docker/shiny-ohdsi/app.R`
- `docker/shiny-ohdsi/Dockerfile`
- `docker/shiny-ohdsi/loaders.R`

The installed `OhdsiShinyAppBuilder` API in the Shiny OHDSI image is oriented
around a shared result database connection. Its `createShinyApp()` and
`viewShiny()` functions accept app-builder module configuration plus a database
connection or connection details. They do not directly consume arbitrary PLP,
CohortMethod, CohortDiagnostics, Characterization, PheValuator, or report zip
files as standalone objects.

The new handoff layer therefore treats SQLite result databases as the first
official viewer boundary:

- direct `.sqlite`, `.sqlite3`, and `.db` artifacts are accepted by the loader
  registry;
- zip bundles are inspected using the safe archive-entry list from P2-A;
- if a safe SQLite result database entry is present, only that entry is
  extracted to an isolated temporary directory;
- extracted database paths are normalized and verified to stay inside the
  extraction directory;
- symlink database paths are rejected;
- the handoff builds `DatabaseConnector::createConnectionDetails(dbms =
  "sqlite")`;
- result settings are created with
  `OhdsiShinyAppBuilder::createDefaultResultDatabaseSettings(schema = "main",
  vocabularyDatabaseSchema = "main")` plus the expected OHDSI table prefixes;
- the managed Shiny app renders the official module UI and starts the matching
  `OhdsiShinyModules` server with a
  `ResultModelManager::ConnectionHandler`.

Registered official module handoffs now cover:

- `patientLevelPredictionViewer` / `patientLevelPredictionServer`;
- `estimationViewer` / `estimationServer`;
- `cohortDiagnosticsView` / `cohortDiagnosticsServer`;
- `characterizationViewer` / `characterizationServer`;
- `phevaluatorViewer` / `phevaluatorServer`;
- `reportViewer` / `reportServer`.

The handoff is intentionally gated. If runtime packages are missing, no SQLite
database is present, or the bundle is not ready, the app keeps rendering a safe
status panel instead of trying to start a broken official module.

### 9. SQLite Schema Guards

Updated:

- `docker/shiny-ohdsi/handoffs.R`
- `docker/shiny-ohdsi/app.R`
- `docker/shiny-ohdsi/tests/handoff_registry_test.R`

The official handoff now validates candidate SQLite result databases before it
constructs connection details for an OHDSI module. This prevents an empty,
wrong-family, or non-result database from being handed to a module that would
then fail deeper in its server lifecycle.

The first guard checks were intentionally coarse but family-specific:
`database_meta_data` plus a registered result-family prefix. The next slice
deepens those checks into concrete named schema variants.

`RSQLite`, `DBI`, and `OhdsiReportGenerator` are now included in the official
handoff package gate. The managed app also shows the validated schema table
count in the official module handoff panel.

### 10. Package-Specific SQLite Fixtures and Deep Schema Guards

Updated:

- `docker/shiny-ohdsi/handoffs.R`
- `docker/shiny-ohdsi/app.R`
- `docker/shiny-ohdsi/tests/handoff_registry_test.R`
- `docs/superpowers/plans/2026-05-09-managed-ohdsi-shiny-followup-execution-plan.md`

The schema guard now validates named result-family variants instead of only
checking table prefixes. This is grounded in the installed runtime assets:

- `PatientLevelPrediction/settings/resultsDataModelSpecification.csv`;
- `CohortMethod/csv/resultsDataModelSpecification.csv`;
- `SelfControlledCaseSeries/csv/resultsDataModelSpecification.csv`;
- `CohortDiagnostics/settings/resultsDataModelSpecification.csv`;
- PheValuator table names queried directly by `OhdsiShinyModules`.

Current accepted SQLite variants include:

- PLP: `plp_model_designs` plus `plp_performances`, or PLP diagnostics;
- population estimation: CohortMethod `cm_analysis` plus `cm_result`, SCCS
  `sccs_analysis` plus `sccs_result`, or EvidenceSynthesis `es_analysis` plus
  `es_cm_result` / `es_sccs_result`;
- CohortDiagnostics: `cd_cohort` plus `cd_cohort_count`;
- characterization/incidence: `c_time_to_event_targets` plus `c_time_to_event`,
  `c_covariate_ref` plus `c_covariate_value`, or `ci_incidence_rate`;
- PheValuator: `pv_algorithm_performance_results` plus `pv_diagnostics`, or
  `pv_model_performance` plus `pv_model_input_parameters`;
- OHDSI report: any recognized managed OHDSI result-family database variant.

The managed app now displays the matched schema variant next to the schema
table count. The handoff test creates real SQLite zip fixtures for all six
official loader families and verifies both positive cases and incomplete
schema variants. Host tests still cover the safe blocked path when the full R
runtime is not installed, while the Shiny OHDSI container test exercises the
package-present path for every official loader family.

### 11. Official Module Entrypoint Smoke

Added:

- `docker/shiny-ohdsi/tests/module_entrypoint_test.R`

The new entrypoint smoke test validates the contract between Parthenon's
handoff registry and the installed OHDSI Shiny packages. For every registered
official handoff, it checks:

- the `OhdsiShinyAppBuilder` config function is exported;
- the config function still points to the registered module id, UI function,
  and server function;
- the `OhdsiShinyModules` UI function is exported;
- the `OhdsiShinyModules` server function is exported;
- the UI function can instantiate a Shiny UI object.

The test skips safely on host runtimes where the OHDSI Shiny packages are not
installed, and it passes inside the Shiny OHDSI container image. This gives us
a light compatibility check before heavier golden-database and browser tests
start exercising full module behavior.

## Implementation Notes

### Launch Service Behavior

`ManagedShinyLaunchService::create()` now computes the launch URL once and only
records an audit event after all launch prerequisites exist:

- launch payload;
- materialized workspace;
- signed token;
- launch URL.

This avoids storing partial `issued` records when the runtime is not configured
or when a launch cannot produce a workspace.

`ManagedShinyLaunchService::resolve()` now marks the matching audit row as
resolved after token validation and workspace preparation. Matching uses both
workspace id and token hash.

### Test Coverage

Backend coverage was expanded with a focused feature test that:

- creates a researcher user;
- creates a study and eligible OHDSI report artifact;
- requests a managed Shiny launch;
- asserts that a `managed_shiny_launches` row was persisted;
- verifies user, study, artifact, app, runtime, mode, status, and token hash;
- resolves the launch context through the public resolver endpoint;
- asserts that the audit record transitions to `resolved`.

Browser coverage was added separately because the ShinyProxy path depends on
real app-container startup and iframe behavior. The browser test is opt-in and
intended for local production-like validation, release checks, and targeted
runtime debugging.

## Verification Performed

Commands and outcomes from this slice:

```bash
cd backend
php -l app/Models/App/ManagedShinyLaunch.php
php -l app/Services/Shiny/ManagedShinyLaunchService.php
php -l database/migrations/2026_05_09_180000_create_managed_shiny_launches_table.php
vendor/bin/pest tests/Feature/Api/V1/StudyArtifactShinyPolicyTest.php tests/Feature/Api/V1/HadesCapabilityTest.php
vendor/bin/pint --test app/Models/App/ManagedShinyLaunch.php app/Services/Shiny/ManagedShinyLaunchService.php database/migrations/2026_05_09_180000_create_managed_shiny_launches_table.php tests/Feature/Api/V1/StudyArtifactShinyPolicyTest.php
vendor/bin/phpstan analyse --memory-limit=1G
vendor/bin/pest tests/Feature/Shiny/CleanupManagedShinyWorkspacesCommandTest.php
vendor/bin/pest tests/Feature/Shiny/ManagedShinyLaunchMetricsTest.php tests/Feature/Api/V1/ManagedShinyLaunchContextRateLimitTest.php tests/Feature/Api/V1/StudyArtifactShinyPolicyTest.php tests/Feature/Api/V1/HadesCapabilityTest.php
Rscript -e 'invisible(parse(file="docker/shiny-ohdsi/app.R")); invisible(parse(file="docker/shiny-ohdsi/manifest.R")); cat("R parse ok\n")'
Rscript docker/shiny-ohdsi/tests/manifest_parser_test.R
Rscript -e 'invisible(parse(file="docker/shiny-ohdsi/app.R")); invisible(parse(file="docker/shiny-ohdsi/manifest.R")); invisible(parse(file="docker/shiny-ohdsi/loaders.R")); cat("R parse ok\n")'
Rscript docker/shiny-ohdsi/tests/loader_registry_test.R
Rscript -e 'invisible(parse(file="docker/shiny-ohdsi/app.R")); invisible(parse(file="docker/shiny-ohdsi/manifest.R")); invisible(parse(file="docker/shiny-ohdsi/loaders.R")); invisible(parse(file="docker/shiny-ohdsi/handoffs.R")); cat("R parse ok\n")'
Rscript docker/shiny-ohdsi/tests/handoff_registry_test.R
docker run --rm --user root -v "$PWD:/workspace" -w /workspace ghcr.io/acumenus-data-sciences/parthenon-shiny-ohdsi:latest sh -lc 'Rscript docker/shiny-ohdsi/tests/manifest_parser_test.R && Rscript docker/shiny-ohdsi/tests/loader_registry_test.R && Rscript docker/shiny-ohdsi/tests/handoff_registry_test.R'
docker run --rm --user root -v "$PWD:/workspace" -w /workspace ghcr.io/acumenus-data-sciences/parthenon-shiny-ohdsi:latest Rscript docker/shiny-ohdsi/tests/handoff_registry_test.R
Rscript docker/shiny-ohdsi/tests/module_entrypoint_test.R
docker run --rm --user root -v "$PWD:/workspace" -w /workspace ghcr.io/acumenus-data-sciences/parthenon-shiny-ohdsi:latest Rscript docker/shiny-ohdsi/tests/module_entrypoint_test.R
```

Results:

- PHP syntax checks passed.
- Focused managed Shiny metrics, launch-context, workspace cleanup, audit, and
  HADES Pest suite passed with 20 tests and 153 assertions.
- R parser validation passed for 6 managed Shiny fixture manifests.
- R loader readiness validation passed for 6 managed Shiny fixture manifests.
- R official viewer handoff detection passed on the host runtime.
- R official viewer handoff detection passed inside the Shiny OHDSI container,
  which exercises the package-present path for `OhdsiShinyModules`,
  `OhdsiShinyAppBuilder`, `DatabaseConnector`, `ResultModelManager`, `RSQLite`,
  and `DBI`.
- SQLite schema guards passed for positive and negative fixture variants across
  all six official managed loader families.
- Official module entrypoint smoke passed inside the Shiny OHDSI container for
  all six managed loader families. The host runtime skipped safely because it
  does not have the OHDSI Shiny packages installed.
- Pint passed after formatting.
- PHPStan passed with no errors.

```bash
cd e2e
npx playwright test tests/managed-shiny.spec.ts --project=chromium --list
npx playwright test tests/managed-shiny.spec.ts --project=chromium
npm run test:shiny
npx tsc --noEmit
```

Results:

- Playwright listed the two managed-Shiny tests.
- Default Playwright run skipped both tests when the opt-in env var was absent.
- Opt-in managed-Shiny smoke passed with 2 tests.
- `npx tsc --noEmit` is still blocked by unrelated pre-existing errors in
  `tests/regression/patient-similarity-visual.spec.ts` and
  `tests/screenshots.spec.ts`.

Additional verification:

```bash
graphify update .
git diff --check -- <managed-Shiny follow-up files>
```

Results:

- Graphify updated the project graph successfully.
- Scoped whitespace checks passed.

## Live Runtime Verification

The new migration was applied to the running application database with the
migration credentials, not the runtime `parthenon_app` credentials. A bare
protected migration command was correctly refused by the application guard, and
the path-specific migration then succeeded with the migrator role.

After the opt-in Shiny smoke ran, the latest live audit record showed a
successful resolved launch for the `ohdsi-report` managed app. This verified
the complete path:

1. study artifact launch request;
2. signed token issuance;
3. workspace materialization;
4. ShinyProxy app launch;
5. launch-context resolution;
6. audit status transition from `issued` to `resolved`.

Transient Shiny app containers created by the browser smoke were stopped after
verification, leaving the ShinyProxy service running.

## Operational Impact

This change gives operators a durable audit trail for successful managed Shiny
launches, scheduled workspace cleanup, System Health metrics, and now a
deterministic R-side readiness and SQLite handoff contract for materialized
result bundles, including family-level schema guards. It does not yet expose a
dedicated admin UI or validate every official OHDSI package viewer against
complete package-specific result fixtures. Those are intentionally listed as
the next follow-up work in the execution plan.

The audit table is designed to support those next steps without another data
model rewrite:

- `status` can expand beyond `issued` and `resolved`;
- `failed_at` and `failure_reason` can support failed-token and failed-runtime
  tracking;
- `metadata` can carry runtime adapter details, package loader detail, or app
  image metadata;
- `workspace_id` remains the stable runtime correlation key.

## Open Follow-Ups

Immediate next backlog items:

- add complete package-specific OHDSI fixture artifacts and deeper schema
  guards for PLP, population estimation, cohort diagnostics, characterization,
  cohort incidence, PheValuator, and report bundles;
- surface managed launch actions on native result pages where artifacts already
  represent supported result families;
- automate HADES latest-target and stable-release-lock drift detection.

## Known Non-Goals In This Slice

This slice does not attempt to make every OHDSI Shiny app fully functional
against every result artifact yet. The scaffold now has manifest validation,
loader registration, bundle readiness checks, and fixture-backed R tests, but
it still needs package-specific OHDSI viewer handoff tests against complete
result fixtures. The official handoff currently supports the SQLite result
database path used by `OhdsiShinyAppBuilder`; non-database bundle formats still
need package-specific import or conversion before they can drive official
modules. The purpose of this increment is to make the transition from manifest
to official viewer deterministic and safe before the app surface becomes
larger.

This slice also does not change the current managed Shiny suppression posture
for arbitrary apps. It continues the policy of surfacing vetted OHDSI Shiny
applications through Parthenon-managed launch context rather than enabling
unreviewed Shiny app exposure.
