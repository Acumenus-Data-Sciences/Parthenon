---
doc_type: plan
status: open
date: 2026-06-18
owner: acumenus
module: platform
lineage_anchor: true
supersedes: []
superseded_by: null
related_code:
  - backend/app/Services/Analysis/EstimationService.php
  - backend/app/Services/Analysis/PredictionService.php
  - backend/app/Services/Analysis/SccsService.php
  - backend/app/Services/Analysis/EvidenceSynthesisService.php
  - backend/app/Services/GIS/GisImportService.php
  - backend/app/Http/Controllers/Api/V1/PatientSimilarityController.php
  - backend/app/Http/Requests/PatientSimilarityExportCohortRequest.php
  - backend/app/Http/Controllers/Api/V1/GisImportController.php
  - backend/app/Jobs/GisImportJob.php
  - backend/app/Services/GIS/GisImportService.php
  - backend/tests/Feature/Achilles/ResultsSchemaRoutingTest.php
  - backend/tests/Feature/GisImportApiTest.php
  - backend/tests/Feature/GisImportTest.php
  - backend/tests/Feature/Api/V1/PhenotypeValidationTest.php
  - backend/tests/Feature/Api/V1/PatientSimilarityExportCohortTest.php
  - frontend/src/features/administration/pages/FhirExportPage.tsx
  - frontend/src/features/commons/components/abby/AbbyResponseCard.tsx
  - frontend/src/features/commons/components/abby/AskAbbyChannel.tsx
  - frontend/src/features/data-sources/components/add-source-steps/DatabaseStep.tsx
  - frontend/src/features/etl/pages/SourceProfilerPage.tsx
  - frontend/src/features/patient-similarity/components/CohortExportDialog.tsx
  - frontend/src/features/patient-similarity/components/PsmPanel.tsx
  - frontend/src/features/patient-similarity/pages/PatientSimilarityWorkspace.tsx
  - templates/runtime/orchestration/airflow_backend.py
  - templates/runtime/orchestration/dagster_backend.py
  - templates/runtime/orchestration/temporal_backend.py
  - templates/tests/performance/test_fhir_to_omop_throughput.py
related_prs: []
---

# Parthenon Application Completion Plan

This plan records the unfinished work found during a deep completion audit on
2026-06-18. It is intentionally broad: Parthenon now spans Laravel APIs,
React workbenches, ingestion templates, OHDSI/HADES analysis services,
installer tooling, publication workflows, PACS/GIS/genomics modules, and
lineage documentation. Completion means the shipped product no longer exposes
"coming soon" surfaces as primary workflows, high-signal tests are either
passing or intentionally retired, and open plans have clear closeout evidence.

> **Reconciliation 2026-06-21.** An 11-section evidence audit (each newly-done
> claim adversarially re-verified, several by running the cited tests) reconciled
> the checkboxes below against the codebase after the A1–A5 / Gate-B work of
> 2026-06-19..21, followed by a bounded implementation pass. **Progress: 76 of
> 178 checklist items complete.** Work landed this pass:
>
> - **Reconciliation + Phase 3 closeout** (`dcdf34a39`): checked off Phase 0
>   bounded test lanes and all of Phase 3's protocol-to-publication block (P0–P6
>   + parent), HADES sidecar verification, sidecar contract tests, package
>   closeout, the `r_not_implemented` decision, and the phenotype-validation
>   backlog. Per-phase evidence in
>   `docs/lineage/modules/studies/2026-06-21-protocol-to-publication-closeout.md`.
> - **Sidecar readiness** (`54dcbeb0d`): new `php artisan sidecars:readiness`
>   command (darkstar/python-ai/redis/PACS + others) → closed 4 Phase 8 readiness
>   items and feeds the promotion gates.
> - **Optional-scope decisions** (`5c311f718`, ADR-0021): connectors →
>   enterprise-only; Airflow/Dagster/Temporal → developer-extension examples
>   (relabeled in code); DOCX/XLSX → implement. Closed the Phase 4 connector-matrix
>   and Phase 9 enterprise-scope decisions.
> - **Publish export** (`e6aaeff1e`, `41de1dce8`): DOCX confirmed already live in
>   `ExportPanel`; XLSX implemented (`XlsxExporter` + wired into the panel). Phase 5
>   publish-export reconciliation closed.
>
> Items left unchecked are genuinely open, `partial`, or follow-ups per the audit
> (sidecar UI diagnostics, FHIR-export page wiring, Source Profiler comparison,
> 8 ingestion-template Phase-4 plans, signed releases, promotion-gate definitions,
> connector UI enterprise relabel, frontend chunk-splitting + lint).

