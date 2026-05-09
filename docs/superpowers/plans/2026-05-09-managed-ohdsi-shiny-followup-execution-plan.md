# Managed OHDSI Shiny Follow-Up Execution Plan

Date: 2026-05-09

## Goal

Finish the follow-up backlog from the HADES parity and managed OHDSI Shiny
runtime milestone by moving the feature from verified runtime scaffold to a
production-grade OHDSI result-viewing compatibility layer.

The target state is:

- HADES package freshness is checked automatically and can open remediation PRs.
- Stable HADES release-lock parity is checked independently from latest-target
  parity.
- Managed OHDSI Shiny launches have durable browser coverage.
- Each registered managed Shiny app can load the result bundle family it claims
  to support.
- Native Parthenon result pages expose managed launch actions where useful.
- Launches are audited, observable, cleaned up, and ready for licensed
  enterprise runtimes.

## Current Baseline

Already shipped:

- Darkstar `/hades/packages` reports package presence, target/latest versions,
  freshness counts, release profile metadata, managed Shiny policy, and managed
  app registry.
- Laravel normalizes HADES inventory and exposes managed Shiny metadata.
- Study artifacts can launch vetted managed Shiny apps through short-lived
  signed launch tokens.
- ShinyProxy 3.2.4 is wired into the Docker and live Apache/nginx runtime.
- `docker/shiny-ohdsi` resolves Parthenon launch context and renders a verified
  scaffold view.
- Live smoke verified successful `ohdsi-report` launch and direct access denial.

Known remaining gap:

- The launch path is real, but package-specific OHDSI result loaders are still
  scaffolded. The app reports context and package versions, but it does not yet
  hydrate every OHDSI result bundle into the corresponding community viewer.

## Execution Order

### Phase 0: Guardrails Before More Runtime Surface

Status: complete

Rationale: The runtime already touches browser, Laravel, ShinyProxy, Docker,
and R. Before adding richer loaders, preserve the verified path in automated
tests and add operational controls.

Todo:

- [x] Create this execution plan.
- [x] Add opt-in Playwright coverage for successful managed launch.
- [x] Add opt-in Playwright coverage for direct Shiny launch denial.
- [x] Add test documentation and npm script for the managed Shiny smoke suite.
- [x] Add persisted launch audit records.
- [x] Add workspace retention cleanup.
- [x] Add operator metrics for launches, token failures, app starts, and active
  sessions.
- [x] Add rate-limit or abuse-control review for `/api/v1/shiny/launch-context`.

Acceptance:

- `PLAYWRIGHT_ENABLE_SHINY_SMOKE=1` runs the managed launch and denial tests
  against a configured local or production-like deployment.
- Tests create or locate their own eligible artifact instead of relying on
  manual fixture state.
- Direct `/shiny/app/...` access without a token renders the denial path.
- Successful launch verifies study/artifact context and OHDSI Shiny package
  availability from inside the app iframe.

### Phase 1: Result Bundle Loader Contract

Status: complete

Rationale: Every managed Shiny app should consume a canonical launch manifest.
The manifest must be stable enough that Shiny, native React viewers, publish
exports, and result importers can share it.

Todo:

- [x] Define `managed-shiny-manifest.json` schema for launch workspaces.
- [x] Add manifest generation to `ManagedShinyLaunchService`.
- [x] Include result family, artifact type, MIME type, local materialized file,
  metadata hints, and loader selection.
- [x] Add Laravel tests for manifest generation by result type.
- [x] Add Shiny app-side manifest parser with validation errors that are visible
  but do not leak sensitive paths.
- [x] Add fixture manifests for PLP, population estimation, cohort diagnostics,
  characterization, PheValuator, and report bundles.

Acceptance:

- Every launch workspace has `context.json` and `managed-shiny-manifest.json`.
- The Shiny runtime chooses a loader from manifest fields rather than ad hoc
  title matching.
- Invalid or unsupported manifests render a clear unsupported-result message.

### Phase 2: Package-Specific Loaders

Status: in progress

Rationale: The scaffold must become useful for real OHDSI result exploration.
Each loader should prefer official OHDSI package APIs and degrade to manifest
inspection when the artifact does not contain a complete result bundle.

