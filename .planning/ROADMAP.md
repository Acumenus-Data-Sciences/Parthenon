# Roadmap: FinnGen Genomics v1

## Overview

This roadmap layers the genomics half of FinnGen's research stack on top of
the already-validated FinnGen phenotyping foundation (PHENO-01..08, landed
2026-04-16, 5,161 endpoints live at `/workbench/finngen-endpoints`). It
delivers four capabilities, in dependency order: (1) Finnish OMOP vocabulary
load to lift the residual ~25% UNMAPPED bucket, (2) a regenie-based GWAS
pipeline with per-source summary-stat schemas and a PheWeb-lite browser UI,
(3) PGS Catalog ingestion + per-cohort polygenic risk scoring with
distribution visualization, and (4) a Risteys-style per-endpoint dashboard
(mortality, comorbidity, drug-use timeline) built on the existing Darkstar
R worker pattern. Phase numbering continues from IRSF-NHS (Phases 1-12
complete); this milestone begins at Phase 13.

## Phases

**Phase Numbering:**
- Integer phases (13-18): Planned milestone work
- Decimal phases (e.g., 14.1): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 13: FinnGen Endpoint Universalization (Standard-First Resolver)** - Upgrade FinnGenConceptResolver to prefer OHDSI standard concepts; ship a curated FinnGen-authored cross-walk (source_to_concept_map only, no custom vocab registration); add coverage_profile metadata per endpoint; re-process 5,161 live expressions in one shot at phase merge
- [x] **Phase 13.1: FinnGen Schema Isolation** [INSERTED] - Move FinnGen persistence out of `app.*` into a dedicated `finngen.*` schema; relocate 6 existing `app.finngen_*` tables and extract 5,161 endpoint rows from `app.cohort_definitions` into a new purpose-built `finngen.endpoint_definitions` table; wire dedicated `finngen`/`finngen_ro` Laravel connections to the already-provisioned `parthenon_finngen_rw`/`parthenon_finngen_ro` PG roles; drop FinnGen-specific `coverage_profile` column from `app.cohort_definitions`; single-transaction migration with functional `down()` rollback (completed 2026-04-17 with 1 R-worker gap → 13.2)
- [ ] **Phase 13.2: Finish FinnGen Cutover — R Worker Integration + Role Grants Codification + E2E Verification** [INSERTED] - Close the loop on 13.1: update the Darkstar R worker (`finngen_endpoint_generate_execute`) to use `finngen.endpoint_generations.id + 100_000_000_000` as the OMOP `{cohort_schema}.cohort.cohort_definition_id`; codify the 3 dev-applied role-split grants (GRANT CREATE on DB to parthenon_migrator, ALTER TABLE app.cohort_definitions OWNER TO parthenon_migrator, re-GRANT DML on app.cohort_definitions to parthenon_app); run full FinnGen Pest suite against `parthenon_testing` (proves SC 10 from 13.1); verify PANCREAS smoke-gen end-to-end (E4_DM2 → status=succeeded with subject_count > 0)
- [ ] **Phase 14: regenie GWAS Infrastructure** - Containerize regenie, wire Darkstar async dispatch, and ship the per-source `{source}_gwas_results` schema with indexed summary-stat tables
- [ ] **Phase 15: GWAS Dispatch, Run Tracking, and Generation History** - Endpoint x source GWAS dispatch API, run-history catalog per (endpoint x source x covariate-set), and multi-run generation history view
- [ ] **Phase 16: PheWeb-lite Results UI and Workbench Attribution** - Manhattan plot, regional/LocusZoom-lite views, top-variants drawer, plus the one-tweak workbench attribution badge for FinnGen-seeded sessions
- [ ] **Phase 17: PGS Catalog Ingestion, PRS Scoring, and Distribution Viz** - `parthenon:load-pgs-catalog` command, per-cohort PRS dispatch, and histogram + quintile visualization in the cohort detail drawer
- [ ] **Phase 18: Risteys-style Endpoint Dashboard** - Per-endpoint Kaplan-Meier survival, comorbidity matrix, and pre-index drug-use timeline via the `co2.endpoint_profile` module

## Phase Details