## Audit Evidence

- Read `graphify-out/GRAPH_REPORT.md` before source triage. The graph covers
  4,753 files, 31,987 nodes, 60,665 edges, and 912 communities. The major risk
  centers are database/schema hubs, ETL/ingestion templates, AI/agent services,
  anonymizer/FHIR code, vector search, installer tooling, study agents, PACS,
  GIS, HADES/Darkstar analysis, publication workflows, and care-bundle modules.
- Read `docs/lineage/document-authoring-governance.md` before writing this
  plan. This file is an active WIP plan and therefore belongs in
  `docs/lineage/plans/open/`.
- Reviewed `docs/lineage/plans/open/README.md` and open plan files. The open
  backlog already includes signed release packaging and eight ingestion
  template Phase 4 plans.
- Reviewed active plan drift: `docs/lineage/plans/open/protocol-to-publication-implementation-plan.md`
  is the active protocol-to-publication implementation plan; `docs/lineage/plans/closed/2026-06-15-local-model-agent-backend-ce.md`
  is the shipped local-model agent backend plan.
- Searched backend, frontend, templates, and lineage plans for explicit
  incomplete markers: `coming soon`, `TODO`, `not_implemented`,
  `NotImplementedError`, skipped tests, and backlog references.
- Ran validation gates to distinguish real blockers from cosmetic backlog:
  `./vendor/bin/pint --test`, `./vendor/bin/phpstan analyse --no-progress`,
  frontend build/lint, template pytest, and a Laravel feature/unit suite run.

## Validation Snapshot

| Gate | Result | Completion implication |
|---|---|---|
| `cd backend && ./vendor/bin/pint --test` | Pass | PHP formatting is not blocking completion work. |
| `cd backend && ./vendor/bin/phpstan analyse --no-progress` | Pass | Static PHP typing is not currently blocking completion work. |
| `cd frontend && npm run build` | Pass with chunk-size warnings | The frontend builds, but bundle size and code splitting remain completion work. This was a validation gate, not the frontend deploy path. |
| `cd frontend && npm run lint` | Pass with 34 warnings (was 42; `ChartCard` extraction cleared 8) | React Compiler/hook purity and Fast Refresh warnings should be burned down before declaring frontend completion. |
| `cd templates && uv run pytest -q` | Pass after implementation: 1295 passed, 11 skipped, 2 warnings | The original FHIR-to-OMOP throughput failure is fixed. Remaining skips are environment-bound sidecar/fixture gates. |
| `cd backend && composer test:unit` | Pass after implementation: 99 passed, 576 deprecated, 7719 assertions | The pre-migrated local PostgreSQL test schema now reuses transactions instead of replaying `migrate:fresh` into a multi-schema database. |
| `cd backend && composer test:integration` | Pass after implementation: 8 deprecated, 43 assertions | Search-path integration coverage now accepts the runtime test-harness path while preserving exact config assertions. |
| `cd backend && composer test:feature:api` | Pass after implementation: 501 deprecated, 1950 assertions | The API lane is bounded and catches persistent-state leaks, including the fixed AI-agent settings precondition. |
| `cd backend && composer test:feature:finngen` | Pass after implementation: 302 deprecated, 1197 assertions | FinnGen feature tests are now isolated from stale endpoint/profile rows in the persistent local test database. |
| `cd backend && composer test:feature:modules` | Pass after implementation: 294 deprecated, 965 assertions | Non-API feature modules have a bounded local lane separate from API, FinnGen, integration, and live-OMOP checks. |
| `cd backend && php artisan test tests/Feature/Database/CrossSchemaForeignKeyTest.php --stop-on-failure --compact` | Pass after implementation with 0 assertions by default | The 177M-row live OMOP FK audit is opt-in through `PARTHENON_LIVE_OMOP_FK_AUDIT=1` and no longer stalls normal local runs. |
| `cd backend && timeout 900s php artisan test --stop-on-failure` | Still timed out after 15m, but later runs progressed well past the former CrossSchema stall | Treat the monolithic backend command as legacy until it is retired or wired to bounded lanes. Use the Composer lanes above for reproducible local gates. |