Todo:

- [x] Add shared loader registry for every managed OHDSI app family.
- [x] Add safe workspace-relative path validation for materialized bundles.
- [x] Add readable-bundle and safe-entry validation for zip result bundles.
- [x] Add shared unsupported/incomplete bundle UI.
- [x] Add R-level readiness tests for fixture manifests.
- [x] Add official OHDSI module handoff registry for SQLite result databases.
- [x] Detect SQLite result databases from direct files or safe zip entries.
- [x] Prepare `DatabaseConnector` SQLite connection details for official module
  handoff when runtime packages are present.
- [x] Add SQLite schema guards for required metadata tables and registered
  result-family table prefixes.
- [x] Add variant-based SQLite guards with concrete OHDSI result table aliases
  for all official managed loader families.
- [x] Add positive and negative SQLite fixture coverage for every official
  managed loader family.
- [ ] PLP loader for PatientLevelPrediction result bundles.
- [ ] Population estimation loader for CohortMethod results.
- [ ] Population estimation loader for SelfControlledCaseSeries results.
- [ ] Population estimation loader for EvidenceSynthesis results.
- [ ] CohortDiagnostics loader.
- [ ] Characterization loader.
- [ ] CohortIncidence loader.
- [ ] PheValuator loader.
- [ ] OHDSI report bundle loader.
- [ ] OHDSI sharing bundle loader.
- [ ] R-level smoke tests for each package-specific OHDSI viewer handoff with
  complete fixture artifacts.

Acceptance:

- Each registered app can detect whether a materialized artifact is usable for
  that app.
- Complete bundles open the corresponding OHDSI module/viewer.
- Incomplete bundles fail softly with actionable missing-file detail.

### Phase 3: Native Result Page Launch Surfaces

Status: pending

Rationale: Study artifacts are the first launch surface, but users will also
expect managed viewers where they inspect analysis outputs.

Todo:

- [ ] Add managed Shiny launch action to PLP result pages.
- [ ] Add managed Shiny launch action to population-level estimation results.
- [ ] Add managed Shiny launch action to SCCS results.
- [ ] Add managed Shiny launch action to Evidence Synthesis results.
- [ ] Add managed Shiny launch action to Cohort Diagnostics pages.
- [ ] Add managed Shiny launch action to Characterization pages.
- [ ] Add managed Shiny launch action to PheValuator pages.
- [ ] Reuse the same backend launch endpoint or add result-specific launch
  endpoints only if artifact launches cannot represent the result bundle.
- [ ] Add frontend integration tests for viewer discovery.

Acceptance:

- Users can discover managed Shiny viewers from the result page they are already
  using.
- Buttons are hidden when the runtime cannot support the result family.
- Launch actions do not appear for arbitrary URLs or untrusted paths.

### Phase 4: HADES Version Automation

Status: pending

Rationale: Manual target-version review will drift. The target inventory needs
scheduled verification against upstream metadata and the stable HADES release
lock profile.

Todo:

- [ ] Add a script that refreshes target versions from upstream package metadata.
- [ ] Add a script that validates installed targets against HADES-wide
  `2026Q1/renv.lock`.
- [ ] Keep latest-target mode distinct from stable-release-lock mode.
- [ ] Add a GitHub Actions scheduled workflow.
- [ ] Open a PR when target versions or lockfile parity changes.
- [ ] Add a human-readable report artifact for operators.

Acceptance:

- CI can say whether Parthenon is current against latest target metadata.
- CI can separately say whether Parthenon matches the configured HADES release
  lock.
- Drift produces a reviewable PR, not silent runtime entropy.

### Phase 5: Runtime Operations

Status: pending

Rationale: Managed Shiny is now a runtime surface. It needs the same operational
discipline as other Parthenon services.

Todo:

- [ ] Persist launch audit records with user, study, artifact, app key, runtime,
  workspace id, expiry, and outcome.
- [ ] Record token resolution success/failure counts.
- [ ] Record app start latency and resolver latency.
- [ ] Add workspace cleanup command and scheduler.
- [ ] Add admin-visible active session count.
- [ ] Add Posit Connect adapter configuration for licensed deployments.
- [ ] Document recovery steps for Docker socket, ShinyProxy, and app-image
  failures.

