---
doc_type: plan
status: open
date: 2026-06-19
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
  - backend/app/Http/Controllers/Api/V1/PhenotypeValidationController.php
  - backend/tests/Feature/Api/V1/PhenotypeValidationTest.php
  - backend/phpstan.neon
  - backend/phpstan-baseline.neon
  - frontend/src/features/administration/pages/FhirExportPage.tsx
  - frontend/src/features/etl/pages/SourceProfilerPage.tsx
  - frontend/src/features/self-controlled-cohort/pages/SelfControlledCohortDetailPage.tsx
  - frontend/src/features/studies/components/workbench/studyDesignWorkbenchHelpers.ts
  - frontend/src/app/router.tsx
  - ai/app/main.py
  - darkstar/plumber_api.R
  - templates/runtime/orchestration/airflow_backend.py
  - templates/runtime/orchestration/dagster_backend.py
  - templates/runtime/orchestration/temporal_backend.py
related_prs: []
---

# Parthenon Production-Readiness Roadmap

This plan consolidates the remaining work required to take Parthenon from its
current state (late beta / pre-1.0-GA, deployed at parthenon.acumenus.net,
authoritative version `v1.0.8` + unreleased commits on `main`) to a credible
production-ready release.

It is a coordination layer over, not a replacement for, two existing open
plans:

- `2026-06-18-application-completion-plan.md` — the deep completion audit whose
  findings drive most of the workstreams below. Items already shipped in that
  plan's implementation passes are marked `[done]` here.
- `protocol-to-publication-implementation-plan.md` — ADR 0020's gated
  S1→S7 pipeline, the single largest remaining feature block (workstream A3).

It also folds in completeness-assessment findings not tracked in those plans:
PHPStan ignore-list breadth diluting the level-8 claim, the absence of an
enforced coverage floor, uneven frontend test depth, an orphaned
`self-controlled-cohort` module with a dangling route, AI-service CORS scope,
best-effort AI router health visibility, and an explicit security/scale/DR gate
appropriate to a PHI-handling clinical platform.

## Structure

Work is grouped into three release gates:

- **Gate A — GA blockers.** Nothing ships to a production-ready release without
  these.
- **Gate B — Trust and quality hardening.** Close before declaring a credible
  1.1/GA.
- **Gate C — Scope decisions.** Decide and document; may defer past GA as long
  as the decision is recorded, not left as an unfinished core promise.

## Completion Definition

Parthenon is production-ready for this roadmap when all of these are true:

- Every Gate A item has shipped code, tests, and lineage closeout evidence, is
  hidden behind a deliberate feature flag, or is superseded by a narrower plan.
- No visible "coming soon" / TODO-backed primary workflow remains in main
  navigation.
- A single documented validation command set yields bounded, reproducible
  pass/fail output with no unexplained skips.
- HADES/Darkstar analytics execute end-to-end against a CDM source in hosted
  staging without `r_not_implemented`.
- The HIGHSEC deployment checklist is green in staging and a security review of
  PHI/auth/RBAC surfaces has remediated criticals and highs.
- Backup/restore is drill-verified and an operator runbook exists.

---

## Gate A — GA Blockers

### A1. Verification as a single trustworthy gate

- [ ] Decide the fate of monolithic `php artisan test` — alias it to the
  bounded Composer lanes or formally retire it as legacy.
- [ ] Wire the bounded lanes (`test:unit`, `test:integration`,
  `test:feature:api|finngen|modules`, `live-omop`) into CI as the canonical
  gate.
- [ ] Capture a skip inventory by module, classifying each skip as
  `environment-required`, `intentionally-optional`, `stale-backlog`, or
  `bug-masking`; remove the bug-masking skips.
- [ ] Restore real PHPStan level 8: burn down the broad globally-ignored error
  identifiers in `backend/phpstan.neon` (argument.type, return.type,
  variable.undefined, dead-code family); move legitimately-deferred entries into
  the dated baseline instead of blanket ignores.