## Findings

| Priority | Area | Evidence | Risk |
|---|---|---|---|
| P0 | FHIR-to-OMOP throughput | Fixed in this pass: zero-resource mappers now emit empty JSON artifacts, `load_to_cdm` treats optional missing artifacts as empty, and the one-million-observation template gate passes. | Keep environment-bound ingestion skips visible until sidecar/fixture readiness is owned. |
| P0 | Achilles schema routing | Improved in this pass: the targeted Achilles routing test passes, includes a deterministic SourceContext regression, and live host checks now skip with actionable diagnostics when catalog tables are unavailable. | The full backend suite still needs a bounded default command. |
| P0 | Test-suite observability | Improved in this pass: bounded Composer lanes now cover unit, integration, API feature, FinnGen feature, non-API feature modules, and explicit live-OMOP checks. The monolithic `php artisan test` command still timed out under a 15-minute cap. | Engineers should use the split lanes until the legacy monolithic command is retired or made equivalently bounded. |
| P1 | Documentation governance | Fixed in this pass: the shipped local-model plan moved to `plans/closed/`, the active protocol-to-publication plan moved to `plans/open/`, and the open README/catalog were reconciled. | Continue checking future plan lifecycle changes in the same commit that moves or closes docs. |
| P1 | Protocol-to-publication | RESOLVED 2026-06-21: all seven phases (P0–P6) shipped with code + passing tests; closeout at `docs/lineage/modules/studies/2026-06-21-protocol-to-publication-closeout.md`. | Implementation plan stays open only for the live `execute=true` study-114 gated re-run. |
| P1 | HADES/Darkstar analytics | RESOLVED 2026-06-21: 40/40 HADES packages verified, real end-to-end estimation; `r_not_implemented` retained as a defensive fallback (decision recorded); `RServiceTest` covers success/failed/unavailable/invalid; `sidecars:readiness` probes the sidecar. | UI sidecar-pending copy is still generic (partial); anonymizer/SciSpaCy/Llettuce readiness pending. |
| P1 | Phenotype validation | RESOLVED 2026-06-21: the 8 skipped cases are gone; `PhenotypeValidationTest.php` has 17 passing contract cases over the multi-reviewer adjudication flow. | Frontend contract coverage for the resolved behavior remains a follow-up. |
| P1 | FHIR export | PARTIAL: the OMOP→FHIR `$export` backend exists (`FhirR4Controller` + job + auth + tests), but `FhirExportPage.tsx` is still a "coming soon" placeholder not wired to it; no audit-logging/retention/cancel yet. | A visible administration workflow remains unfinished; backend is reachable via API. |
| P1 | GIS import | Fixed in this implementation pass: `.xlsx` and `.xls` uploads now produce previews, stream rows through the GIS import job, skip blank spreadsheet rows, and preserve CSV/TSV behavior. | Very large spreadsheets should still be monitored operationally, but the visible "Excel support coming soon" path is gone. |
| P1 | Patient similarity | Fixed in this implementation pass: matched PSM person IDs can now be exported through `/api/v1/patient-similarity/export-cohort`, materialized into the source results cohort table, and launched from the PSM workspace export dialog. | Keep future PSM enhancements focused on long-running job UX only if matched cohorts exceed the synchronous 10,000-patient contract. |
| P1 | Abby source handling | Fixed in this pass for the first product slice: `/data` queries now use `activeSourceId ?? defaultSourceId`, missing source selection blocks with an inline error, and source cards navigate to internal artifacts or external URLs. | Broader Abby workflows still need auditing for default-source, active-project, cohort, permission, and provenance assumptions. |
| P2 | Source connectors | DECIDED 2026-06-21 (ADR-0021): BigQuery, Redshift, Snowflake, Databricks, and Cloud Spanner are **enterprise-only**. | UI still labels them "Coming Soon"; the relabel to an Enterprise tier badge is a tracked i18n follow-up. |
| P2 | ETL profiler comparison | Source profiler comparison view is a placeholder pending comparison API. | Cross-project/source profiling remains incomplete. |
| P2 | Orchestration adapters | RESOLVED 2026-06-21 (ADR-0021): Airflow/Dagster/Temporal relabeled as **developer-extension examples** (Prefect is the shipped backend); docstrings + `NotImplementedError` messages + test updated. | Not core product promises; implementing one fully remains an optional future. |
| P2 | Release packaging | Existing open plan still lacks verified signed release assets across target platforms. | Native release trust chain remains incomplete. |
| P2 | Ingestion template Phase 4 | Existing open plans track BGE-base LoRA, timed reviewer tests, auto-approval calibration, rerank decision, Llettuce reevaluation, FHIR Bulk Data reader, federated mapping spike, and upstream diff workflows. | Template/product parity depends on closing or explicitly deferring these plans. |
| P2 | Frontend quality | Build emits very large chunks; lint down to 34 warnings (from 42, after the `ChartCard` extraction) across hooks, immutability, purity, Fast Refresh, and unused variables. | The UI is buildable but not yet at a clean maintenance baseline; chunk-splitting + the remaining 34 warnings are open. |
| P2 | Publish export (DOCX/XLSX) | RESOLVED 2026-06-21 (ADR-0021): DOCX was already live in `ExportPanel`; XLSX implemented (`XlsxExporter` → `PublicationService` → `ExportPanel`). The "coming soon" badges lived only in orphaned `ExportControls` dead code. | Reachable export UI no longer contradicts backend capability. |
| P2 | Environment-bound E2E | Several tests skip when CDM data, Redis, Darkstar, Python AI, anonymizer, SciSpaCy, Llettuce, FinnGen, PACS, or seeded workflow data are unavailable. | Completion cannot be assessed from local unit results alone; hosted smoke data and readiness gates need ownership. |
| P3 | PHP 8.5 readiness | Backend test output includes repeated deprecations around `PDO::MYSQL_ATTR_SSL_CA` and doc-comment PHPUnit metadata. | Future runtime upgrades will turn today's warnings into maintenance pressure. |