Acceptance:

- Operators can answer who launched what, when, and whether it succeeded.
- Expired workspaces do not accumulate indefinitely.
- System Health can distinguish package parity from launch-runtime health.

### Phase 6: Golden Data and End-to-End Quality

Status: pending

Rationale: Result loaders need repeatable data. Eunomia and small synthetic
fixtures should anchor regression tests.

Todo:

- [ ] Add golden Eunomia result artifacts for supported managed viewer families.
- [ ] Add Shiny launch manifests for each fixture.
- [ ] Add R loader smoke tests against those fixtures.
- [ ] Add Playwright tests for viewer discovery on Study Artifacts and result
  pages.
- [ ] Add a production smoke checklist covering `/`, `/login`, `/jobs`,
  System Health, `/api/v1/hades/packages`, and one managed viewer.

Acceptance:

- Loader changes can be validated without hand-built local artifacts.
- Browser coverage proves the user-visible path, not just API responses.

## Detailed Implementation Todo

### P0-A: Managed Shiny Playwright Smoke

- [x] Add `e2e/tests/managed-shiny.spec.ts`.
- [x] Add helper to create a temporary OHDSI report study artifact through the
  authenticated API.
- [x] Add helper to call the artifact `shiny-launch` endpoint.
- [x] Add helper to resolve relative launch URLs against `PLAYWRIGHT_BASE_URL`.
- [x] Wait across ShinyProxy parent page and iframe frames.
- [x] Assert successful iframe content includes:
  - managed app heading
  - workspace id
  - study artifact title
  - `OhdsiShinyModules`
  - `OhdsiShinyAppBuilder`
- [x] Assert direct `/shiny/app/plp-results` access renders launch-token denial.
- [x] Gate the suite behind `PLAYWRIGHT_ENABLE_SHINY_SMOKE=1`.

Run command:

```bash
cd e2e
npm run test:shiny
```

### P0-B: Launch Audit

- [x] Add `managed_shiny_launches` migration.
- [x] Add model and relationship points to user, study, and artifact.
- [x] Persist launch request, token expiry, workspace id, app key, mode, runtime,
  and status.
- [x] Update status when launch context resolves.
- [x] Add tests for audit persistence and context resolution.
- [x] Add explicit correlatable failed-token audit/non-disclosure assertions.

### P0-C: Workspace Cleanup

- [x] Add `php artisan shiny:cleanup-workspaces`.
- [x] Delete expired launch workspaces after configurable grace period.
- [x] Delete stale pre-audit UUID workspaces after configurable orphan grace
  period.
- [x] Support dry-run mode.
- [x] Add scheduler registration.
- [x] Add tests for expired, active, and malformed workspace names.

Run commands:

```bash
cd backend
php artisan shiny:cleanup-workspaces --dry-run
php artisan shiny:cleanup-workspaces --grace-minutes=60
```

### P0-D: Metrics and Launch-Context Abuse Controls

- [x] Add named `shiny-launch-context` rate limiter.
- [x] Make the launch-context limit configurable through
  `SHINY_LAUNCH_CONTEXT_RATE_LIMIT_PER_MINUTE`.
- [x] Replace broad numeric route throttle with the named limiter.
- [x] Record failed outcomes for correlatable expired/context-mismatch/workspace
  preparation failures without persisting bearer tokens.
- [x] Add managed Shiny launch metrics service.
- [x] Surface managed Shiny metrics through System Health as `managed-shiny`.
- [x] Add tests for metrics, throttling, and expired-token non-disclosure.

Metrics include total launches, status counts, launches/resolutions/failures in
the last 24 hours, active sessions, pending launches, expired unresolved
launches, average resolution latency, last issued/resolved/failed timestamps,
failure reason counts, and the configured launch-context rate limit.

### P1-A: Manifest Contract

- [x] Add manifest writer to Laravel launch service.
- [x] Add manifest reader in Shiny app.
- [x] Add fixture manifests under `docker/shiny-ohdsi/tests/fixtures`.
- [x] Add R parse/validation test command.

Run commands:

