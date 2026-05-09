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

The plan also includes concrete P0 and P1 todo lists. P0-A and P0-B are now
executed in this slice: browser smoke coverage and launch audit persistence are
in place. Workspace cleanup, metrics, rate-limit review, failed-token auditing,
manifest generation, and real package loaders remain open follow-up items.

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
```

Results:

- PHP syntax checks passed.
- Focused Pest suite passed with 12 tests and 84 assertions.
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
launches. It does not yet expose an admin UI, metrics dashboard, or cleanup
command. Those are intentionally listed as follow-up work in the execution
plan.

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

- add workspace retention cleanup and dry-run support;
- add failed-token audit behavior without leaking token validation details;
- add launch and resolver metrics;
- review rate limits for the public launch-context resolver;
- define `managed-shiny-manifest.json`;
- teach the Shiny runtime to parse that manifest;
- add package-specific loaders for PLP, population estimation, cohort
  diagnostics, characterization, cohort incidence, PheValuator, and report
  bundles;
- surface managed launch actions on native result pages where artifacts already
  represent supported result families;
- automate HADES latest-target and stable-release-lock drift detection.

## Known Non-Goals In This Slice

This slice does not attempt to make every OHDSI Shiny app fully functional
against every result artifact yet. The scaffold still needs package-specific
loaders and fixture-backed R tests. The purpose of this commit is to preserve
the launch path and add auditability before the app surface becomes larger.

This slice also does not change the current managed Shiny suppression posture
for arbitrary apps. It continues the policy of surfacing vetted OHDSI Shiny
applications through Parthenon-managed launch context rather than enabling
unreviewed Shiny app exposure.