### Phase 13: FinnGen Endpoint Universalization (Standard-First Resolver)
**Goal**: FinnGen's 5,161 endpoint definitions resolve to OHDSI standard concepts on any OMOP CDM globally — without requiring Finnish-specific custom vocabularies. UNMAPPED bucket drops from 427 endpoints to <100 via standard-concept resolution + a curated FinnGen-authored cross-walk, not via custom vocab registration.
**Depends on**: Nothing (independent of GWAS/PRS/dashboard chains; builds directly on PHENO-01..08)
**Requirements**: GENOMICS-12a (GENOMICS-12b deferred to Phase 18.5: Finnish CDM Enablement)
**Success Criteria** (what must be TRUE):
  1. `FinnGenConceptResolver` resolves source codes via OHDSI standard-concept chains first (`concept_relationship` "Maps to" → standard concept) before falling back to source-vocab resolution; no new entries are added to `vocab.vocabulary` for ICD-8 / ICD9_FIN / NOMESCO / KELA_REIMB / ICD-10-FI (no concept_id ≥ 2B block allocation)
  2. A curated `vocab.source_to_concept_map` cross-walk ships covering ICD-8 → ICD10CM/SNOMED, NOMESCO → SNOMED Procedure, KELA_REIMB → RxNorm class, and high-value ICD-10-FI extensions → ICD10CM parents, sourced from FinnGen's own mapping references where available and filled in with OHDSI Phoebe/Athena; rows are owned by `parthenon_migrator` with explicit GRANT to `parthenon_app` per HIGHSEC §4.1
  3. Every endpoint in `app.cohort_definitions` tagged `finngen-endpoint` carries a `coverage_profile` classification (`universal` / `partial` / `finland_only`) derived from resolver output; the FinnGen Endpoint Browser renders a "Requires Finnish CDM" pill for `finland_only` endpoints and disables their "Generate" CTA on non-Finnish sources with a clear tooltip
  4. A baseline scan of all 5,161 endpoints under the upgraded resolver reports actual coverage before a target number is locked; after phase 13 ships, the UNMAPPED bucket count drops from 427 to <100 AND no endpoint is classified `coverage_bucket = UNMAPPED` while being simultaneously `coverage_profile = universal` (consistency invariant)
  5. The 5,161 live `cohort_definitions.expression` rows are re-processed in one shot at phase merge via `finngen:import-endpoints --release=df14 --overwrite` wrapped in a single transaction; a rollback snapshot table `app.finngen_endpoint_expressions_pre_phase13` preserves pre-migration state for at least one milestone
  6. At least one previously-UNMAPPED endpoint (e.g., an ICDO3-keyed cancer phenotype or an ICD-8-keyed cardiovascular phenotype) generates successfully against the PANCREAS source with `subject_count > 0` via `POST /api/v1/finngen/endpoints/{name}/generate`
**Plans**: 8 plans
- [ ] 13-01-PLAN.md — Wave 0: ADRs (STCM schema target, classification edges) + 9 failing TDD test skeletons
- [ ] 13-02-PLAN.md — Wave 1: schema migrations (coverage_profile column + rollback snapshot table)
- [ ] 13-03-PLAN.md — Wave 2: CoverageProfile enum + FinnGenCoverageProfileClassifier pure function
- [ ] 13-04-PLAN.md — Wave 2: 6 FinnGen cross-walk CSVs + idempotent seed migration (vocab.source_to_concept_map)
- [ ] 13-05-PLAN.md — Wave 2: FinnGenConceptResolver standard-first rewrite (STCM-first + 3 new vocab methods + invalid_reason guards)
- [ ] 13-06-PLAN.md — Wave 3: FinnGenEndpointImporter 7-vocab pipeline + ImportEndpointsCommand --overwrite + ScanCoverageProfileCommand
- [ ] 13-07-PLAN.md — Wave 4: EndpointBrowserController coverage_profile API + CoverageProfileBadge component + disabled Generate CTA (server-side 422 guard)
- [ ] 13-08-PLAN.md — Wave 5: live baseline scan + --overwrite execution + PANCREAS smoke-generation + VALIDATION.md signoff (CHECKPOINT)
**UI hint**: yes (endpoint browser coverage_profile pill + disabled Generate CTA tooltip)

