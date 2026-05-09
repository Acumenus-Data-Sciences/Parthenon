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

Status: in progress

Rationale: The runtime already touches browser, Laravel, ShinyProxy, Docker,
and R. Before adding richer loaders, preserve the verified path in automated
tests and add operational controls.

Todo:

- [x] Create this execution plan.
- [x] Add opt-in Playwright coverage for successful managed launch.
- [x] Add opt-in Playwright coverage for direct Shiny launch denial.
- [x] Add test documentation and npm script for the managed Shiny smoke suite.
- [x] Add persisted launch audit records.
- [ ] Add workspace retention cleanup.
- [ ] Add operator metrics for launches, token failures, app starts, and active
  sessions.
- [ ] Add rate-limit or abuse-control review for `/api/v1/shiny/launch-context`.

Acceptance:

- `PLAYWRIGHT_ENABLE_SHINY_SMOKE=1` runs the managed launch and denial tests
  against a configured local or production-like deployment.
- Tests create or locate their own eligible artifact instead of relying on
  manual fixture state.
- Direct `/shiny/app/...` access without a token renders the denial path.
- Successful launch verifies study/artifact context and OHDSI Shiny package
  availability from inside the app iframe.

### Phase 1: Result Bundle Loader Contract

Status: pending

Rationale: Every managed Shiny app should consume a canonical launch manifest.
The manifest must be stable enough that Shiny, native React viewers, publish
exports, and result importers can share it.

Todo:

- [ ] Define `managed-shiny-manifest.json` schema for launch workspaces.
- [ ] Add manifest generation to `ManagedShinyLaunchService`.
- [ ] Include result family, artifact type, MIME type, local materialized file,
  metadata hints, and loader selection.
- [ ] Add Laravel tests for manifest generation by result type.
- [ ] Add Shiny app-side manifest parser with validation errors that are visible
  but do not leak sensitive paths.
- [ ] Add fixture manifests for PLP, population estimation, cohort diagnostics,
  characterization, PheValuator, and report bundles.

Acceptance:

- Every launch workspace has `context.json` and `managed-shiny-manifest.json`.
- The Shiny runtime chooses a loader from manifest fields rather than ad hoc
  title matching.
- Invalid or unsupported manifests render a clear unsupported-result message.

### Phase 2: Package-Specific Loaders

Status: pending

Rationale: The scaffold must become useful for real OHDSI result exploration.
Each loader should prefer official OHDSI package APIs and degrade to manifest
inspection when the artifact does not contain a complete result bundle.

Todo:

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
- [ ] Shared unsupported/incomplete bundle UI.
- [ ] R-level smoke tests for each loader with fixture artifacts.

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
- [ ] Add explicit invalid-token audit/non-disclosure assertions once failed
  launch auditing is introduced.

### P0-C: Workspace Cleanup

- [ ] Add `php artisan shiny:cleanup-workspaces`.
- [ ] Delete expired launch workspaces after configurable grace period.
- [ ] Support dry-run mode.
- [ ] Add scheduler registration.
- [ ] Add tests for expired, active, and malformed workspace names.

### P1-A: Manifest Contract

- [ ] Add manifest writer to Laravel launch service.
- [ ] Add manifest reader in Shiny app.
- [ ] Add fixture manifests under `docker/shiny-ohdsi/tests/fixtures`.
- [ ] Add R parse/validation test command.

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

- Phase 0 is active.
- Completed implementation slices:
  - `P0-A Managed Shiny Playwright Smoke`
  - `P0-B Launch Audit`
- Next implementation slice: `P0-C Workspace Cleanup`.
