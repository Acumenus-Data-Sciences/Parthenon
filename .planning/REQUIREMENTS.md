# Requirements

**Active milestone:** v1.0 FinnGen Genomics
**Last updated:** 2026-04-16

## Validated (FinnGen Phenotyping Foundation — landed 2026-04-16)

These requirements were delivered as a series of quick tasks across
2026-04-16 (commits `f4a9561c2` … `7504cffea`) and live in production at
https://parthenon.acumenus.net/workbench/finngen-endpoints. They are
recorded here so this milestone's roadmap can build on top of them.

- [x] **PHENO-01**: 5,161 FinnGen DF14 endpoint definitions imported as
  `app.cohort_definitions` rows tagged `finngen-endpoint` + `finngen:df14`
- [x] **PHENO-02**: ICD-10 resolver inserts decimals; expander handles
  digit ranges, alpha ranges, single-bracket digit/alpha classes,
  multi-digit classes, and rejects junk tokens
- [x] **PHENO-03**: ~80% of imported endpoints have meaningful coverage
  (FULLY_MAPPED 2,760 + PARTIAL 1,399 = 4,159 / 5,161)
- [x] **PHENO-04**: `app.finngen_unmapped_codes` sidecar table tracks
  9,093 unresolved (endpoint, code, vocab) tuples for future vocab work
- [x] **PHENO-05**: FinnGen Endpoint Browser at `/workbench/finngen-endpoints`
  with stat cards, search, tag/bucket filters, detail drawer
- [x] **PHENO-06**: Per-endpoint generation against any CDM via
  `POST /api/v1/finngen/endpoints/{name}/generate` → R worker
  `finngen_endpoint_generate_execute` → cohort table
- [x] **PHENO-07**: `app.finngen_endpoint_generations` tracking table with
  per-source badges + confidence indicator + generation history view
- [x] **PHENO-08**: One-click "Open in Workbench" pre-seeds a workbench
  session with the FinnGen cohort as the operation tree root, complete
  with `seeded_from` marker for future attribution

## v1.0 Requirements (this milestone)

### regenie GWAS pipeline

- [ ] **GENOMICS-01**: regenie container ships in `docker/regenie/` and
  is dispatched async via Darkstar as a new analysis type
  `finngen.gwas.regenie`. Step-1 + step-2 orchestration with
  intermediate artifacts (LOCO predictions) cached on the
  `finngen-artifacts` volume.
- [ ] **GENOMICS-02**: `{source}_gwas_results.summary_stats` schema per
  source. Columns: `chrom`, `pos`, `ref`, `alt`, `snp_id`, `af`, `beta`,
  `se`, `p_value`, `case_n`, `control_n`, `cohort_definition_id`,
  `gwas_run_id`. Indexed by `(chrom, pos)` and `(cohort_definition_id,
  p_value)` for top-hits and Manhattan-plot lookups.
- [ ] **GENOMICS-03**: `POST /api/v1/finngen/endpoints/{name}/gwas` with
  body `{source_key, control_cohort_id, covariate_set_id?, overwrite?}`.
  Validates the endpoint has resolvable concepts AND that the source has
  variant data (VCF index registered). Returns 202 + Run record.
- [ ] **GENOMICS-04**: PheWeb-lite results UI at
  `/workbench/finngen-endpoints/{name}/gwas/{run_id}` — Manhattan plot
  (chrom × -log10(p)), regional view (zoom into a hit window),
  LocusZoom-lite (LD-colored region with gene track), top-50 variants
  table with sortable columns, per-variant detail drawer.
- [ ] **GENOMICS-05**: GWAS run-history view per endpoint showing
  completed runs across (source × control_cohort_id × covariate_set)
  with subject counts, p-value of top hit, and direct links to the
  PheWeb-lite UI. Persist via `app.finngen_endpoint_gwas_runs` tracking
  table (mirrors the existing endpoint_generations pattern).

### PRS scoring

- [ ] **GENOMICS-06**: `php artisan parthenon:load-pgs-catalog
  --score-id=PGS000001` ingests PGS Catalog summary stat files into
  `vocab.pgs_scores` + `vocab.pgs_score_variants`. Idempotent on re-run.
- [ ] **GENOMICS-07**: `POST /api/v1/finngen/endpoints/{name}/prs` with
  `{source_key, score_id}` triggers a Darkstar PRS run that computes
  per-subject scores from the source's variant index. Writes to
  `{source}_gwas_results.prs_subject_scores` keyed by
  `(score_id, cohort_definition_id, subject_id)`.
- [ ] **GENOMICS-08**: Per-cohort PRS distribution viz in the cohort
  detail drawer — histogram with quintile bands, summary stats (mean,
  median, IQR), and downloadable CSV.

### Risteys-style endpoint dashboard

- [ ] **GENOMICS-09**: Per-endpoint Kaplan-Meier survival curves +
  median survival + age-at-death distribution. New CO2 module
  `co2.endpoint_profile` reading from any source's
  `condition_occurrence` + `death` + `observation_period`.
- [ ] **GENOMICS-10**: Per-endpoint comorbidity matrix — top-50
  co-occurring FinnGen endpoints by lift / phi-coefficient, displayed
  as a heatmap with click-through to the comorbid endpoint's profile.