- [ ] Add an enforced coverage floor (CI currently runs `coverage: none` with no
  `phpunit.xml` minScore); set a realistic floor now with a path to 80%.

Acceptance:

- [ ] One documented command set returns bounded pass/fail with no unexplained
  skips.
- [ ] PHPStan passes level 8 with a shrinking, dated baseline.
- [ ] A coverage gate fails CI below the floor.

### A2. HADES / Darkstar analytics proven end-to-end

- [ ] Decide whether `r_not_implemented` remains a supported compatibility
  status or is removed from the product path.
- [ ] Verify Darkstar endpoints run with the expected pinned HADES packages in
  local Docker AND hosted staging (beyond build-time `stop()` guards).
- [ ] Replace generic "not implemented" UI messaging with actionable
  environment/package diagnostics.
- [ ] Add contract tests for success / failed / unavailable / invalid sidecar
  responses for estimation, prediction, SCCS, and evidence synthesis.
- [ ] Record package versions and sidecar readiness in a module closeout.

Acceptance:

- [ ] Estimation, prediction, SCCS, and evidence synthesis each execute a real
  analysis against a CDM source in staging and return calibrated results, with
  no `r_not_implemented` in a configured environment.

### A3. Protocol-to-Publication pipeline (ADR 0020) — ship or de-scope

Tracked in detail in `protocol-to-publication-implementation-plan.md`. Ship the
six phases or narrow the GA claim with a superseding plan and a flag-gated UI.

- [ ] Phase 0 — un-skip the regression harness freezing study 114 behavior.
- [ ] Phase 1 — provenance spine (content-addressable hashes across analysis
  outputs and draft artifacts); gates downstream phases.
- [ ] Phase 2 — empirical calibration service and persisted calibration reports
  (wire installed HADES `EmpiricalCalibration`).
- [ ] Phase 3 — gate ledger, blocking gates, estimate blinding (behind
  `studies.gating_enabled`).
- [ ] Phase 4 — missing-cohort diagnostics (attrition, index breakdown, orphans)
  with user-visible explanations.
- [ ] Phase 5 — Abby orchestrator on the Claude Agent SDK with recoverable job
  state.
- [ ] Phase 6 — manuscript synthesis (STROBE/RECORD docx with provenance
  appendix).

Acceptance:

- [ ] Rerunning study 114 as a golden regression, the orchestrator halts at S5
  on a separation failure and never surfaces an uncalibrated estimate; or a
  superseding plan narrows scope and the UI hides the surface behind a flag.

### A4. No "coming soon" in primary workflows

- [ ] FHIR export backend behind `FhirExportPage.tsx` — request shape, resource
  filters, async job, authorization, audit logging, retention; tests for
  create/poll/cancel/download/authz-failure; or hide behind an explicit flag.
- [ ] Source Profiler comparison API for two sources/projects (schema,
  row-count, null-rate, vocabulary, distribution deltas); replace placeholder
  with real loading/empty/error/success states.
- [ ] Reconcile publish export controls — remove or reroute stale DOCX/XLSX
  "coming soon" badges to the shipped export path.
- [x] [done] GIS Excel (.xlsx/.xls) import.
- [x] [done] Patient-similarity matched-cohort export.
- [x] [done] Abby `/data` source-context binding and source-card navigation.

Acceptance:

- [ ] No primary ingestion/source/admin/publish page shows a placeholder for
  committed scope; anything unfinished is flag-gated and out of main navigation.

### A5. Phenotype validation contract closed

- [ ] Resolve `PhenotypeValidationController` spec drift; un-skip the eight
  skipped `PhenotypeValidationTest.php` cases; add frontend/API contract
  coverage.

Acceptance:

- [ ] The eight tests pass and are no longer skipped.

### A6. Security and HIPAA hardening pass