## Completion Definition

Parthenon is "complete enough" for this backlog when all of these are true:

- Every P0/P1 item below has shipped code, tests, and lineage closeout evidence.
- Every visible "coming soon" or TODO-backed primary workflow is implemented,
  hidden behind a deliberate feature flag, or removed from the main navigation.
- `docs/lineage/plans/open/README.md` matches the actual open plan directory,
  and shipped/superseded plans have moved to `plans/closed/`.
- Backend, frontend, and template validation gates have bounded pass/fail output
  that another agent can reproduce without waiting on unknown external state.
- Hosted smoke gates cover the modules that local tests commonly skip:
  Darkstar/R sidecars, Python AI, anonymizer, SciSpaCy/Llettuce, Redis,
  FinnGen, PACS, and representative CDM data.
- Frontend deploys, when needed, use `./deploy.sh --frontend`, not
  `npm run build` as a release mechanism.

## Phase 0 - Stabilize The Backlog And Evidence

- [ ] Assign an owner and target release for each priority group in this plan.
- [ ] Convert this plan into issue/PR slices that do not mix unrelated modules.
- [ ] Re-run and archive current gate output with timestamps:
  - `cd backend && ./vendor/bin/pint --test`
  - `cd backend && ./vendor/bin/phpstan analyse --no-progress`
  - `cd backend && php artisan test --stop-on-failure`
  - `cd frontend && npm run lint`
  - `cd frontend && npm run build`
  - `cd templates && uv run pytest -q`