### Phase 13.1: FinnGen Schema Isolation [INSERTED] [COMPLETED 2026-04-17]
**Status**: Complete with 1 deferred gap → Phase 13.2. Migration live on DEV (5,161 rows in `finngen.endpoint_definitions`, `app.cohort_definitions.coverage_profile` dropped, 7 tables under `finngen.*`, 11/11 post-flight verifications green). See `.planning/phases/13.1-finngen-schema-isolation/13.1-05-SUMMARY.md`.

### Phase 13.2: Finish FinnGen Cutover — R Worker + Role Grants + E2E Verification [INSERTED]
**Goal**: Close the 3 outstanding loose ends from 13.1 so the FinnGen schema-isolation work is fully operational end-to-end: (1) R worker writes to `{cohort_schema}.cohort` using a collision-free synthetic id derived from `finngen.endpoint_generations.id`, (2) 3 role-split grants applied manually to dev during 13.1 cutover are codified as a regular migration, (3) full FinnGen Pest suite green against `parthenon_testing` (proves SC 10), (4) PANCREAS smoke-gen end-to-end returns `status=succeeded` with `subject_count > 0` for endpoint `E4_DM2` (proves 13.1 invariant preservation).
**Depends on**: Phase 13.1 (R worker update requires the post-13.1 generation row structure; role grants fix gaps in 13.1's baseline)
**Requirements**: None new — closes gaps in 13.1 invariant preservation (Phase 13 GENOMICS-12a invariant: PANCREAS smoke-gen must succeed)
**Success Criteria** (what must be TRUE):
  1. The Darkstar R worker function `finngen_endpoint_generate_execute` at `/app/api/finngen/cohort_ops.R` accepts params with `cohort_definition_id = null` AND a new `finngen_endpoint_generation_id` (bigint) param; computes the OMOP write key as `cohort_def_id = finngen_endpoint_generation_id + 100000000000`; rejects only if BOTH `cohort_definition_id` and `finngen_endpoint_generation_id` are null/invalid (preserves legacy `app.cohort_definitions`-backed dispatch for non-FinnGen Darkstar callers)
  2. `EndpointBrowserController::generate()` passes the newly-created `FinnGenEndpointGeneration` row's `id` (from `$generation = FinnGenEndpointGeneration::updateOrCreate(...)->fresh()` or equivalent) into the run params as `finngen_endpoint_generation_id`; keeps passing `cohort_definition_id => null` for backward compat; the 100B offset is a single app-level constant (`FinnGenEndpointGeneration::OMOP_COHORT_ID_OFFSET` = 100_000_000_000) reused in tests and R
  3. A new regular migration (NOT a `--path=` hotfix) `2026_04_20_XXXXXX_codify_phase_13_1_role_split_baseline.php` applies the 3 role/grant changes idempotently: `ALTER TABLE app.cohort_definitions OWNER TO parthenon_migrator`; `GRANT SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER ON app.cohort_definitions TO parthenon_app`; `GRANT CREATE ON DATABASE parthenon TO parthenon_migrator` (with `current_database()` injection). All idempotent via existence guards. Runs cleanly on fresh parthenon_testing bootstrap.
  4. Full FinnGen Pest suite (`docker compose exec -T php vendor/bin/pest tests/Feature/FinnGen tests/Unit/FinnGen`) passes green on `parthenon_testing` DB — proves SC 10 from 13.1 (`finngen` schema materializes via RefreshDatabase + all migrations). Any pre-existing Mockery type errors in `ImportEndpointsCommandTest` are explicitly out of scope (documented in 13.1-04-SUMMARY) and either suppressed or fixed as a side-quest.
  5. PANCREAS smoke-gen end-to-end: `curl -X POST /api/v1/finngen/endpoints/E4_DM2/generate -d '{"source_key":"PANCREAS"}'` returns 202 + run_id; polling `GET /api/v1/finngen/runs/{id}` reports `status=succeeded` within 5 minutes; response's `summary.subject_count > 0`; evidence captured in a DEPLOY-LOG addendum
  6. `{PANCREAS_cohort_schema}.cohort` contains rows with `cohort_definition_id = {generation_id + 100_000_000_000}` after the smoke-gen — confirms the collision-free offset key was written through by the R worker
  7. No regression: the legacy `app.cohort_definitions`-keyed cohort materializations (standard user cohorts) still work — spot-check by generating a non-FinnGen cohort and confirming the cohort table is written with its app.cohort_definitions.id as before
**Canonical refs**:
  - `.planning/phases/13.1-finngen-schema-isolation/13.1-05-SUMMARY.md` §Follow-Up Work (enumerates these gaps)
  - `.planning/phases/13.1-finngen-schema-isolation/13.1-DEPLOY-LOG.md` (the 3 role-split deviations)
  - `.planning/phases/13.1-finngen-schema-isolation/13.1-CONTEXT.md` §D-07, §D-12 (model wiring + FK split strategy)
  - `/app/api/finngen/cohort_ops.R` inside `parthenon-darkstar` container (lines 387-540) — target of the R worker edit
  - `backend/app/Http/Controllers/Api/V1/FinnGen/EndpointBrowserController.php` `generate()` method (Phase 13.1 rewrite reference point)
**Plans**: 5 plans
- [ ] 13.2-01-PLAN.md — Wave 1: OMOP_COHORT_ID_OFFSET constant + run_id nullable migration + Mockery PHPStan fix
- [ ] 13.2-02-PLAN.md — Wave 1: codify 13.1 role-split deviations (D4/D5/D6) as idempotent migration
- [ ] 13.2-03-PLAN.md — Wave 2: R worker additive-param patch + controller reorder + new Pest test (SC-1/SC-2)
- [ ] 13.2-04-PLAN.md — Wave 3: full FinnGen Pest suite green on parthenon_testing (SC-4, proves SC-10 from 13.1)
- [ ] 13.2-05-PLAN.md — Wave 4: CHECKPOINT + DEV migration execution + PANCREAS smoke-gen E2E (SC-5/6/7)

### Phase 14: regenie GWAS Infrastructure
**Goal**: A containerized regenie runtime is callable by Darkstar with summary statistics landing in an indexed per-source schema
**Depends on**: Nothing (infrastructure-only; does not require Phase 13)
**Requirements**: GENOMICS-01, GENOMICS-02
**Success Criteria** (what must be TRUE):
  1. `docker/regenie/` ships a Dockerfile with a pinned regenie version, runs as a non-root user per HIGHSEC section 4.1, and is invocable from Darkstar via the `finngen.gwas.regenie` analysis type with step-1 and step-2 orchestration
  2. Intermediate LOCO prediction artifacts from step-1 persist on the `finngen-artifacts` Docker volume and are reused when a subsequent step-2 runs against the same cohort within the cache window
  3. Each CDM source has a `{source}_gwas_results.summary_stats` schema owned by `parthenon_migrator` with explicit GRANT blocks to `parthenon_app`, containing the full column set (`chrom, pos, ref, alt, snp_id, af, beta, se, p_value, case_n, control_n, cohort_definition_id, gwas_run_id`)
  4. The summary_stats table has a `(chrom, pos)` index for Manhattan-plot range scans and a `(cohort_definition_id, p_value)` index for top-hit lookups, both verifiable via `\d+` in psql
**Plans**: 7 plans
- [ ] 14-01-PLAN.md — Wave 0: failing Pest + testthat skeletons + docker/regenie Dockerfile + synthetic PANCREAS PGEN generator
- [ ] 14-02-PLAN.md — Wave 1: app.finngen_source_variant_indexes + app.finngen_gwas_covariate_sets migrations + default covariate-set seeder
- [x] 14-03-PLAN.md — Wave 2: GwasCacheKeyHasher + GwasSchemaProvisioner + Eloquent models + observer (un-skips 13 Wave 0 tests)
- [x] 14-04-PLAN.md — Wave 3: PrepareSourceVariantsCommand (VCF→PGEN + top-20 PCs + per-source schema)
- [x] 14-05-PLAN.md — Wave 4: Darkstar regenie/plink2 binary COPY + gwas_regenie.R worker + routes + analysis-module seeder + GwasRunService
- [x] 14-06-PLAN.md — Wave 5: GwasSmokeTestCommand + GwasCachePruneCommand + mocked-Darkstar Pest suites
- [ ] 14-07-PLAN.md — Wave 6: phase gate — real E2E smoke against PANCREAS cohort 221 + GATE-EVIDENCE sign-off (CHECKPOINT)

### Phase 15: GWAS Dispatch, Run Tracking, and Generation History
**Goal**: A researcher can trigger a GWAS against any endpoint x source tuple and see every historical run (GWAS and endpoint-generation) surfaced in the browser
**Depends on**: Phase 14
**Requirements**: GENOMICS-03, GENOMICS-05, GENOMICS-14
**Success Criteria** (what must be TRUE):
  1. `POST /api/v1/finngen/endpoints/{name}/gwas` with `{source_key, control_cohort_id, covariate_set_id?, overwrite?}` returns 202 + a Run record when the endpoint has resolvable concepts AND the source has a registered VCF index, and returns 422 when either precondition fails
  2. `finngen.endpoint_gwas_runs` tracking table (note: lands in `finngen.*` per 13.1 schema isolation, NOT `app.*` as the literal ROADMAP initially read) records each dispatch with `(endpoint_name, source_key, control_cohort_id, covariate_set_id, run_id, case_n, control_n, top_hit_p_value, status, created_at)` and the endpoint detail drawer lists all completed runs for that endpoint via a new "GWAS runs" section
  3. The endpoint browser detail drawer's "Generation history" section shows every historical endpoint-generation run per (endpoint x source) pair -- not just the latest -- with timestamp, subject_count, and status, sourced from a filtered query on the existing `finngen.runs` table (per D-18)
  4. A researcher submits a GWAS run from the endpoint browser and sees `status=succeeded` with summary_stats row count > 0 in `{source}_gwas_results.summary_stats` within 30 minutes of dispatch
**Plans**: 9 plans
- [ ] 15-01-PLAN.md — Wave 0: finngen.endpoint_gwas_runs migration + EndpointGwasRun model + 8 typed exceptions (D-12/D-13/D-14/D-19 + HIGHSEC grants)
- [ ] 15-02-PLAN.md — Wave 1: GwasRunService::dispatchStep2AfterStep1 + dispatchFullGwas orchestrator (D-03/D-04/D-05/D-10/D-15 + Open Q5 ownership check)
- [ ] 15-03-PLAN.md — Wave 1: FinnGenGwasRunObserver + registration (D-16/D-17 + CLAUDE.md Gotcha #12 try-catch posture)
- [ ] 15-04-PLAN.md — Wave 2: DispatchEndpointGwasRequest + EndpointBrowserController::gwas()/eligibleControls() + show() extension + routes + OpenAPI regen (D-01/D-02/D-21/D-30)
- [ ] 15-05-PLAN.md — Wave 3: api.ts types + 3 TanStack Query hooks (useDispatchGwas/useEligibleControlCohorts/useCovariateSets)
- [ ] 15-06-PLAN.md — Wave 3: RunStatusBadge superseded + font-semibold promotion + GenerationHistorySection + GwasRunsSection + RunGwasPanel (D-22/D-23/D-24/D-25 + UI-SPEC 2-weight typography)
- [ ] 15-07-PLAN.md — Wave 4: FinnGenEndpointBrowserPage drawer wiring + Phase 16 stub route
- [ ] 15-08-PLAN.md — Wave 5: 6 Pest feature + 1 Pest unit + 5 Vitest tests (D-26/D-27/D-28)
- [ ] 15-09-PLAN.md — Wave 6: GwasSmokeTestCommand --via-http extension + real E2E on PANCREAS cohort 221 + GATE-EVIDENCE sign-off (CHECKPOINT, D-29/SC-4)
**UI hint**: yes

### Phase 16: PheWeb-lite Results UI and Workbench Attribution
**Goal**: A completed GWAS run renders as a native Manhattan/LocusZoom-lite browser, and FinnGen-seeded workbench sessions visibly declare their endpoint lineage
**Depends on**: Phase 15
**Requirements**: GENOMICS-04, GENOMICS-13
**Success Criteria** (what must be TRUE):
  1. `/workbench/finngen-endpoints/{name}/gwas/{run_id}` renders a full-chromosome Manhattan plot (chrom x -log10(p)) in under 3 seconds for a typical ~10M-SNP summary-stat run, built in React with d3/recharts (no Python service)
  2. The Manhattan plot supports click-through to a regional view (zoomed +/- 500 kb window) and a LocusZoom-lite panel showing LD-colored variants plus a gene track, sourced from the indexed summary_stats table
  3. A sortable top-50 variants table is visible on the same page with a per-row drawer showing chrom/pos/ref/alt/af/beta/se/p-value and the originating `gwas_run_id`
  4. Any workbench session whose `session_state.seeded_from.kind === "finngen-endpoint"` displays a "From FinnGen {endpoint_name}" pill at the top of the operation tree, linking back to the endpoint browser detail drawer
**Plans**: TBD
**UI hint**: yes

### Phase 17: PGS Catalog Ingestion, PRS Scoring, and Distribution Viz
**Goal**: A researcher can load any PGS Catalog score, compute per-subject PRS for a cohort x source, and read off the distribution in the cohort detail drawer
**Depends on**: Phase 14 (variant-index plumbing from the GWAS infrastructure)
**Requirements**: GENOMICS-06, GENOMICS-07, GENOMICS-08
**Success Criteria** (what must be TRUE):
  1. `php artisan parthenon:load-pgs-catalog --score-id=PGS000001` ingests the score metadata + weight file into `vocab.pgs_scores` and `vocab.pgs_score_variants`, is idempotent on re-run, and ships with explicit `parthenon_app` GRANT blocks per HIGHSEC
  2. `POST /api/v1/finngen/endpoints/{name}/prs` with `{source_key, score_id}` dispatches a Darkstar PRS run that writes per-subject scores to `{source}_gwas_results.prs_subject_scores` keyed by `(score_id, cohort_definition_id, subject_id)`, completing without error for at least one real (endpoint x source x PGS Catalog score) smoke test
  3. The cohort detail drawer renders a PRS histogram with overlaid quintile bands, summary stats (mean, median, IQR), and a "Download CSV" button that returns the per-subject score table
  4. The same drawer handles the empty-state gracefully (no PRS yet computed) with a "Compute PRS" CTA and a score picker populated from `vocab.pgs_scores`
**Plans**: TBD
**UI hint**: yes

### Phase 18: Risteys-style Endpoint Dashboard
**Goal**: Every FinnGen endpoint has a browsable mortality / comorbidity / drug-use profile driven by Darkstar R workers against any source CDM
**Depends on**: Phase 13 (endpoint coverage) -- can run in parallel with 14-17 once Phase 13 ships
**Requirements**: GENOMICS-09, GENOMICS-10, GENOMICS-11
**Success Criteria** (what must be TRUE):
  1. A new Darkstar CO2 module `co2.endpoint_profile` reads from any source's `condition_occurrence`, `death`, and `observation_period` and returns Kaplan-Meier survival curves + median survival + age-at-death distribution for a given (endpoint x source) pair
  2. The endpoint detail drawer renders a Kaplan-Meier plot, a top-50 comorbidity matrix (co-occurring FinnGen endpoints sorted by lift / phi-coefficient, displayed as a click-through heatmap), and a stacked horizontal bar chart of top ATC classes prescribed in the 90-day pre-index window
  3. A researcher opens the endpoint detail drawer for E4_DM2 against PANCREAS and sees all three panels populated within 15 seconds, with values clinically plausible (e.g., T2DM comorbidity heatmap surfaces E4_HYPERTENSION / E4_OBESITY near the top)
  4. Each R worker follows the established `darkstar/api/finngen/` module pattern with qualifying-event UNION branches + concept_ancestor descendant expansion, consistent with `cohort.endpoint.generate`
**Plans**: TBD
**UI hint**: yes

## Progress

**Execution Order:**
Phase 13 is independent and can ship first (cheapest, lifts coverage for everything downstream).
Phases 14 -> 15 -> 16 form the GWAS chain (strict order).
Phase 17 depends on Phase 14 only (can run in parallel with 15-16 once the `{source}_gwas_results` schema exists).
Phase 18 depends on Phase 13 and can run in parallel with the entire 14-17 chain.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 13. FinnGen Endpoint Universalization (Standard-First Resolver) | 0/0 | Not started | - |
| 14. regenie GWAS Infrastructure | 4/7 | In Progress|  |
| 15. GWAS Dispatch, Run Tracking, and Generation History | 0/9 | Not started | - |
| 16. PheWeb-lite Results UI and Workbench Attribution | 0/0 | Not started | - |
| 17. PGS Catalog Ingestion, PRS Scoring, and Distribution Viz | 0/0 | Not started | - |
| 18. Risteys-style Endpoint Dashboard | 0/0 | Not started | - |