```bash
cd backend
vendor/bin/pest tests/Feature/Api/V1/StudyArtifactShinyPolicyTest.php
cd ..
Rscript docker/shiny-ohdsi/tests/manifest_parser_test.R
```

### P2-A: Loader Registry and Bundle Readiness

- [x] Add `docker/shiny-ohdsi/loaders.R`.
- [x] Register PLP, population estimation, cohort diagnostics,
  characterization, PheValuator, OHDSI report, and generic managed loaders.
- [x] Validate materialized bundle files stay inside the launch workspace.
- [x] Reject missing bundles, unsafe relative paths, unsupported extensions,
  unreadable zip files, and unsafe zip entry paths with safe user-facing
  messages.
- [x] Render loader readiness from the Shiny app before deeper OHDSI module
  handoff.
- [x] Copy the loader helper into the managed Shiny image.
- [x] Add `docker/shiny-ohdsi/tests/loader_registry_test.R`.

Run commands:

```bash
Rscript -e 'invisible(parse(file="docker/shiny-ohdsi/app.R")); invisible(parse(file="docker/shiny-ohdsi/manifest.R")); invisible(parse(file="docker/shiny-ohdsi/loaders.R")); cat("R parse ok\n")'
Rscript docker/shiny-ohdsi/tests/manifest_parser_test.R
Rscript docker/shiny-ohdsi/tests/loader_registry_test.R
```

### P2-B: Official SQLite Result Database Handoff

- [x] Add `docker/shiny-ohdsi/handoffs.R`.
- [x] Register official `OhdsiShinyModules` UI/server functions for PLP,
  population estimation, cohort diagnostics, characterization, PheValuator, and
  OHDSI report result families.
- [x] Detect direct `.sqlite`, `.sqlite3`, and `.db` result database artifacts.
- [x] Detect and extract SQLite result databases from already-validated zip
  bundles using safe zip entry paths.
- [x] Build `DatabaseConnector::createConnectionDetails(dbms = "sqlite")` and
  `OhdsiShinyAppBuilder::createDefaultResultDatabaseSettings(schema = "main")`
  for official viewer handoff.
- [x] Render the official module UI inside the managed Shiny app when a handoff
  is ready.
- [x] Start the corresponding official module server with a
  `ResultModelManager::ConnectionHandler`.
- [x] Add `docker/shiny-ohdsi/tests/handoff_registry_test.R`.
- [x] Validate the handoff test on the host R runtime and inside the Shiny OHDSI
  container image.

Run commands:

```bash
Rscript -e 'invisible(parse(file="docker/shiny-ohdsi/app.R")); invisible(parse(file="docker/shiny-ohdsi/manifest.R")); invisible(parse(file="docker/shiny-ohdsi/loaders.R")); invisible(parse(file="docker/shiny-ohdsi/handoffs.R")); cat("R parse ok\n")'
Rscript docker/shiny-ohdsi/tests/handoff_registry_test.R
docker run --rm --user root -v "$PWD:/workspace" -w /workspace ghcr.io/acumenus-data-sciences/parthenon-shiny-ohdsi:latest sh -lc 'Rscript docker/shiny-ohdsi/tests/manifest_parser_test.R && Rscript docker/shiny-ohdsi/tests/loader_registry_test.R && Rscript docker/shiny-ohdsi/tests/handoff_registry_test.R'
```

### P2-C: SQLite Schema Guards

- [x] Require `RSQLite`, `DBI`, and `OhdsiReportGenerator` for official SQLite
  handoff readiness.
- [x] Inspect candidate SQLite result databases before constructing official
  module connection details.
- [x] Require `database_meta_data` for official module handoff.
- [x] Render schema table counts in the managed Shiny app handoff panel.
- [x] Extend handoff tests to create real SQLite fixtures on host and container
  runtimes.
- [x] Add negative coverage for a SQLite database missing PLP result tables.

Run commands:

```bash
Rscript docker/shiny-ohdsi/tests/handoff_registry_test.R
docker run --rm --user root -v "$PWD:/workspace" -w /workspace ghcr.io/acumenus-data-sciences/parthenon-shiny-ohdsi:latest Rscript docker/shiny-ohdsi/tests/handoff_registry_test.R
```