- [ ] Run the `docs/.../HIGHSEC.spec.md` §8 deployment checklist end-to-end
  against staging (route middleware audit via `route:list`, no `$guarded=[]`,
  no unauthenticated clinical routes, `APP_DEBUG=false`, Sanctum 8h expiry,
  Redis/Orthanc/Grafana auth enabled).
- [ ] Tighten AI-service CORS — `ai/app/main.py` uses `allow_origins=["*"]`;
  scope to the Laravel origin.
- [ ] Add a health/readiness surface for the 19 best-effort AI routers so a
  missing dependency that disables a router is detectable rather than a silent
  warning.
- [ ] Pen test (third-party or internal adversarial) of auth, RBAC, PHI
  endpoints, DICOM/WADO, and shared-cohort links.
- [ ] Confirm audit logging covers PHI access paths and survives
  transaction-poisoning edge cases.

Acceptance:

- [ ] HIGHSEC checklist green in staging; pen-test criticals/highs remediated;
  no unauthenticated path to clinical data.

### A7. Immediate cleanup

- [ ] Run Pint on the uncommitted WIP (`FhirR4Controller.php` and other dirty
  PHP files) before committing — the local tree currently fails Pint.
- [ ] Resolve the orphaned `self-controlled-cohort` frontend module (unrouted,
  superseded by the routed `sccs` feature): delete it or wire it, and fix the
  dangling `/analyses/self-controlled-cohorts` link in
  `studyDesignWorkbenchHelpers.ts` that currently 404s.

---

## Gate B — Trust and Quality Hardening

### B1. Test depth where breadth is thin

- [ ] Add tests for substantial zero-test frontend features: `gis`,
  `investigation`, `morpheus`, `risk-scores`, `standard-pros`, plus `heor`,
  `imaging`, `genomics`, `library`.
- [ ] Close the hook-test gap (few dedicated hook tests vs many component tests)
  for the TanStack-Query-hook-centric data layer.
- [ ] Revisit skipped frontend tests in code-explorer and graph components.

### B2. Sidecar readiness gates

- [ ] Build readiness checks for every sidecar that routinely causes skips:
  Darkstar/R, Python AI, anonymizer, SciSpaCy, Llettuce, Redis, PACS/Orthanc.
- [ ] Hosted smoke gates covering modules local tests skip (Darkstar, AI,
  anonymizer, FinnGen, PACS, representative CDM data).
- [ ] Provide minimal CDM fixtures for `CdmModelTest.php`; record which CDM
  checks are hosted-smoke-only.
- [ ] Stabilize FinnGen/genomics E2E (decide which Redis idempotency tests run
  in CI; seed code-explorer/gallery smoke data).
- [ ] Keep raw Orthanc REST/DICOMweb health separate from Laravel PACS auth;
  maintain a hosted PACS smoke (credentials, stats refresh, study browser).

### B3. Frontend quality and performance burn-down

- [ ] Burn down the lint warnings (hook purity, immutability,
  set-state-in-effect, Fast Refresh boundaries, unused variables).
- [ ] Split large Vite chunks (map/GIS, Commons, DimensionToggle, lucide icons)
  to route-level loading; add bundle-size reporting to the frontend gate.
- [ ] Confirm all frontend deploys go through `./deploy.sh --frontend`, never
  `npm run build` as a release mechanism.

### B4. Performance and scale validation

- [ ] Load-test cohort generation and characterization against the largest CDM
  source; confirm no I/O-pathological query plans (reltuples + statement_timeout
  guards on large tables such as `omop.measurement` / `omop.observation`).
- [ ] Profile the API under concurrent researcher load; verify eager-loading /
  N+1 discipline on large OMOP joins.
- [ ] Establish DB connection-pool and queue-worker sizing for production
  concurrency.

### B5. Observability, operations, and DR

- [ ] Verify the Prometheus/Alertmanager/Loki/Alloy stack is wired to real
  alerts; define SLOs and on-call alerts for API, queues, and sidecars.
