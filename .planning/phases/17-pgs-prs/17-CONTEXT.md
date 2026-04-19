# Phase 17: PGS Catalog Ingestion + PRS Scoring + Distribution Viz - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning
**Depends on:** Phase 14 (variant-index plumbing, darkstar plink2 runtime, `{source}_gwas_results` schema pattern)
**Parallel work:** Phase 15 (GWAS dispatch) in progress by separate agent — no file overlap expected

<domain>
## Phase Boundary

Ship 3 capabilities end-to-end so researchers can compute polygenic risk scores for any (cohort × source × PGS Catalog score) tuple and read the distribution in the cohort detail drawer:

1. **PGS Catalog ingestion** — `php artisan parthenon:load-pgs-catalog --score-id=PGS000001` downloads the score's metadata + weights file from ftp.ebi.ac.uk, lands metadata in `vocab.pgs_scores` and per-variant weights in `vocab.pgs_score_variants`, idempotent on re-run, HIGHSEC §4.1 grants (parthenon_migrator owns, parthenon_app SELECT).
2. **PRS dispatch + compute** — `POST /api/v1/finngen/endpoints/{name}/prs` with `{source_key, score_id}` kicks off a Darkstar R worker that runs `plink2 --score` against the source's PGEN (built by Phase 14 `prepare_source_variants`) + the PGS weights file, writes per-subject scores to `{source}_gwas_results.prs_subject_scores` keyed by `(score_id, cohort_definition_id, subject_id)`. Smoke test: one real endpoint × PANCREAS × real PGS Catalog score returns successfully.
3. **Cohort-drawer PRS viz** — the cohort detail drawer renders a Recharts histogram with overlaid quintile bands (ReferenceArea), summary stats (mean, median, IQR), a score picker populated from `vocab.pgs_scores`, and a "Download CSV" button. Empty state: "Compute PRS" CTA when no row exists for (cohort, score).

**In scope:**
- `parthenon:load-pgs-catalog` Artisan command with HTTPS fetch + gunzip + idempotent upsert (score-id as natural PK)
- `vocab.pgs_scores` + `vocab.pgs_score_variants` tables (migration)
- `POST /api/v1/finngen/endpoints/{name}/prs` route + controller + FormRequest validation
- Darkstar R worker `prs_compute.R` that wraps plink2 --score
- `{source}_gwas_results.prs_subject_scores` table added to the provisioner pattern (Phase 14 `GwasSchemaProvisioner`)
- React cohort-drawer sub-component `PrsDistributionPanel` using Recharts + TanStack Query
- `GET /api/v1/cohort-definitions/{id}/prs` endpoint returning score list + histogram data
- `GET /api/v1/cohort-definitions/{id}/prs/{scoreId}/download` CSV streaming endpoint
- New Spatie permission `finngen.prs.compute` (gated to researcher+data-steward+admin+super-admin)
- Pest tests for the Artisan command (idempotency), controller (422 paths), R worker (param passthrough)
- UI spec (via `/gsd-ui-phase 17` in the planner) for the histogram + empty state

**Out of scope (deferred):**
- PGS Catalog sync daemon / auto-refresh of all scores
- Multi-score comparison view (overlay 2+ scores on one histogram)
- Cross-ancestry adjustment / z-score normalization
- PRS GWAS feedback loop (using PRS as a covariate in regenie — Phase 19 candidate)
- PRS portability analysis across sources
- Phase 16 PheWeb UI (blocked on Phase 15; separate phase)
- Score ingestion from sources other than PGS Catalog (ClinVar, UK Biobank, etc.)
- Persistent PRS computation scheduling / cron