### P2-D: Package-Specific SQLite Fixtures and Deep Schema Guards

- [x] Replace prefix-only guards with named schema variants.
- [x] Validate PLP databases through concrete `plp_model_designs` plus
  `plp_performances` or diagnostics tables.
- [x] Validate population estimation databases through concrete CohortMethod,
  SCCS, or EvidenceSynthesis result-table pairs.
- [x] Validate CohortDiagnostics databases through `cd_cohort` and
  `cd_cohort_count`.
- [x] Validate characterization and incidence databases through concrete
  `c_...` or `ci_...` result-table pairs.
- [x] Validate PheValuator databases through concrete `pv_...` result-table
  pairs used by `OhdsiShinyModules`.
- [x] Validate OHDSI report SQLite databases only when they match a known OHDSI
  result-family schema variant.
- [x] Render the matched schema variant in the managed Shiny app.
- [x] Expand R handoff fixtures to cover PLP, population estimation,
  CohortDiagnostics, characterization/incidence, PheValuator, and OHDSI report
  positive cases.
- [x] Add negative fixture coverage for incomplete schema variants across all
  official managed loader families.

Run commands:

```bash
Rscript -e 'invisible(parse(file="docker/shiny-ohdsi/app.R")); invisible(parse(file="docker/shiny-ohdsi/manifest.R")); invisible(parse(file="docker/shiny-ohdsi/loaders.R")); invisible(parse(file="docker/shiny-ohdsi/handoffs.R")); cat("R parse ok\n")'
Rscript docker/shiny-ohdsi/tests/manifest_parser_test.R
Rscript docker/shiny-ohdsi/tests/loader_registry_test.R
Rscript docker/shiny-ohdsi/tests/handoff_registry_test.R
docker run --rm --user root -v "$PWD:/workspace" -w /workspace ghcr.io/acumenus-data-sciences/parthenon-shiny-ohdsi:latest Rscript docker/shiny-ohdsi/tests/handoff_registry_test.R
```

### P2-E-A: Official Module Entrypoint Smoke

- [x] Add `docker/shiny-ohdsi/tests/module_entrypoint_test.R`.
- [x] Validate every registered handoff has an exported
  `OhdsiShinyAppBuilder` config function.
- [x] Validate each config function still maps to the registered module id,
  UI function, and server function.
- [x] Validate every registered `OhdsiShinyModules` UI function instantiates a
  Shiny UI object.
- [x] Skip safely on host runtimes that do not have the OHDSI Shiny packages.
- [x] Pass inside the Shiny OHDSI container image where the official packages
  are installed.

Run commands:

```bash
Rscript docker/shiny-ohdsi/tests/module_entrypoint_test.R
docker run --rm --user root -v "$PWD:/workspace" -w /workspace ghcr.io/acumenus-data-sciences/parthenon-shiny-ohdsi:latest Rscript docker/shiny-ohdsi/tests/module_entrypoint_test.R
```

## Risk Notes

- ShinyProxy tests can be slow because app containers start on demand. The
  browser smoke timeout should be longer than normal UI tests.
- Production Shiny smoke tests create temporary studies/artifacts. The test must
  clean them up through the API.
- Package-specific loaders should not assume every uploaded artifact is a
  complete OHDSI zip. Unsupported/incomplete artifacts must render safe, useful
  errors.
- The public launch-context resolver must continue to disclose only validation
  state, never filesystem internals or broader study metadata without a valid
  token.

## Current Execution Status

- Phase 0 is complete.
- Completed implementation slices:
  - `P0-A Managed Shiny Playwright Smoke`
  - `P0-B Launch Audit`
  - `P0-C Workspace Cleanup`
  - `P0-D Metrics and Launch-Context Abuse Controls`
  - `P1-A Manifest Contract`
  - `P2-A Loader Registry and Bundle Readiness`
  - `P2-B Official SQLite Result Database Handoff`
  - `P2-C SQLite Schema Guards`
  - `P2-D Package-Specific SQLite Fixtures and Deep Schema Guards`
  - `P2-E-A Official Module Entrypoint Smoke`
- Next implementation slice: `P2-E-B Golden Package Result Databases and
  Browser Smoke`.
