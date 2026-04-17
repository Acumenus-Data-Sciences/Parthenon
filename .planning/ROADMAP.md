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

### Phase 14: regenie GWAS Infrastructure
**Goal**: A containerized regenie runtime is callable by Darkstar with summary statistics landing in an indexed per-source schema
**Depends on**: Nothing (infrastructure-only; does not require Phase 13)
**Requirements**: GENOMICS-01, GENOMICS-02
**Success Criteria** (what must be TRUE):
  1. `docker/regenie/` ships a Dockerfile with a pinned regenie version, runs as a non-root user per HIGHSEC section 4.1, and is invocable from Darkstar via the `finngen.gwas.regenie` analysis type with step-1 and step-2 orchestration
  2. Intermediate LOCO prediction artifacts from step-1 persist on the `finngen-artifacts` Docker volume and are reused when a subsequent step-2 runs against the same cohort within the cache window
  3. Each CDM source has a `{source}_gwas_results.summary_stats` schema owned by `parthenon_migrator` with explicit GRANT blocks to `parthenon_app`, containing the full column set (`chrom, pos, ref, alt, snp_id, af, beta, se, p_value, case_n, control_n, cohort_definition_id, gwas_run_id`)
  4. The summary_stats table has a `(chrom, pos)` index for Manhattan-plot range scans and a `(cohort_definition_id, p_value)` index for top-hit lookups, both verifiable via `\d+` in psql
**Plans**: TBD

### Phase 15: GWAS Dispatch, Run Tracking, and Generation History
**Goal**: A researcher can trigger a GWAS against any endpoint x source tuple and see every historical run (GWAS and endpoint-generation) surfaced in the browser
**Depends on**: Phase 14
**Requirements**: GENOMICS-03, GENOMICS-05, GENOMICS-14
**Success Criteria** (what must be TRUE):
  1. `POST /api/v1/finngen/endpoints/{name}/gwas` with `{source_key, control_cohort_id, covariate_set_id?, overwrite?}` returns 202 + a Run record when the endpoint has resolvable concepts AND the source has a registered VCF index, and returns 422 when either precondition fails
  2. `app.finngen_endpoint_gwas_runs` tracking table records each dispatch with `(endpoint_name, source_key, control_cohort_id, covariate_set_id, run_id, case_n, control_n, top_hit_p_value, status, created_at)` and the endpoint detail drawer lists all completed runs for that endpoint via a new "GWAS runs" section
  3. The endpoint browser detail drawer's "Generation history" section shows every historical endpoint-generation run per (endpoint x source) pair -- not just the latest -- with timestamp, subject_count, and status, sourced from either a new `finngen_endpoint_generation_runs` table or a filtered query against the existing `finngen_runs` table
  4. A researcher submits a GWAS run from the endpoint browser and sees `status=succeeded` with summary_stats row count > 0 in `{source}_gwas_results.summary_stats` within 30 minutes of dispatch
**Plans**: TBD
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
| 14. regenie GWAS Infrastructure | 0/0 | Not started | - |
| 15. GWAS Dispatch, Run Tracking, and Generation History | 0/0 | Not started | - |
| 16. PheWeb-lite Results UI and Workbench Attribution | 0/0 | Not started | - |
| 17. PGS Catalog Ingestion, PRS Scoring, and Distribution Viz | 0/0 | Not started | - |
| 18. Risteys-style Endpoint Dashboard | 0/0 | Not started | - |