- [x] Split the Laravel test command into bounded suites if the full command
  remains too long or too quiet for routine verification.
- [x] Capture a skip inventory by module and classify each skip as:
  environment-required, intentionally optional, stale backlog, or bug-masking.
  Shipped: `docs/lineage/operations/2026-06-21-test-skip-inventory.md` (1 bug-masking
  skip flagged; the rest env-required or tooling-limited).
- [ ] Add a short "current known blockers" section to each active module plan
  that still drives work.
- [ ] Record the runtime readiness matrix for local Docker, hosted staging, and
  production-adjacent smoke checks.

Acceptance evidence:

- [ ] A closeout or updated plan links exact command output for every gate.
- [x] A skip-inventory artifact lists each skipped test cluster and the owner
  responsible for removing or preserving it.
  (`docs/lineage/operations/2026-06-21-test-skip-inventory.md`)
- [ ] Another agent can start with `docs/lineage/plans/open/README.md` and find
  the same open backlog without source-code spelunking.

## Phase 1 - Fix Red Verification Gates

- [x] Fix `templates/tests/performance/test_fhir_to_omop_throughput.py::test_1m_observations_under_10_minutes`.
  - [x] Make `load_to_cdm` tolerate absent optional resource outputs, including
    empty condition, procedure, diagnostic-report, medication, immunization,
    consent, and encounter artifacts.
  - [x] Ensure every mapper writes an empty artifact that distinguishes "empty
    but successful" from "node did not run".
  - [x] Add a targeted regression for an observation-only FHIR bundle.
  - [x] Re-run the one-million-observation test through the full template gate;
    it passed under the existing 600-second assertion.
- [x] Finish the Achilles results-schema routing investigation.
  - [x] Re-run `backend/tests/Feature/Achilles/ResultsSchemaRoutingTest.php`
    alone against the current database.
  - [x] Verify every source with a results daimon resolves a results schema that
    differs from the CDM schema.
  - [x] Verify the results schema exists in PostgreSQL and accepts
    `SET search_path`.
  - [x] Add deterministic SourceContext coverage and live-catalog skip
    diagnostics instead of relying on leaked PHPUnit `DB_*` settings.
- [x] Make backend test output operator-friendly.
  - [x] Add documented commands for fast unit, feature, integration, and
    environment-bound suites.
  - [x] Keep `--stop-on-failure` useful by avoiding silent long-running
    integration work in the default path.
  - [x] Move the live OMOP FK audit behind explicit `live-omop` and
    `environment-bound` grouping with `PARTHENON_LIVE_OMOP_FK_AUDIT=1`.
  - [x] Add a JUnit-aware Pest lane runner so known framework deprecation/skips
    do not hide the failure/error signal for the bounded Composer lanes.
  - [x] Decide whether `php artisan test --stop-on-failure` should become an
    alias for bounded lanes or remain an unsupported legacy local command.
    DECIDED 2026-06-21: added a `composer test` alias that chains the bounded
    lanes (unit → integration → feature:api → feature:finngen → feature:modules);
    the monolithic `php artisan test` remains an unsupported legacy command.

Acceptance evidence:

- [x] `cd templates && uv run pytest -q` passes or only skips documented
  environment-bound checks.
- [x] `cd backend && composer test:unit` produces a bounded pass/fail result.
- [x] `cd backend && composer test:integration` produces a bounded pass/fail
  result.
- [x] `cd backend && composer test:feature:api` produces a bounded pass/fail
  result.
- [x] `cd backend && composer test:feature:finngen` produces a bounded pass/fail
  result.
- [x] `cd backend && composer test:feature:modules` produces a bounded pass/fail
  result.
- [x] `cd backend && php artisan test --stop-on-failure` produces a bounded
  pass/fail result or is deliberately replaced by the Composer lanes.
  Deliberately replaced by `composer test` (the bounded Composer-lane alias).
- [x] Achilles routing tests pass in isolation.

## Phase 2 - Repair Lineage And Plan Governance