**Scope guardrails:**
- Reuse Phase 14 infrastructure: `{source}_gwas_results` schema pattern, `GwasSchemaProvisioner`, plink2 binary in darkstar image, FinnGenRunService dispatcher, Run model, R worker dispatch pattern (`source("/app/api/finngen/prs_compute.R")` similar to Phase 14's cohort_ops.R).
- No changes to `finngen.*` schema established by Phase 13.1.
- No changes to `app.cohort_definitions` semantics. PRS writes key off `cohort_definition_id` as bigint; FinnGen-generated cohorts use the 100B-offset key per Phase 13.2 D-01 (works transparently because the R worker receives `cohort_definition_id` as a param, same pattern as Phase 13.2-03).
- `vocab.pgs_scores` is read-only to `parthenon_app` per HIGHSEC. Ingestion runs as `parthenon_migrator`.

</domain>

<decisions>
## Implementation Decisions

### Compute backend (user-locked)
- **D-01:** `plink2 --score` in the Darkstar image is the PRS compute backend. Reuses the binary already shipped by Phase 14 (inline builder stage in `docker/r/Dockerfile` per commit `69c83f382`). R worker wraps `plink2 --score {weights.tsv} 2 5 6 header list-variants --pfile {source.pgen} --keep {cohort_subjects.tsv} --out {export_folder}/prs`.
- **D-02:** R worker reads plink2's `*.sscore` output, transforms to long form `(score_id, cohort_definition_id, subject_id, raw_score)`, writes via `DBI::dbWriteTable(..., append = TRUE)` or `COPY FROM STDIN` to `{source}_gwas_results.prs_subject_scores` on the PG connection envelope that darkstar receives.
- **D-03:** Rationale over `pgscatalog-calc`: zero new deps; matches Phase 14 precedent; handles PGEN inputs natively; fast enough for typical cohort sizes (≤1M subjects × ≤1M variants on commodity hardware).

### Frontend histogram tech (user-locked)
- **D-04:** Recharts `BarChart` + `ReferenceArea` for quintile band overlays. Matches existing Parthenon pattern (coverage profile badges, cohort count widgets). `ReferenceArea` spans the 20/40/60/80 percentile ranges with different fill opacities for the 5 quintile bands.
- **D-05:** Histogram data pre-aggregated server-side into 50 bins (default; configurable via `?bins=` query param). Summary stats (mean/median/IQR/stddev) computed server-side with PG `percentile_cont` aggregates. Frontend never sees raw per-subject scores except on CSV download.
- **D-06:** CSV download is a separate endpoint streaming `COPY ... TO STDOUT` via Laravel's `StreamedResponse` — handles cohorts up to ~10M subjects without memory pressure.

### Data model
- **D-07:** `vocab.pgs_scores` schema:
  - `score_id` TEXT PRIMARY KEY (e.g. `PGS000001` — stable natural identifier)
  - `pgs_name` TEXT NULL (e.g. "GPS_CAD_2018")
  - `trait_reported` TEXT NULL
  - `trait_efo_ids` TEXT[] NULL (array of EFO ontology IDs)
  - `variants_number` INTEGER NOT NULL
  - `ancestry_distribution` JSONB NULL (per-ancestry counts from PGS Catalog metadata)
  - `publication_doi` TEXT NULL
  - `license` TEXT NULL
  - `weights_file_url` TEXT NOT NULL (canonical PGS Catalog scoring file URL)
  - `harmonized_file_url` TEXT NULL (GRCh38-harmonized URL if available — preferred)
  - `genome_build` TEXT NULL (GRCh37 / GRCh38)
  - `loaded_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `created_at` / `updated_at`
- **D-08:** `vocab.pgs_score_variants` schema (composite PK so re-ingestion is idempotent):
  - `score_id` TEXT NOT NULL REFERENCES vocab.pgs_scores(score_id) ON DELETE CASCADE
  - `rsid` TEXT NULL (may be missing for some scores)
  - `chrom` TEXT NOT NULL
  - `pos_grch38` BIGINT NULL
  - `pos_grch37` BIGINT NULL
  - `effect_allele` TEXT NOT NULL
  - `other_allele` TEXT NULL
  - `effect_weight` DOUBLE PRECISION NOT NULL
  - `frequency_effect_allele` DOUBLE PRECISION NULL
  - `allele_frequency` DOUBLE PRECISION NULL
  - PRIMARY KEY (score_id, chrom, pos_grch38, effect_allele) — composite so insert-or-skip works on re-ingestion
  - INDEX on (score_id) for load performance
- **D-09:** `{source}_gwas_results.prs_subject_scores` schema — added to `GwasSchemaProvisioner::provision()` logic:
  - `score_id` TEXT NOT NULL REFERENCES vocab.pgs_scores(score_id) — cross-schema FK, same pattern as Phase 13.1 allows
  - `cohort_definition_id` BIGINT NOT NULL (includes 100B-offset FinnGen generations per Phase 13.2 D-01; no FK to `app.cohort_definitions` because FinnGen generations don't live there)
  - `subject_id` BIGINT NOT NULL
  - `raw_score` DOUBLE PRECISION NOT NULL (plink2 SCORE1_SUM or SCORE1_AVG depending on score's weighting scheme — defaults to SUM)
  - `scored_at` TIMESTAMPTZ NOT NULL DEFAULT NOW()
  - `gwas_run_id` TEXT NOT NULL REFERENCES finngen.runs(id) — lineage back to the Darkstar run
  - PRIMARY KEY (score_id, cohort_definition_id, subject_id)
  - INDEX on (cohort_definition_id, score_id) for histogram queries

### Dispatch flow
- **D-10:** PRS dispatch mirrors Phase 13.2 endpoint.generate pattern. `EndpointBrowserController::prs()` method receives `POST /api/v1/finngen/endpoints/{name}/prs`, validates `{source_key, score_id, cohort_definition_id}` (cohort_definition_id optional — if absent, uses the endpoint's active generation's offset key), dispatches via `FinnGenRunService::create()` with `analysis_type = 'finngen.prs.compute'`. Darkstar routes to `finngen_prs_compute_execute` in a new R file `darkstar/api/finngen/prs_compute.R`.
- **D-11:** R worker signature: `finngen_prs_compute_execute(source_envelope, run_id, export_folder, params)` where `params = {score_id, cohort_definition_id, subject_ids_sql_or_path}`. Worker queries `vocab.pgs_score_variants` (for the weights TSV), queries `{source}.cohort` (for subject list — using the 100B-offset key if FinnGen, real id if user cohort, same as Phase 13.2-03), calls plink2, loads result to prs_subject_scores.
- **D-12:** PRS compute does NOT need cases/controls split — unlike GWAS. Dispatch precondition only requires: score_id exists in vocab.pgs_scores (ingested), cohort has at least 1 subject, source has variant_index built.

### API surface
- **D-13:** `GET /api/v1/cohort-definitions/{id}/prs` returns `{ scores: [{ score_id, pgs_name, trait_reported, scored_at, subject_count, summary: {mean, median, stddev, iqr_q1, iqr_q3}, quintiles: [q20, q40, q60, q80], histogram: [{bin_start, bin_end, count}] }] }`. One object per score computed for this cohort. Empty array if none.
- **D-14:** `GET /api/v1/cohort-definitions/{id}/prs/{scoreId}/download` returns `Content-Type: text/csv` streaming `score_id,subject_id,raw_score\n` rows via `COPY (SELECT ...) TO STDOUT WITH CSV HEADER`.
- **D-15:** `POST /api/v1/finngen/endpoints/{name}/prs` returns 202 + run envelope (mirrors endpoint.generate shape).
- **D-16:** `GET /api/v1/pgs-catalog/scores` returns the list of ingested scores for the score picker: `[{ score_id, pgs_name, trait_reported, variants_number, loaded_at }]`.

### Auth + security
- **D-17:** New Spatie permission `finngen.prs.compute` assigned to `researcher`, `data-steward`, `admin`, `super-admin`. `viewer` gets `finngen.prs.view` (included in existing `profiles.view`) so they can see the histogram in the cohort drawer. Seeded via a new migration `2026_04_25_000100_seed_prs_permissions.php`.
- **D-18:** HIGHSEC §4.1 grants on new tables: `parthenon_migrator` owns; `parthenon_app` gets SELECT on `vocab.pgs_scores` + `vocab.pgs_score_variants`; `parthenon_app` gets SELECT/INSERT/UPDATE on `{source}_gwas_results.prs_subject_scores` (matches Phase 14 summary_stats pattern).
- **D-19:** T-13.2-S3 invariant continues to hold: PRS writes to `{source}_gwas_results.*` which is outside `app.*`. No collision surface with cohort_definition_id offset range.

### Claude's Discretion
- **PGS Catalog fetch mechanics:** Planner picks HTTPS URL pattern (`https://ftp.ebi.ac.uk/pub/databases/spot/pgs/scores/{score_id}/ScoringFiles/Harmonized/{score_id}_hmPOS_GRCh38.txt.gz` preferred; fallback to `{score_id}.txt.gz` for non-harmonized scores) + Laravel `Http::get()` with `->withOptions(['stream' => true])` + gunzip via PHP's `gzopen()`/`fgets()` stream loop to avoid loading the full file into memory.
- **Harmonization strategy:** Prefer harmonized GRCh38 scoring file when available; fall back to primary. Planner picks whether to lift GRCh37 scores to GRCh38 in-pipeline (complex) or just store both positions and let plink2 resolve via the source's genome build (simple — recommended).
- **Metadata API:** PGS Catalog REST API (`https://www.pgscatalog.org/rest/score/{score_id}`) provides structured JSON for metadata. Planner picks whether to fetch metadata via REST (cleaner) or parse the scoring file header comments.
- **Histogram binning:** Planner picks fixed 50 bins vs Freedman-Diaconis rule vs Sturges formula. Recommend fixed 50 with `?bins=` override for exploration.
- **Score picker UI:** Planner decides whether the picker is a plain `<select>` or a searchable autocomplete (since trait_reported is long; PGS Catalog has ~4000 scores).
- **Pest test breadth:** Planner picks whether to add an R testthat smoke for the worker or rely on Pest + manual darkstar run.
- **CSV streaming chunk size:** Planner picks cursor-based fetchSize for the `COPY TO STDOUT`.
- **Audit logging:** Planner decides whether PRS dispatches write to `app.audit_log` (existing middleware) vs rely on finngen.runs as the audit trail.

### Folded Todos
(No matching pending todos — `todo_count` = 0.)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 14 parent (infrastructure reuse)
- `backend/database/migrations/2026_04_19_000100_create_finngen_source_variant_indexes_table.php` — variant index pattern
- `backend/database/migrations/2026_04_19_000200_create_finngen_gwas_covariate_sets_table.php` — catalog row pattern
- `backend/app/Services/FinnGen/GwasSchemaProvisioner.php` — extend for prs_subject_scores
- `backend/app/Services/FinnGen/GwasRunService.php` — dispatch pattern
- `backend/app/Services/FinnGen/GwasCacheKeyHasher.php` — hashing pattern if we cache PRS results
- `backend/app/Console/Commands/FinnGen/PrepareSourceVariantsCommand.php` — Artisan command pattern
- `darkstar/api/finngen/cohort_ops.R` — R worker dispatch + plink2 wrap pattern (Phase 13.2-03 + 14)
- `docker/r/Dockerfile` L? — regenie + plink2 builder stages already inline (commit 69c83f382)

### Phase 13.1 + 13.2 invariants
- `.planning/phases/13.1-finngen-schema-isolation/13.1-CONTEXT.md` D-01 (single-txn migration pattern)
- `.planning/phases/13.2-finish-finngen-cutover/13.2-CONTEXT.md` D-01..D-03 (100B offset key in `cohort_definition_id`)
- `backend/app/Models/App/FinnGenEndpointGeneration.php` OMOP_COHORT_ID_OFFSET constant — reused for PRS dispatch when target is a FinnGen generation
- `backend/app/Http/Controllers/Api/V1/FinnGen/EndpointBrowserController.php::generate()` (Phase 13.2-03 rewrite) — template for `prs()` method

### Governance + security
- `.claude/rules/HIGHSEC.spec.md` §4.1 (grants pattern)
- `.claude/CLAUDE.md` §Database Architecture — vocab schema is shared across CDM connections

### PGS Catalog references (external)
- PGS Catalog REST API: https://www.pgscatalog.org/rest/
- Scoring file format spec: https://www.pgscatalog.org/downloads/
- plink2 --score docs: https://www.cog-genomics.org/plink/2.0/score

### Target code (to create)
- `backend/database/migrations/2026_04_25_000100_create_pgs_catalog_tables.php` — vocab.pgs_scores + vocab.pgs_score_variants
- `backend/database/migrations/2026_04_25_000200_seed_prs_permissions.php` — Spatie permissions
- `backend/app/Console/Commands/FinnGen/LoadPgsCatalogCommand.php` — Artisan ingestion
- `backend/app/Services/FinnGen/PgsCatalogFetcher.php` — HTTPS + gunzip + parse
- `backend/app/Services/FinnGen/PgsScoreIngester.php` — upsert into vocab.pgs_*
- `backend/app/Services/FinnGen/PrsDispatchService.php` — wraps FinnGenRunService for prs.compute
- `backend/app/Http/Controllers/Api/V1/FinnGen/EndpointBrowserController.php` — add prs() method (or separate PrsController)
- `backend/app/Http/Controllers/Api/V1/CohortPrsController.php` — index + download endpoints
- `backend/app/Http/Requests/FinnGen/ComputePrsRequest.php` — FormRequest validation
- `backend/app/Http/Requests/Cohort/DownloadPrsRequest.php`
- `backend/routes/api.php` — 3 new route groups
- `darkstar/api/finngen/prs_compute.R` — plink2 wrapper
- `darkstar/api/finngen/routes.R` — add finngen.prs.compute dispatcher
- `frontend/src/features/cohort-definitions/components/PrsDistributionPanel.tsx` — histogram component
- `frontend/src/features/cohort-definitions/hooks/usePrsScores.ts` — TanStack Query hooks
- `frontend/src/features/cohort-definitions/components/ComputePrsModal.tsx` — empty-state CTA + score picker

### Target tests
- `backend/tests/Feature/FinnGen/LoadPgsCatalogCommandTest.php` — idempotency, partial-failure recovery
- `backend/tests/Feature/FinnGen/PrsDispatchTest.php` — 202 + run envelope shape
- `backend/tests/Feature/FinnGen/CohortPrsEndpointsTest.php` — histogram + CSV
- `backend/tests/Unit/FinnGen/PgsCatalogFetcherTest.php` — gunzip + parse
- `backend/tests/Unit/FinnGen/PgsScoreIngesterTest.php` — upsert idempotency

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable assets (from Phases 13.1 + 13.2 + 14)
- **`GwasSchemaProvisioner`** — already provisions `{source}_gwas_results` schema with summary_stats; extend to add prs_subject_scores + indexes + HIGHSEC grants.
- **`FinnGenRunService::create()`** — accepts arbitrary params dict + analysis_type; PRS dispatch passes `analysis_type='finngen.prs.compute'` and `params={score_id, cohort_definition_id, source_key}`.
- **plink2 binary** — inline-built in `docker/r/Dockerfile` per Phase 14. Available at `/usr/local/bin/plink2`.
- **`source("/app/api/finngen/cohort_ops.R")`** pattern — R worker dispatcher uses source()-per-job which means adding `prs_compute.R` requires only a routes.R update + file creation.
- **Darkstar bind-mount** — R source is bind-mounted from repo `darkstar/api/finngen/*.R` (per Phase 13.2-03 discovery). Editing the file takes effect on next job dispatch without image rebuild.
- **Phase 13.2 OMOP_COHORT_ID_OFFSET + shared-PDO trait** — test infra carries over; PRS tests that write to `{source}_gwas_results.prs_subject_scores` and read from `finngen.runs` use the same `SharesPdoAcrossTestConnections` trait to cross connections.
- **Recharts in frontend** — already in dependencies; `CoverageProfileBadge` (Phase 13-07) + `CohortCountWidget` use Recharts patterns the histogram can mirror.

### Established patterns
- **Artisan command with HTTPS fetch + idempotent upsert** — `FinnGenEndpointImporter` (Phase 13) does the same pattern (fetch FinnGen endpoint JSON → upsert to finngen.endpoint_definitions). LoadPgsCatalogCommand mirrors.
- **Cross-schema FKs are native in PG17** — Phase 13.1 verified. `{source}_gwas_results.prs_subject_scores.score_id → vocab.pgs_scores.score_id` is natural.
- **Single-transaction migration pattern** (Phase 13.1 D-01) — CREATE TABLE + grants + indexes in one txn. Laravel auto-wraps.
- **HIGHSEC grants-on-create** — migrations include `DO $grants$ IF pg_roles contains 'parthenon_app' THEN GRANT ... $grants$` blocks.
- **100B-offset key transparency** — R worker reads `cohort_definition_id` from params as int, passes to plink2 --keep. No worker code change needed to handle FinnGen vs user cohorts.

### Integration points
- **Cohort detail drawer** — existing React component at `frontend/src/features/cohort-definitions/pages/CohortDefinitionDetailPage.tsx`. Add `PrsDistributionPanel` as a new accordion or tab section.
- **`vocab` schema** — shared across all CDM connections. Migration runs on default `pgsql` connection; data is visible to all per-source connections via search_path.
- **Score picker data source** — `GET /api/v1/pgs-catalog/scores` backed by `SELECT score_id, pgs_name, trait_reported, variants_number, loaded_at FROM vocab.pgs_scores ORDER BY loaded_at DESC`.
- **Audit trail** — PRS dispatches recorded in `finngen.runs` with `analysis_type='finngen.prs.compute'`. Surface in the run history view (Phase 15 work) when that lands.

</code_context>

<specifics>
## Specific Ideas

- **PGS Catalog uses score_id as a stable natural key** (`PGS000001` format). Never synthesize our own id; use theirs as the PK.
- **Harmonized GRCh38 files are preferred** — PGS Catalog ships them for most scores. Falls back to primary files when missing.
- **100B-offset transparent** — R worker doesn't know whether cohort_definition_id is a user cohort or a FinnGen generation's offset key. Same plink2 `--keep` invocation either way.
- **Cross-schema FK `prs_subject_scores.score_id → vocab.pgs_scores.score_id`** is architecturally clean because vocab is shared reference data. No schema-isolation violation.
- **PGS Catalog scoring files are typically 100KB–5MB** — small enough to hold in memory during ingestion; no streaming needed at parse time (download via stream is fine).
- **Recharts ReferenceArea for quintile bands** — straightforward: 5 ReferenceAreas from 0–20%, 20–40%, ... each with a different fill-opacity (lightest at tails, darkest at median band) to visually distinguish.

</specifics>

<deferred>
## Deferred Ideas

- PGS Catalog auto-refresh daemon (cron that re-ingests all loaded scores monthly)
- Multi-score comparison view (histogram overlay)
- Cross-ancestry adjustment (ancestry-specific z-scoring)
- PRS as a covariate in regenie (PRS-GWAS feedback loop)
- Cross-source PRS portability analysis (same cohort, different sources)
- ClinVar / UK Biobank score sources beyond PGS Catalog
- PRS computation scheduling / background cron
- Per-subject PRS export to FHIR/GA4GH VRS

### Reviewed Todos (not folded)
(No matching pending todos — `todo_count` = 0.)

</deferred>

---

*Phase: 17-pgs-prs*
*Context gathered: 2026-04-18*