- [ ] Backup/DR drill — verify `db-backup.sh`/`db-restore.sh` round-trip on a
  staging copy; document RPO/RTO.
- [ ] Publish an operator runbook for interpreting skipped tests, sidecar
  readiness, and hosted-only checks.
- [ ] Define environment promotion gates (local → staging → prod): backend
  health, frontend assets, queue workers, migrations, CDM data, AI/analysis
  sidecars, PACS/DICOMweb, ingestion smoke.

### B6. Plan governance closeout

- [ ] Verify every open plan names a closure trigger, related code/ADR/release
  evidence, and any blocking dependency.
- [ ] For stale plans, create a closeout in `../closed/` or set
  `status: superseded` and fill `superseded_by`.
- [ ] Regenerate `../catalog.md`; confirm it and the open-plan README agree with
  the file tree and frontmatter.

---

## Gate C — Scope Decisions

### C1. Source connector matrix

- [ ] For BigQuery, Redshift, Snowflake, Databricks, Cloud Spanner, choose ship
  / enterprise-only / feature-flag / remove-from-UI.
- [ ] For each shipped connector, add connection validation, credential storage,
  schema discovery, and smoke tests.

### C2. Enterprise orchestration adapters

- [ ] Decide whether Airflow / Dagster / Temporal adapters (currently
  `NotImplementedError` stubs) are product commitments. If yes, ship at least
  one complete non-Prefect adapter (submit/status/cancel/logs/retry plus
  integration tests). If no, remove from product-facing scope or mark as
  developer extension examples.

### C3. Ingestion template Phase 4

- [ ] Close or explicitly defer the eight existing Phase 4 plans (BGE-base LoRA,
  reviewer-UI timed test, auto-approval calibration, cross-encoder rerank,
  Llettuce reevaluation, FHIR Bulk Data reader, federated mapping spike,
  upstream-diff workflows), each tracked in its own open plan.

### C4. Signed release packaging

- [ ] Produce verified signed macOS / Windows / Linux release assets with
  notarization / trusted signing and signature-verification evidence (tracked in
  `2026-04-23-signed-release-packaging.md`).

### C5. Runtime upgrade readiness

- [ ] Clear PHP 8.5 deprecation warnings (`PDO::MYSQL_ATTR_SSL_CA`, doc-comment
  PHPUnit metadata) before they become upgrade blockers.

### C6. Federated mapping decision

- [ ] Tie to a concrete Hive Networks readiness date or move to a hold-final
  decision record.

---

## Suggested Sequencing

1. Week 0 — A7 (cleanup), then A1 (verification gate). Trust the gate before
   trusting anything else.
2. Weeks 1–3 — A2 (HADES proof) plus A4/A5 (placeholders, phenotype) in
   parallel; these are the visible credibility gaps.
3. Weeks 2–4 — A3 (protocol-to-publication); the longest pole. Start P0/P1
   provenance early since it gates P2–P6.
4. Before GA sign-off — A6 (security) plus B2/B4/B5 (readiness, scale, DR): the
   "safe to run on real PHI at scale" gate.
5. Parallel / ongoing — B1, B3, B6.
6. GA+ — Gate C decisions, converted to closed decision records or named open
   plans.

Net remaining effort is dominated by A2 and A3 — execution-path proof and the
rigor layer — not by breadth of features, which is already present.

## Closeout Checklist

- [ ] All Gate A tasks are shipped, hidden by deliberate scope decisions, or
  superseded by narrower plans.
- [ ] All Gate B hardening items are closed or have a named owner and target.
- [ ] All Gate C items are explicit decisions, not unfinished placeholders.
- [ ] `docs/lineage/plans/open/README.md` lists this plan only while the work
  remains active.
- [ ] When this plan closes, move it to `docs/lineage/plans/closed/`, set
  `status: shipped` or `status: superseded`, fill `superseded_by`, and link the
  closeout evidence.
- [ ] Regenerate `docs/lineage/catalog.md` and run the docs checks after the
  closeout move.