- [x] Move the local-model agent backend plan to
  `docs/lineage/plans/closed/2026-06-15-local-model-agent-backend-ce.md`
  because its frontmatter says
  `status: shipped` and the module lineage record names the shipped work.
- [x] Move the protocol-to-publication implementation plan to
  `docs/lineage/plans/open/protocol-to-publication-implementation-plan.md`
  because it remains `status: active`.
- [x] Reconcile `docs/lineage/plans/open/README.md` with the actual contents of
  `plans/open/`.
- [ ] Verify every open plan names a closure trigger, related code/ADR/release
  evidence, and any blocking dependency.
- [ ] For stale plans, either create a closeout in `plans/closed/` or set
  `status: superseded` and fill `superseded_by`.

Acceptance evidence:

- [x] `python3 scripts/docs/catalog_lineage_docs.py --write-catalog`
- [x] `python3 scripts/docs/catalog_lineage_docs.py --check-frontmatter`
- [x] `sh docs/site/scripts/check-content-tree.sh`
- [x] `sh docs/site/scripts/check-public-docs-current.sh`
- [ ] `docs/lineage/catalog.md` and the open-plan README agree with the file
  tree and frontmatter state.

## Phase 3 - Complete Analytics, HADES, And Protocol-To-Publication

- [x] Decide whether `r_not_implemented` remains a supported compatibility
  status or should be removed from the product path.
- [ ] For estimation, prediction, SCCS, and evidence synthesis:
  - [x] Verify the Darkstar/R sidecar endpoints run with the expected HADES
    packages in local Docker and hosted staging.
  - [ ] Replace generic "not implemented" UI messaging with actionable
    environment or package diagnostics.
  - [x] Add contract tests for successful, failed, unavailable, and invalid
    sidecar responses.
  - [x] Record package versions and sidecar readiness in a module closeout.
- [x] Unblock the protocol-to-publication phases:
  - [x] Phase 0: un-skip the regression harness that proves existing
    publication routes still work.
  - [x] Phase 1: ship the provenance spine across analysis outputs and draft
    artifacts.
  - [x] Phase 2: ship empirical calibration service and persisted calibration
    reports.
  - [x] Phase 3: ship gate ledger, blocking gates, and estimate blinding.
  - [x] Phase 4: ship missing-cohort diagnostics with user-visible explanations.
  - [x] Phase 5: ship Abby orchestration through Python AI with recoverable job
    state.
  - [x] Phase 6: ship manuscript synthesis with provenance-linked sections.
- [x] Close the phenotype validation backlog.
  - [x] Resolve `PhenotypeValidationController` spec drift.
  - [x] Unskip the eight skipped `PhenotypeValidationTest.php` cases.
  - [ ] Add frontend/API contract coverage for the resolved behavior.

Acceptance evidence:

- [x] Analytics service tests pass without `r_not_implemented` for configured
  environments.
- [x] Protocol-to-publication has shipped closeout evidence for each phase or a
  superseding plan that explicitly narrows scope.
- [x] Phenotype validation tests are unskipped and pass.

## Phase 4 - Complete Ingestion, Source, And Data-Operations Workflows

- [ ] Build the FHIR export backend behind `FhirExportPage.tsx`.
  - [ ] Define export request shape, supported resource filters, async job
    behavior, authorization, audit logging, and download retention.
  - [ ] Add backend feature tests for export creation, polling, cancellation,
    download, and authorization failures.
  - [ ] Replace the coming-soon admin surface with a functional workflow or hide
    it behind an explicit feature flag until shipped.
- [x] Implement GIS Excel import.
  - [x] Parse `.xlsx` and `.xls` previews with the same validation guarantees
    as CSV/TSV.
  - [x] Stream large sheets in row chunks without loading all rows into memory.
  - [x] Add tests for sheet selection, headers, XLS/XLSX preview upload, and
    empty rows.
- [ ] Complete Source Profiler comparison.
  - [ ] Add comparison API for two sources/projects.
  - [ ] Include schema, row-count, null-rate, vocabulary, and distribution
    deltas.
  - [ ] Replace the comparison placeholder with real loading, empty, error, and
    success states.