- [ ] **GENOMICS-11**: Per-endpoint drug-use timeline — top-N ATC
  classes prescribed in the 90-day pre-index window across the cohort,
  displayed as a stacked horizontal bar chart.

### Endpoint universalization

- [ ] **GENOMICS-12a**: FinnGen endpoint universalization via
  standard-first resolver. Rewrite `FinnGenConceptResolver` to prefer
  OHDSI standard concepts (SNOMED / RxNorm / ICD10CM / ATC) via
  `concept_relationship` "Maps to", so endpoint expressions resolve on
  any OMOP CDM globally — not only FinnGen-native data. Ship a curated
  FinnGen-authored `source_to_concept_map` covering ICD-8 → ICD10CM/
  SNOMED, NOMESCO → SNOMED Procedure, KELA_REIMB → RxNorm class, plus
  any high-value ICD-10-FI extensions with ICD10CM parents. **Do not**
  register Finnish vocabularies as custom OMOP vocabularies (no
  concept_id ≥ 2B block allocation). Add `coverage_profile` metadata
  per endpoint (Universal / Partial / Finland-only); expose a
  "Requires Finnish CDM" pill for Finland-only endpoints in the
  browser. Baseline scan the 5,161 endpoints under the new resolver to
  empirically set the coverage target, then verify UNMAPPED bucket
  drops from 427 to <100 endpoints. Re-process the live
  `cohort_definitions.expression` rows in one shot at phase merge with
  a rollback snapshot table.

- [ ] **GENOMICS-12b** *(deferred to Phase 18.5: Finnish CDM
  Enablement)*: Custom Finnish OMOP vocabulary load. Only triggered
  when a Finnish-sourced CDM (e.g., THL HILMO, AvoHILMO, KanTa) is
  attached to Parthenon. Acquires THL-published ICD-8, Finnish ICD-9,
  ICD-10-FI, ICDO3-FI, NOMESCO, KELA_REIMB catalogs; registers them as
  custom OMOP vocabularies (concept_ids ≥ 2B). Not in v1.0.

### Polish + closing-the-loop

- [ ] **GENOMICS-13**: Workbench attribution badge — when a workbench
  session has `session_state.seeded_from.kind === "finngen-endpoint"`,
  render a "From FinnGen {endpoint_name}" pill at the top of the
  operation tree. Link back to the endpoint browser detail drawer.
- [ ] **GENOMICS-14**: Generation history view that surfaces multiple
  runs per (endpoint × source) pair, not just the latest. Adds a
  `finngen_endpoint_generation_runs` table OR queries `finngen_runs`
  filtered by `analysis_type = 'endpoint.generate'` and the
  cohort_definition_id.

## Future Requirements (deferred to v1.1+)

- Multi-ancestry GWAS meta-analysis (METAL, MR-MEGA)
- Functional annotation pipelines (VEP, ANNOVAR)
- Drug-target / pharmacogenomics (Open Targets integration)
- Federated multi-site analyses (Arachne / OHDSI federated network)
- Whole-genome / whole-exome variant calling (we consume aligned VCFs)
- Genome browser (IGV-style interactive)
- ClinVar / OncoKB variant interpretation in the cohort context

## Out of Scope (v1.0)

- **Variant calling**: aligned VCFs are the input; alignment + calling
  is upstream.
- **Multi-ancestry GWAS**: single-cohort regenie only — meta-analysis
  is v1.1.
- **Functional annotation**: VEP / ANNOVAR / SnpEff are v1.1.
- **Pharmacogenomics**: drug-target inference is v1.1.
- **Federation**: every analysis runs on a single source CDM at a time.
- **Real-time GWAS streaming**: results materialize once the run
  completes; no incremental Manhattan rendering.

## Traceability

Phase mapping produced by `gsd-roadmapper` on 2026-04-16.
Coverage: 14 / 14 GENOMICS-* requirements mapped (100%).

| REQ-ID       | Phase     | Status  |
|--------------|-----------|---------|
| GENOMICS-01  | Phase 14  | pending |
| GENOMICS-02  | Phase 14  | pending |
| GENOMICS-03  | Phase 15  | pending |
| GENOMICS-04  | Phase 16  | pending |
| GENOMICS-05  | Phase 15  | pending |
| GENOMICS-06  | Phase 17  | pending |
| GENOMICS-07  | Phase 17  | pending |
| GENOMICS-08  | Phase 17  | pending |
| GENOMICS-09  | Phase 18  | pending |
| GENOMICS-10  | Phase 18  | pending |
| GENOMICS-11  | Phase 18  | pending |
| GENOMICS-12a | Phase 13  | pending |
| GENOMICS-12b | Phase 18.5 (deferred) | deferred |
| GENOMICS-13  | Phase 16  | pending |
| GENOMICS-14  | Phase 15  | pending |

## Validated traceability

| REQ-ID | Quick Task | Commits |
|--------|-----------|---------|
| PHENO-01 | 260416-qpg | f4a9561c2, 44909d0b5, 0276d3ae3 |
| PHENO-02..04 | (resolver fixes) | e16973cfe, b7f9a1731 |
| PHENO-05 | (browser UI) | e16973cfe |
| PHENO-06 | (generation reconciliation) | 6a2cb4a78, 72c387aca |
| PHENO-07 | (tracking + badges) | 55c0f5ab7 |
| PHENO-08 | (loop closer) | 7504cffea |