- [x] Decide and document the source connector matrix.
  - [x] For BigQuery, Redshift, Snowflake, Databricks, and Cloud Spanner, choose
    ship, enterprise-only, feature-flag, or remove-from-UI.
  - [ ] For each shipped connector, add connection validation, credential
    storage, schema discovery, and smoke tests.
- [ ] Finish the existing ingestion template Phase 4 plans:
  - [ ] BGE-base per-vocabulary LoRA.
  - [ ] Reviewer UI timed test.
  - [ ] Auto-approval calibration.
  - [ ] Cross-encoder rerank ship/hold decision.
  - [ ] Llettuce reevaluation.
  - [ ] FHIR Bulk Data reader.
  - [ ] Federated mapping spike.
  - [ ] Quarterly upstream-diff workflows.
- [ ] Close environment-bound ingestion test skips.
  - [ ] Make MIMIC-IV/testcontainers vocabulary seeding reproducible.
  - [ ] Provide anonymizer and SciSpaCy sidecar readiness checks.
  - [ ] Generate ARTEMIS v0.2.0 pattern artifacts in the documented workflow.

Acceptance evidence:

- [x] GIS Excel import no longer displays a placeholder for committed
  spreadsheet preview/import scope.
- [ ] No primary ingestion/source page displays a placeholder for committed
  product scope.
- [ ] Template E2E and performance tests pass with documented fixtures and
  sidecars.
- [ ] The connector matrix is reflected in UI, docs, and tests.

## Phase 5 - Complete Abby, AI, And Publication Workflows

- [x] Replace the hard-coded `source_id: 1` in Abby data queries with selected
  source context.
- [x] Implement source-card navigation from Abby responses to the cited document
  or source artifact.
- [ ] Add backend and frontend tests for source selection, answer provenance,
  source-click navigation, and missing-source recovery.
  - [x] Frontend tests cover selected-source submission and the no-source guard.
  - [x] Frontend tests cover source-card internal navigation and external URL
    opening.
- [ ] Audit all AI/Abby features for implicit assumptions about default source,
  active project, active cohort, and current user permissions.
- [x] Reconcile publish export surfaces.
  - [x] Confirm whether DOCX/XLSX coming-soon badges in legacy controls are
    still shown in reachable UI.
  - [ ] If export backends now exist elsewhere, remove stale controls or route
    them to the shipped export path.
  - [x] If not shipped, implement or hide the formats behind a deliberate scope
    decision.
- [ ] Validate local-model CE behavior from the shipped plan and create a
  follow-up only for remaining work, not for already-deployed scope.

Acceptance evidence:

- [x] The Abby `/data` channel binds to the selected source and source cards
  navigate to cited evidence for known local artifact types and URLs.
- [x] Publication/export controls no longer contradict backend capability.
- [ ] AI workflows have authorization and provenance tests.

## Phase 6 - Complete Clinical Workbench Gaps

- [x] Implement matched-cohort export in patient similarity.
  - [x] Define export formats, destination, cohort-definition provenance, and
    authorization rules.
  - [x] Wire `onExportMatched` to the export dialog flow.
  - [x] Add tests for empty match sets, payload shape, and permission failures.
- [ ] Stabilize FinnGen and genomics E2E readiness.
  - [ ] Decide which Redis-backed idempotency tests must run in CI.
  - [ ] Provide seeded data/readiness checks for code explorer and gallery
    smoke tests.
  - [ ] Turn environment skips into explicit prerequisites or passing fixtures.
- [ ] Preserve PACS/Orthanc runtime verification.
  - [ ] Keep raw Orthanc REST/DICOMweb health separate from Laravel PACS auth
    checks.
  - [ ] Maintain a hosted smoke that proves current credentials, stats refresh,
    and study-browser access.
- [ ] Reassess CDM-data-dependent API skips.
  - [ ] Provide a minimal CDM fixture for `CdmModelTest.php`.
  - [ ] Record which larger CDM checks belong only in hosted smoke tests.

Acceptance evidence:

- [x] Patient similarity users can export matched cohorts.
- [ ] Genomics, PACS, and CDM tests have clear local-vs-hosted ownership.
- [ ] No clinical-workbench page depends on hidden seeded state without a
  readiness message.

## Phase 7 - Frontend Quality And Performance Burn-Down

- [ ] Reduce or justify large production chunks from the Vite build.
  - [ ] Split map/GIS, Commons, DimensionToggle, lucide icon usage, and other
    large feature surfaces where route-level loading is practical.
  - [ ] Keep generated chunk names stable enough for regression tracking.
  - [ ] Add bundle-size reporting to the normal frontend gate.
- [ ] Burn down the 42 lint warnings.
  - [ ] Fix React hook purity, immutability, set-state-in-effect, and static
    component warnings.
  - [ ] Remove or justify Fast Refresh boundary violations.
  - [ ] Remove unused variables and dead code in tested files.
- [ ] Revisit skipped frontend tests in code explorer and graph components.
- [ ] Verify important responsive layouts with screenshots for the feature
  areas touched during completion.

Acceptance evidence:

- [ ] `cd frontend && npm run lint` passes with zero warnings or documented
  accepted exceptions.
- [ ] `cd frontend && npm run build` passes with documented bundle thresholds.
- [ ] Frontend deployment remains through `./deploy.sh --frontend` when shipping
  assets to an environment.

## Phase 8 - Release, Operations, And Runtime Readiness

- [ ] Complete signed release packaging.
  - [ ] Produce verified signed macOS, Windows, and Linux release assets.
  - [ ] Record signature verification, notarization/trusted signing, and release
    note evidence.
- [ ] Build service readiness checks for all sidecars that routinely cause
  skipped tests:
  - [x] Darkstar/R analysis.
  - [x] Python AI.
  - [ ] Anonymizer.
  - [ ] SciSpaCy.
  - [ ] Llettuce.
  - [x] Redis queues/idempotency.
  - [x] PACS/Orthanc.
- [ ] Define environment promotion gates for local, staging, and production:
  - [ ] backend health
  - [ ] frontend asset deployment
  - [ ] queue workers
  - [ ] database migrations
  - [ ] representative CDM data
  - [ ] AI/analysis sidecars
  - [ ] PACS/DICOMweb
  - [ ] ingestion template smoke
- [ ] Publish an operator runbook for interpreting skipped tests and hosted-only
  checks.

Acceptance evidence:

- [ ] Release artifacts are signed and independently verifiable.
- [ ] Runtime smoke gates prove the configured environment, not only local
  source behavior.
- [ ] Operators have a single runbook for service readiness and test skips.

## Phase 9 - Decide Optional Enterprise Scope

- [x] Decide whether Airflow, Dagster, and Temporal adapters are product
  commitments.
  - [ ] If yes, implement at least one complete non-Prefect adapter with submit,
    status, cancel, logs/artifacts, retry semantics, and integration tests.
  - [x] If no, remove the stubs from product-facing scope or mark them as
    developer extension examples.
- [x] Decide whether cloud warehouse connectors are core, enterprise, or future
  scope.
- [ ] Decide whether federated mapping depends on a concrete Hive Networks
  readiness date or should move to a hold-final decision.
- [x] Convert every deferred optional scope into either a closed decision record
  or a named open plan with a closure trigger.

Acceptance evidence:

- [ ] Optional surfaces no longer look like unfinished core product promises.
- [ ] Open plans represent committed work, not indefinite placeholders.

## Closeout Checklist

- [ ] All P0/P1 tasks are shipped, hidden by deliberate scope decisions, or
  superseded by narrower plans.
- [ ] All validation gates in this document have reproducible current output.
- [ ] `docs/lineage/plans/open/README.md` lists this plan only while the above
  work remains active.
- [ ] When this plan closes, move it to `docs/lineage/plans/closed/`, set
  `status: shipped` or `status: superseded`, and link the closeout evidence.
- [ ] Regenerate `docs/lineage/catalog.md` and run the docs checks after the
  closeout move.
