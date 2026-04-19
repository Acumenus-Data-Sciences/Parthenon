# Phase 17: PGS Catalog Ingestion + PRS Scoring + Distribution Viz — Research

**Researched:** 2026-04-17
**Domain:** Polygenic risk scoring; PGS Catalog integration; plink2 --score; Recharts histogram; Laravel StreamedResponse; PostgreSQL percentile/width_bucket aggregates
**Confidence:** HIGH (all 19 architectural decisions are user-locked; research focuses on actionable implementation details)
**Branch:** `feature/phase-17-pgs-prs` @ `1903d9a7a`

<user_constraints>
## User Constraints (from 17-CONTEXT.md)

### Locked Decisions (D-01 … D-19 — DO NOT re-litigate)

**Compute backend:**
- **D-01** `plink2 --score` inside the Darkstar image (reuses Phase 14 binary at `/opt/regenie/plink2` per `docker/r/Dockerfile` L394). R worker wraps `plink2 --score {weights.tsv} 2 5 6 header list-variants --pfile {source.pgen} --keep {cohort_subjects.tsv} --out {export_folder}/prs`.
- **D-02** R worker reads `*.sscore`, transforms to long form `(score_id, cohort_definition_id, subject_id, raw_score)`, writes to `{source}_gwas_results.prs_subject_scores` via `DBI::dbWriteTable(append=TRUE)` or `COPY FROM STDIN`.
- **D-03** Rationale: no pgscatalog-calc dep; matches Phase 14 precedent; PGEN-native; fast for typical cohorts.

**Frontend histogram:**
- **D-04** Recharts `BarChart` + `ReferenceArea` for 5 quintile overlays (20/40/60/80 percentiles).
- **D-05** Histogram server-pre-aggregated into 50 bins (configurable via `?bins=`). Summary stats via PG `percentile_cont`. Frontend never sees raw per-subject scores except on CSV download.
- **D-06** CSV download streams `COPY ... TO STDOUT` via Laravel's `StreamedResponse` — scales to ~10M subjects.

**Data model:**
- **D-07** `vocab.pgs_scores` table: score_id (TEXT PK), pgs_name, trait_reported, trait_efo_ids TEXT[], variants_number, ancestry_distribution JSONB, publication_doi, license, weights_file_url, harmonized_file_url, genome_build, loaded_at, timestamps.
- **D-08** `vocab.pgs_score_variants` table: composite PK (score_id, chrom, pos_grch38, effect_allele); columns rsid, chrom, pos_grch38, pos_grch37, effect_allele, other_allele, effect_weight, frequency_effect_allele, allele_frequency; index on (score_id).
- **D-09** `{source}_gwas_results.prs_subject_scores` added to `GwasSchemaProvisioner::provision()`: PK (score_id, cohort_definition_id, subject_id); cross-schema FK `score_id → vocab.pgs_scores(score_id)`; no FK on cohort_definition_id (100B offset); `gwas_run_id → finngen.runs(id)`; index on (cohort_definition_id, score_id).

**Dispatch flow:**
- **D-10** Mirrors Phase 13.2 generate pattern. `POST /api/v1/finngen/endpoints/{name}/prs` with `{source_key, score_id, cohort_definition_id?}`. Dispatch via `FinnGenRunService::create()` with `analysis_type = 'finngen.prs.compute'` → `darkstar/api/finngen/prs_compute.R`.
- **D-11** R worker signature: `finngen_prs_compute_execute(source_envelope, run_id, export_folder, params)` with `params = {score_id, cohort_definition_id, subject_ids_sql_or_path}`. Worker queries `vocab.pgs_score_variants`, queries `{cohort_schema}.cohort` for subjects, calls plink2, loads result.
- **D-12** Preconditions: score_id exists in vocab.pgs_scores; cohort has ≥1 subject; source has variant_index built. NO cases/controls split.

**API surface:**
- **D-13** `GET /api/v1/cohort-definitions/{id}/prs` → `{ scores: [{ score_id, pgs_name, trait_reported, scored_at, subject_count, summary: {...}, quintiles: [q20,q40,q60,q80], histogram: [{bin_start, bin_end, count}] }] }`.
- **D-14** `GET /api/v1/cohort-definitions/{id}/prs/{scoreId}/download` → `text/csv` streaming `COPY (SELECT ...) TO STDOUT WITH CSV HEADER`.
- **D-15** `POST /api/v1/finngen/endpoints/{name}/prs` returns 202 + run envelope.
- **D-16** `GET /api/v1/pgs-catalog/scores` → list for picker.

**Auth + security:**
- **D-17** New Spatie permission `finngen.prs.compute` (researcher, data-steward, admin, super-admin). `viewer` gets `finngen.prs.view` (bundled into existing `profiles.view`). Seed via migration `2026_04_25_000200_seed_prs_permissions.php`.
- **D-18** HIGHSEC §4.1 grants: `parthenon_migrator` owns; `parthenon_app` SELECT on vocab.pgs_* ; `parthenon_app` SELECT/INSERT/UPDATE on `{source}_gwas_results.prs_subject_scores`.
- **D-19** T-13.2-S3 invariant holds: PRS writes to `{source}_gwas_results.*` which is outside `app.*`.

### Claude's Discretion (research + recommend)
- PGS Catalog HTTPS fetch mechanics (URL + stream + gunzip)
- Harmonization strategy (store both positions vs lift)
- Metadata source (REST API vs file header parsing)
- Histogram binning rule (fixed 50 vs Freedman-Diaconis)
- Score picker UI (plain select vs searchable autocomplete)
- Pest test breadth (add R testthat or rely on Pest)
- CSV streaming chunk size
- Audit logging (`app.audit_log` vs `finngen.runs` only)
- PRS caching strategy

### Deferred Ideas (OUT OF SCOPE)
- PGS Catalog auto-refresh daemon
- Multi-score comparison view
- Cross-ancestry adjustment / z-score
- PRS as GWAS covariate (Phase 19 candidate)
- Cross-source PRS portability
- ClinVar / UK Biobank score sources
- PRS computation cron
- Per-subject FHIR / GA4GH VRS export
- Phase 16 PheWeb UI
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **GENOMICS-06** | `php artisan parthenon:load-pgs-catalog --score-id=PGS000001` ingests into `vocab.pgs_scores` + `vocab.pgs_score_variants`; idempotent | §"PGS Catalog Fetch Pipeline" + §"Ingestion Idempotency" + `LoadVocabularies.php` COPY precedent (backend/app/Console/Commands/LoadVocabularies.php:214) |
| **GENOMICS-07** | `POST /api/v1/finngen/endpoints/{name}/prs` → Darkstar PRS run → `{source}_gwas_results.prs_subject_scores` keyed by (score_id, cohort_definition_id, subject_id) | §"Dispatch Flow & Cross-Component Data Contract" + §"R Worker Data Flow" + Phase 13.2 live evidence (cohort_definition_id=100000000001, 135 subjects in pancreas_results.cohort) |
| **GENOMICS-08** | Cohort-drawer PRS distribution viz: histogram + quintile bands + summary stats + CSV download + "Compute PRS" empty state | §"Frontend Histogram Architecture" + §"Cohort Detail Drawer Integration" + `LabTrendChart.tsx` ReferenceArea precedent |

All three plans in this phase MUST list these three IDs in their `requirements_addressed`.
</phase_requirements>

## Summary

Phase 17 ships three end-to-end capabilities on top of Phase 14's GWAS infrastructure: (1) a PGS Catalog ingestion command that downloads a harmonized GRCh38 scoring file and lands metadata + per-variant weights in a shared `vocab.pgs_scores` + `vocab.pgs_score_variants` pair; (2) a PRS compute dispatch that shells `plink2 --score` inside the Darkstar image against the source's PGEN (already built by Phase 14's `PrepareSourceVariantsCommand`) and writes per-subject scores; (3) a cohort-drawer Recharts histogram with quintile-band overlays, summary stats, and CSV download.

Every architectural decision is locked (D-01..D-19). The research below focuses on **implementation details, pitfalls, and unknowns surfaced during live verification** — not re-opening settled questions.

**Primary recommendation:** Use PGS Catalog's REST endpoint (`https://www.pgscatalog.org/rest/score/{id}/`) for metadata + harmonized GRCh38 URL, then stream-download the `.txt.gz` with `Http::timeout->withOptions(['sink' => $tmp])` and parse with `gzgets()` line-by-line (exact pattern already in `ClinVarSyncService.php`). Use `plink2 --score ... cols=+scoresums` so the output contains `SCORE1_SUM` (the raw PRS value). Write to `pancreas_results.prs_subject_scores` (not `pancreas.prs_subject_scores`) — the R source envelope resolves `schemas$cohort = resultsSchema` per `FinnGenSourceContextBuilder.php:64`. **Before drafting any vocab.pgs_* migration, investigate the vocab-schema ownership pitfall described in §"CRITICAL Pitfall — vocab schema not owned by parthenon_migrator" — `./deploy.sh --db` cannot currently create tables in vocab without a privilege grant from schema owner `smudoshi`.**

## Standard Stack

### Core (all already in-project)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **plink2** | alpha 6.33 (20260228) | `--score` compute | Already shipped in Darkstar image per `docker/r/Dockerfile` L30-39 + L393-395 (builder stage + COPY into runtime). Binary path: `/opt/regenie/plink2`. No new dep. `[VERIFIED: docker/r/Dockerfile]` |
| **DatabaseConnector** | 7.1.0 | R worker DB I/O | Already used by Phase 14 (`gwas_regenie.R`); `insertTable(..., bulkLoad=TRUE)` emits `COPY FROM STDIN` under-the-hood. `[VERIFIED: docker/r/Dockerfile L115, gwas_regenie.R L359]` |
| **processx** | latest | Subprocess dispatch | Used by `gwas_regenie.R` for regenie. Argv-vector mode (no shell interpolation) required by HIGHSEC §10. `[VERIFIED: gwas_regenie.R L479]` |
| **Laravel Http** | 11.x | PGS Catalog fetch | `Http::timeout()->withOptions(['sink' => $tmp])` — live pattern in `ClinVarSyncService.php:75`. `[VERIFIED: grep of backend/]` |
| **Recharts** | 3.x (peer of React 19) | Histogram | `ReferenceArea` already used in `LabTrendChart.tsx:78` + `DqTrendChart.tsx` (the only two existing usages). `[VERIFIED: frontend/src grep]` |
| **Spatie Permission** | — | RBAC seeding | Idempotent migration precedent in `2026_04_03_000006_add_patient_similarity_permissions.php`. `[VERIFIED: existing migration]` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **PHP `gzopen`/`gzgets`** | built-in | Stream-decompress PGS Catalog .txt.gz | Live pattern at `ClinVarSyncService.php:91-103`. Preferred over full-decompress into memory (PGS files 100KB-5MB so memory is OK but streaming is the cheaper pattern). `[VERIFIED]` |
| **Symfony StreamedResponse** | built-in | CSV download | Live patterns at `TextToSqlController.php:360` (fputcsv loop) and `WikiController.php:191` (streamDownload). Prefer `response()->streamDownload()` — thinner API. `[VERIFIED]` |
| **jsonlite / digest** R packages | already installed | Param parse + (optional) cache key | Phase 14 precedent. `[VERIFIED: docker/r/Dockerfile L99]` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `plink2 --score` | `pgscatalog-calc` Python package | `[CITED: pypi.org/project/pgscatalog-utils]` Would add Python dep + a new service boundary. D-03 rejects. |
| Streaming gunzip | Full-decompress in-memory | PGS files are small (100KB-5MB per §"PGS Catalog File Format" below). Streaming is cheap safety margin but not strictly required. |
| REST API metadata | Parse `#` header comments in the scoring file | Header parse is simpler (one fetch vs two) but metadata is terser (no ancestry_distribution JSONB). Recommend: **REST API for metadata, file for weights** — mirrors how `pgscatalog-utils` itself splits the fetch. `[CITED: PGS Catalog REST docs]` |

**Installation:** nothing new to `npm install` / `composer require` / `R install`. All deps are already pinned.

**Version verification:**
- `plink2 alpha 6.33 (20260228)` — pinned in `docker/r/Dockerfile:31` via `PLINK2_DATE=20260228` (S3 asset path `plink2-assets/alpha6/plink2_linux_avx2_20260228.zip`). Verified present in runtime image per Phase 14-05's multi-stage `COPY --from=plink2-builder`. `[VERIFIED: Dockerfile grep]`
- `Recharts` version — `[ASSUMED: 3.x latest]` — Phase 13-07's CoverageProfileBadge and `LabTrendChart.tsx` import from `recharts` without a version pin in the snippets read; assumed standard React-19-compatible release. Planner MAY verify with `cat frontend/package.json | jq '.dependencies.recharts'` if a specific minor matters.

## Architecture Patterns

### Recommended Project Structure

```
backend/
├── app/
│   ├── Console/Commands/FinnGen/
│   │   └── LoadPgsCatalogCommand.php              # NEW — parthenon:load-pgs-catalog --score-id=PGS000001
│   ├── Services/FinnGen/
│   │   ├── PgsCatalogFetcher.php                  # NEW — REST metadata + stream-gunzip file
│   │   ├── PgsScoreIngester.php                   # NEW — upsert vocab.pgs_scores + pgs_score_variants
│   │   └── PrsDispatchService.php                 # NEW — thin GwasRunService-style wrapper
│   ├── Http/
│   │   ├── Controllers/Api/V1/
│   │   │   ├── FinnGen/EndpointBrowserController.php   # MODIFY — add prs() method
│   │   │   ├── CohortPrsController.php           # NEW — index + download + pgs-catalog picker
│   │   └── Requests/FinnGen/
│   │       └── ComputePrsRequest.php             # NEW — FormRequest
│   └── Models/App/
│       ├── PgsScore.php                          # NEW — Eloquent over vocab.pgs_scores
│       └── PgsScoreVariant.php                   # NEW — Eloquent over vocab.pgs_score_variants
├── database/migrations/
│   ├── 2026_04_25_000100_create_pgs_catalog_tables.php   # NEW
│   └── 2026_04_25_000200_seed_prs_permissions.php        # NEW
├── routes/api.php                                # MODIFY — 3 new route groups
└── tests/Feature/FinnGen/
    ├── LoadPgsCatalogCommandTest.php             # NEW
    ├── PrsDispatchTest.php                       # NEW
    └── CohortPrsEndpointsTest.php                # NEW

darkstar/api/finngen/
├── prs_compute.R                                 # NEW
└── routes.R                                      # MODIFY — add finngen.prs.compute dispatcher

backend/app/Services/FinnGen/GwasSchemaProvisioner.php   # MODIFY — extend provision() to create prs_subject_scores

frontend/src/features/cohort-definitions/
├── components/
│   ├── PrsDistributionPanel.tsx                  # NEW
│   └── ComputePrsModal.tsx                       # NEW (empty-state CTA + score picker)
├── hooks/
│   └── usePrsScores.ts                           # NEW — TanStack Query hooks
└── pages/CohortDefinitionDetailPage.tsx          # MODIFY — add tab OR accordion section (planner picks)
```

### Pattern 1: Artisan command with stream-gunzip ingestion

**What:** `LoadPgsCatalogCommand` follows the exact shape of `ClinVarSyncService`: sink .gz to tmp file, open with `gzopen`, iterate `gzgets`, parse TSV, batch-upsert.

**When to use:** Any PGS Catalog ingestion (or future ClinVar-style reference-data command).

**Example:**
```php
// Source: backend/app/Services/Genomics/ClinVarSyncService.php:69-113 (live pattern)
private function download(string $url): string {
    $tmp = tempnam(sys_get_temp_dir(), 'pgs_').'.txt.gz';
    $response = Http::timeout(600)->withOptions(['sink' => $tmp])->get($url);
    if ($response->failed()) {
        throw new \RuntimeException("PGS download failed: HTTP {$response->status()}");
    }
    return $tmp;
}

private function parseAndUpsert(string $gzPath, string $scoreId): array {
    $fh = @gzopen($gzPath, 'rb');
    if ($fh === false) { throw new \RuntimeException("Cannot open gzip: {$gzPath}"); }
    try {
        // Skip # header lines until we see the column header
        while (($line = gzgets($fh)) !== false) {
            $line = rtrim($line, "\r\n");
            if ($line === '') continue;
            if (str_starts_with($line, '#')) {
                // Capture metadata from header comments here (optional — REST API is primary source per Claude's Discretion)
                continue;
            }
            // First non-# line is the column header row (tab-delimited)
            $columns = explode("\t", $line);
            break;
        }
        $batch = [];
        while (($line = gzgets($fh)) !== false) {
            $fields = explode("\t", rtrim($line, "\r\n"));
            // ... map columns to PgsScoreVariant attrs
            $batch[] = [...];
            if (count($batch) >= 1000) {
                DB::table('vocab.pgs_score_variants')->insertOrIgnore($batch);
                $batch = [];
            }
        }
        if ($batch) DB::table('vocab.pgs_score_variants')->insertOrIgnore($batch);
    } finally { gzclose($fh); @unlink($gzPath); }
}
```

### Pattern 2: Darkstar R worker with plink2 processx

**What:** `prs_compute.R` follows `gwas_regenie.R`'s shape — param unpack → DB connection → assemble weights.tsv + keep.tsv → `processx::run()` plink2 → parse `.sscore` → `insertTable(bulkLoad=TRUE)` write-back.

**When to use:** Any plink2-wrapping Darkstar endpoint.

**Example:**
```r
# Source: darkstar/api/finngen/gwas_regenie.R:479-497 (live pattern — argv vector, no shell)
.PLINK2_BIN <- "/opt/regenie/plink2"  # NOTE: /opt/regenie/, not /opt/plink2/ — see Pitfall 1

finngen_prs_compute_execute <- function(source_envelope, run_id, export_folder, params) {
  dir.create(export_folder, recursive = TRUE, showWarnings = FALSE)
  progress_path <- file.path(export_folder, "progress.json")

  run_with_classification(export_folder, function() {
    score_id      <- as.character(params$score_id)
    cohort_id     <- as.numeric(params$cohort_definition_id)  # NUMERIC, not integer — handles 100B offset
    source_key    <- tolower(as.character(source_envelope$source_key %||% params$source_key))

    # Read weights from vocab.pgs_score_variants — write TSV plink2 can consume
    conn <- .finngen_open_connection(source_envelope)
    on.exit(tryCatch(DatabaseConnector::disconnect(conn), error = function(e) NULL), add = TRUE)

    weights_df <- DatabaseConnector::querySql(conn, sprintf(
      "SELECT rsid AS id, effect_allele AS allele, effect_weight::text AS weight
         FROM vocab.pgs_score_variants
        WHERE score_id = '%s'
          AND rsid IS NOT NULL",
      gsub("'", "''", score_id)
    ))
    names(weights_df) <- tolower(names(weights_df))
    weights_path <- file.path(export_folder, "weights.tsv")
    write.table(weights_df, weights_path, sep = "\t", quote = FALSE, row.names = FALSE, col.names = TRUE)

    # Build keep.tsv from {cohort_schema}.cohort
    cohort_schema <- source_envelope$schemas$cohort %||% paste0(source_key, "_results")
    subjects <- DatabaseConnector::querySql(conn, sprintf(
      "SELECT DISTINCT 'person_' || subject_id AS fid, 'person_' || subject_id AS iid
         FROM %s.cohort WHERE cohort_definition_id = %.0f",
      cohort_schema, cohort_id
    ))
    keep_path <- file.path(export_folder, "keep.tsv")
    write.table(subjects, keep_path, sep = "\t", quote = FALSE, row.names = FALSE, col.names = FALSE)

    # Look up the PGEN (Phase 14 tracking row)
    pgen_info <- .lookup_pgen_prefix(source_envelope, source_key)  # reuse gwas_regenie.R helper
    out_prefix <- file.path(export_folder, "prs")

    res <- processx::run(
      command = .PLINK2_BIN,
      args = c(
        "--pfile", pgen_info$pgen_prefix,
        "--keep", keep_path,
        "--score", weights_path, "1", "2", "3", "header", "list-variants",
        "cols=+scoresums",
        "--out", out_prefix
      ),
      echo_cmd = FALSE, stderr_to_stdout = TRUE, error_on_status = FALSE,
      timeout = 30 * 60  # 30 min
    )
    if (res$status != 0L) stop(sprintf("plink2 --score failed: %s", paste(tail(strsplit(res$stdout, "\n")[[1]], 40), collapse="\n")))

    # Parse .sscore, insertTable to {source}_gwas_results.prs_subject_scores
    sscore <- read.table(paste0(out_prefix, ".sscore"), header = TRUE, comment.char = "")
    names(sscore) <- tolower(names(sscore))
    # .sscore columns: X.iid, allele_ct, named_allele_dosage_sum, score1_avg, score1_sum (with cols=+scoresums)
    results <- data.frame(
      score_id             = score_id,
      cohort_definition_id = as.numeric(cohort_id),  # keep numeric to preserve 100B offset
      subject_id           = as.integer(sub("^person_", "", sscore$x.iid)),
      raw_score            = as.numeric(sscore$score1_sum),  # D-09 uses raw_score — plink2 SCORE1_SUM
      scored_at            = Sys.time(),
      gwas_run_id          = run_id,
      stringsAsFactors     = FALSE
    )
    DatabaseConnector::insertTable(
      connection = conn,
      databaseSchema = paste0(source_key, "_gwas_results"),
      tableName = "prs_subject_scores",
      data = results,
      dropTableIfExists = FALSE, createTable = FALSE, bulkLoad = TRUE
    )

    list(rows_written = nrow(results), score_id = score_id, cohort_definition_id = cohort_id)
  })
}
```

### Pattern 3: Server-side histogram aggregation

**What:** PG's `width_bucket` + `percentile_cont` do the histogram + summary in one round-trip. Frontend receives aggregated data only.

**When to use:** Any cohort × score histogram API. Scales to cohorts of any size without paging.

**Example:**
```sql
-- Source: backend/app/Console/Commands/ComputeReferenceRangesCommand.php:80-106 (live percentile_cont pattern)
WITH
bounds AS (
    SELECT MIN(raw_score) AS lo, MAX(raw_score) AS hi
      FROM pancreas_gwas_results.prs_subject_scores
     WHERE score_id = :score_id AND cohort_definition_id = :cohort_id
),
binned AS (
    SELECT width_bucket(raw_score, bounds.lo, bounds.hi, :bins) AS bin,
           raw_score
      FROM pancreas_gwas_results.prs_subject_scores, bounds
     WHERE score_id = :score_id AND cohort_definition_id = :cohort_id
)
SELECT
    COALESCE(bin, :bins)::int AS bin,
    COUNT(*) AS n,
    MIN(raw_score)::float AS bin_lo,
    MAX(raw_score)::float AS bin_hi
  FROM binned
 GROUP BY bin
 ORDER BY bin;

-- Summary in a parallel query:
SELECT
    AVG(raw_score)::float AS mean,
    STDDEV(raw_score)::float AS stddev,
    percentile_cont(0.20) WITHIN GROUP (ORDER BY raw_score)::float AS q20,
    percentile_cont(0.40) WITHIN GROUP (ORDER BY raw_score)::float AS q40,
    percentile_cont(0.50) WITHIN GROUP (ORDER BY raw_score)::float AS median,
    percentile_cont(0.60) WITHIN GROUP (ORDER BY raw_score)::float AS q60,
    percentile_cont(0.80) WITHIN GROUP (ORDER BY raw_score)::float AS q80,
    percentile_cont(0.25) WITHIN GROUP (ORDER BY raw_score)::float AS iqr_q1,
    percentile_cont(0.75) WITHIN GROUP (ORDER BY raw_score)::float AS iqr_q3,
    COUNT(*)::int AS subject_count
  FROM pancreas_gwas_results.prs_subject_scores
 WHERE score_id = :score_id AND cohort_definition_id = :cohort_id;
```

**Note on `width_bucket`:** returns bucket 0 for values below lo (won't happen with MIN/MAX bounds) and bucket `:bins+1` for the max value. Use `COALESCE(bin, :bins)` or `LEAST(bin, :bins)` to fold the upper-tail edge case into the last bin.

### Pattern 4: CSV StreamedResponse with `COPY … TO STDOUT`

**What:** Avoid in-memory materialization for multi-million-row exports. Issue a PG `COPY (SELECT ...) TO STDOUT WITH CSV HEADER` and pipe the raw bytes to the HTTP response.

**When to use:** Cohort × score scatter export (D-06, D-14).

**Example:**
```php
// PATTERN: combine TextToSqlController.php:360 (StreamedResponse with fputcsv) with direct COPY for larger volumes
public function download(int $id, string $scoreId): StreamedResponse {
    // Resolve source for this cohort, lookup schema
    $sourceKey = /* ... */;
    $schema = strtolower($sourceKey) . '_gwas_results';

    return response()->streamDownload(function () use ($schema, $scoreId, $id) {
        $pdo = DB::connection()->getPdo();
        $stmt = $pdo->pgsqlCopyToStdout(sprintf(
            "COPY (SELECT score_id, subject_id, raw_score FROM %s.prs_subject_scores WHERE score_id = %s AND cohort_definition_id = %d) TO STDOUT WITH CSV HEADER",
            $schema,
            $pdo->quote($scoreId),
            $id
        ));
        // pgsqlCopyToStdout is hypothetical — PDO_pgsql exposes this via pg_copy_to; simpler pattern:
        // Use pdo_pgsql specific extension method. If unavailable, fall back to fputcsv chunked-fetch pattern
        // from TextToSqlController.php.
    }, "prs-{$scoreId}-cohort-{$id}.csv", ['Content-Type' => 'text/csv']);
}
```

**IMPORTANT:** PHP's PDO PostgreSQL driver exposes `PDO::pgsqlCopyFromFile` / `pgsqlCopyFromArray` / `pgsqlCopyToFile` **but not a STDOUT streaming variant** [CITED: php.net/manual/en/ref.pdo-pgsql.php]. For `COPY TO STDOUT` you must drop to `pg_connect` + `pg_copy_to` OR use the cursor-based `SELECT` + `fputcsv` chunked fetch pattern already in `TextToSqlController.php:360-381`. **Recommendation: use cursor + fputcsv with `DB::table()->orderBy()->chunkById(10000)`** — simpler, no raw-connection hoops, scales to 10M+ rows via chunking. D-06's "10M subjects without memory pressure" requirement is met by `chunkById` streaming the query.

### Anti-Patterns to Avoid

- **Don't** compute the histogram client-side. Frontend should never receive raw per-subject scores (D-05). This violates privacy and memory budgets.
- **Don't** use R's `integer` type for `cohort_definition_id`. R integer is 32-bit; the 100B offset overflows. Phase 13.2-03 pattern: use `numeric`/double (see `cohort_ops.R:396` + `FinnGenEndpointGeneration.php:40`).
- **Don't** shell-interpolate `source_key` into SQL. Use the `^[a-z][a-z0-9_]*$` regex guard before every interpolation (same as `GwasSchemaProvisioner::SAFE_SOURCE_REGEX`).
- **Don't** hard-code `plink2` path as `/opt/plink2/plink2`. The Darkstar runtime stage lands both binaries under `/opt/regenie/` per `docker/r/Dockerfile:394`. Use `/opt/regenie/plink2`.
- **Don't** write the PRS table via Laravel migrations into `vocab.*` without first resolving the vocab-ownership pitfall (see CRITICAL pitfall below).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PRS computation | Custom dot-product over weights × genotype dosage | `plink2 --score` with `cols=+scoresums` | Handles missing genotype mean-imputation, ambiguous-strand SNPs, multi-allelic variants, and dosage scaling. 30+ yr of validation behind it. `[CITED: cog-genomics.org/plink/2.0/score]` |
| Gzip streaming | Manual zlib FFI | `gzopen` / `gzgets` (PHP built-in) | ClinVarSyncService precedent; battle-tested; matches reference. |
| CSV streaming | Chunked JSON-to-CSV transform | `fputcsv` + `chunkById` OR `COPY ... TO STDOUT` | PDO-pgsql `pgsqlCopyFromArray` exists but no STDOUT variant; cursor + fputcsv is the proven path. |
| Histogram binning | Custom equal-width bucketing | PG `width_bucket(value, lo, hi, n)` | Native, indexed-friendly, handles edge cases. Frontend gets `{bin, n, bin_lo, bin_hi}` only. |
| Quintile computation | Sorting + slicing in R/PHP | PG `percentile_cont(0.2..0.8) WITHIN GROUP (ORDER BY ...)` | Exact (not discrete like `percentile_disc`). Live pattern at `ComputeReferenceRangesCommand.php:84`. |
| Subject-ID mapping in plink2 | Custom TSV rewrites | Phase 14's `person_{person_id}` convention | Already enforced by `PrepareSourceVariantsCommand::writeSampleMap()`; PGEN's `.psam` already carries this FID/IID. PRS `--keep` TSV MUST emit `person_<id>` to match. |
| Permission seeding | Raw SQL INSERT | Spatie `Permission::firstOrCreate` + `Role::findByName` | Idempotent; plays nice with cached guard names; exact pattern at `2026_04_03_000006_add_patient_similarity_permissions.php`. |
| 100B-offset arithmetic | Re-deriving in each caller | `FinnGenEndpointGeneration::OMOP_COHORT_ID_OFFSET` (PHP) + matching `100000000000` literal in R | Phase 13.2-01 enshrined this pair. PRS dispatch inherits for free — when `cohort_definition_id` in params is already offset-keyed (FinnGen case), pass through; when it's a raw `app.cohort_definitions.id` (user cohort), pass through unchanged. **No new offset logic needed in Phase 17.** |

**Key insight:** Phase 17 is a thin new-capability layer over Phase 13.2 + Phase 14 infrastructure. Nearly every primitive exists; the work is composition.

## Runtime State Inventory

Phase 17 is **not** a rename/refactor phase (it ships net-new code paths). Runtime State Inventory omitted per RESEARCH protocol §2.5 skip condition.

## Common Pitfalls

### CRITICAL Pitfall — `vocab` schema not owned by `parthenon_migrator`

**What goes wrong:** Live verification on DEV `parthenon` reveals:
```
$ psql -Atc "SELECT nspname, pg_get_userbyid(nspowner) FROM pg_namespace WHERE nspname IN ('vocab','app','pancreas_results','finngen')"
app|parthenon_owner
finngen|parthenon_owner
pancreas_results|smudoshi
vocab|smudoshi                   ← NOT parthenon_owner

$ psql -Atc "SELECT has_schema_privilege('parthenon_migrator', 'vocab', 'CREATE'), has_schema_privilege('parthenon_migrator', 'vocab', 'USAGE')"
f|t
```
`parthenon_migrator` has USAGE on vocab but **no CREATE**. `./deploy.sh --db` runs `php artisan migrate` as `parthenon_migrator` (per `deploy.sh:466-475`) — so a plain `CREATE TABLE vocab.pgs_scores` will raise `ERROR: permission denied for schema vocab`.

**Why it happens:** The vocab schema pre-dates Parthenon's role-split cutover (Phase 13.1). It carries OMOP Athena-downloaded vocabularies and is owned by the human DBA (smudoshi). Phase 13.2's role-split codification addressed `app.cohort_definitions` ownership but did not touch vocab.

**Supporting evidence:** `backend/database/migrations/2026_04_03_100000_create_vocab_concept_tree_table.php:10-34` already acknowledges this gap — its `up()` is wrapped in try/catch with the comment: *"vocab schema is owned by smudoshi (superuser); parthenon_app only has SELECT. DDL must be run directly as smudoshi."* It silently skips if privilege is denied. `[VERIFIED: live psql + migration file]`

**How to avoid:** Three options in preference order; planner picks:

1. **(Recommended, minimal blast radius)** Ship a one-line superuser script in Plan 1 (Wave 0) that the operator runs manually before `./deploy.sh --db`:
   ```bash
   sudo -u postgres psql parthenon -c "GRANT CREATE ON SCHEMA vocab TO parthenon_migrator;"
   ```
   Capture as a deploy-log prerequisite. Mirrors how Phase 13.1 handled its 3 role grants (applied manually first, codified later).
2. **(Defer-later)** Plan a follow-on 13.3-grade role-grants-codification migration that runs as superuser via the same env-override mechanism `deploy.sh:470-475` uses (`DB_USERNAME=smudoshi` hook — but smudoshi is not in the deploy script's env pipeline today).
3. **(Workaround)** Put `pgs_scores` + `pgs_score_variants` in a NEW schema `pgs_catalog` owned by `parthenon_migrator`, instead of `vocab.*`. Violates D-07/D-08 (contract says `vocab.pgs_scores`); re-open with user first.

**Warning signs:** `php artisan migrate` aborts with `ERROR: permission denied for schema vocab` immediately after `CREATE TABLE vocab.pgs_scores` is issued. The migration is transactional, so nothing lands.

**Recommendation:** Plan 1 adds a pre-migration check in the migration's `up()`:
```php
$hasCreate = DB::selectOne("SELECT has_schema_privilege(?, 'vocab', 'CREATE') AS c", [DB::connection()->getConfig('username')])->c;
if (! $hasCreate) {
    throw new \RuntimeException(
        'Phase 17 migration requires CREATE on schema vocab. Run as superuser: '
        . '`sudo -u postgres psql parthenon -c "GRANT CREATE ON SCHEMA vocab TO parthenon_migrator;"` then re-run.'
    );
}
```

### Pitfall 2 — plink2 binary path

**What goes wrong:** Documentation / default `--plink2` option in `PrepareSourceVariantsCommand.php:65` says `/opt/plink2/plink2`. That's the **builder stage**. The Darkstar runtime image (`docker/r/Dockerfile:394`) copies it into `/opt/regenie/plink2`.

**Why:** The `COPY --from=plink2-builder /opt/plink2/plink2 /opt/regenie/plink2` line lands the binary next to regenie for HIGHSEC co-location, renaming the directory in the process.

**How to avoid:** R worker `.PLINK2_BIN <- "/opt/regenie/plink2"`. **Don't** copy the default option value from `PrepareSourceVariantsCommand`. `[VERIFIED: Dockerfile grep]`

### Pitfall 3 — `cohort_definition_id` arithmetic in R

**What goes wrong:** R's `integer` is 32-bit. `as.integer(100000000001)` silently returns `NA` with a warning (overflow). Any downstream SQL constructed with `sprintf("%d", as.integer(cohort_id))` then fails with `NA`.

**How to avoid:** Use `numeric`/double. Already established pattern in `cohort_ops.R:396-408`:
```r
OMOP_COHORT_ID_OFFSET <- 100000000000  # numeric, NOT 100000000000L
cohort_def_id <- as.numeric(params$cohort_definition_id)
# Format with "%.0f" (no scientific notation, no decimals):
sprintf("WHERE cohort_definition_id = %.0f", cohort_def_id)
```

**Warning signs:** SQL runs but returns 0 rows; plink2 --keep sees empty keep.tsv; `summary.subject_count = 0`.

### Pitfall 4 — `.sscore` column name capitalization

**What goes wrong:** plink2 writes `.sscore` with an `#IID` header (note the `#` prefix). R's `read.table` treats `#` as a comment by default and DROPS THE HEADER. Result: columns named V1..V5.

**How to avoid:** `read.table(path, header=TRUE, comment.char="")` — live pattern at `gwas_regenie.R:322`. Also normalize column names with `tolower(names(df))` because plink2 emits uppercase like `ALLELE_CT`, `NAMED_ALLELE_DOSAGE_SUM`, `SCORE1_AVG`, `SCORE1_SUM`.

**Default columns (no modifier):** `#IID`, `ALLELE_CT`, `NAMED_ALLELE_DOSAGE_SUM`, `SCORE1_AVG` `[CITED: biostars.org/p/9550731]`.
**With `cols=+scoresums`:** adds `SCORE1_SUM`. Use SCORE1_SUM as `raw_score` (D-09 semantics) — `SCORE1_AVG` is per-allele-averaged which obscures the score's interpretability across different variant counts.

### Pitfall 5 — `cohort` table write target schema

**What goes wrong:** The source envelope from `FinnGenSourceContextBuilder.php:64` sets `schemas$cohort = resultsSchema`. For PANCREAS this resolves to `pancreas_results`, NOT `pancreas`. Writing `--keep` subjects from `pancreas.cohort` returns 0 rows.

**Live evidence (verified on DEV 2026-04-17):**
```
$ psql parthenon -Atc "SELECT cohort_definition_id, count(*) FROM pancreas_results.cohort GROUP BY cohort_definition_id ORDER BY cohort_definition_id DESC LIMIT 5"
100000000001|135   ← Phase 13.2 FinnGen E4_DM2 smoke-gen (generation_id=1 + 100B offset)
9000222|208
969|135
249|237
248|237
```
The `100000000001` row proves Phase 13.2's D-01 offset is live AND that the R worker is writing to `pancreas_results.cohort`.

**How to avoid:** R worker reads `cohort_schema <- source_envelope$schemas$cohort %||% paste0(source_key, "_results")` (mirror `gwas_regenie.R:166`). Never hard-code `paste0(source_key, ".cohort")`.

### Pitfall 6 — Cross-schema FK reference to `vocab.pgs_scores` under RefreshDatabase

**What goes wrong:** Pest `RefreshDatabase` trait truncates tables in the default connection (`pgsql`). If `{source}_gwas_results.prs_subject_scores.score_id` FK-references `vocab.pgs_scores(score_id)`, and the test seeder inserts rows into `vocab.pgs_scores` first, a subsequent TRUNCATE on vocab (if the test harness touches it) fails with `cannot truncate a table referenced in a foreign key constraint`.

**Why:** PG14+ supports cross-schema FKs fine (verified live — Phase 13.1 uses them) but PHPUnit/Pest's RefreshDatabase truncates can surface in surprising order.

**How to avoid:** Phase 14 tests (`GwasDispatchTest.php:16-46`) work around this by manually seeding + not using `RefreshDatabase` on FinnGen tests. Phase 17 tests will hit the same constraint if they write to `prs_subject_scores`. **Recommendation:** Use the same manual-seed pattern (NOT `RefreshDatabase`) for PRS dispatch tests. For the ingestion command test, isolate to the default pgsql connection + factory-create `PgsScore` rows without FK concerns.

### Pitfall 7 — PGS Catalog file format variance (harmonized vs non-harmonized)

**What goes wrong:** The non-harmonized primary file (`{id}.txt.gz`) has minimal columns: `rsID, chr_name, chr_position, effect_allele, effect_weight, ...`. The harmonized file (`{id}_hmPOS_GRCh38.txt.gz`) adds 7 `hm_*` columns including `hm_chr`, `hm_pos`, `hm_rsID` which may differ from the author-reported values. Parser that assumes one shape breaks on the other.

**Source:** `[VERIFIED: pgscatalog.org/downloads/]` — harmonized files add `hm_source, hm_rsID, hm_chr, hm_pos, hm_inferOtherAllele, hm_match_chr, hm_match_pos`.

**How to avoid:** Always prefer the harmonized GRCh38 file (D-07 `harmonized_file_url`). Parser reads `hm_chr` / `hm_pos` / `hm_rsID` when present, falls back to `chr_name` / `chr_position` / `rsID`. Store BOTH `pos_grch37` and `pos_grch38` per D-08, letting plink2 resolve against the source's genome build at compute time.

### Pitfall 8 — PGS Catalog RSID coverage

**What goes wrong:** Not every variant has an rsID. plink2 `--score` uses the variant ID column to match against the PGEN's `.pvar` snp_id column. If the scoring file's rsID is missing but the PGEN only has rsIDs (not chr:pos keys), the variant is silently dropped.

**How to avoid:** At ingestion time, flag scores where `rsid IS NULL AND pos_grch38 IS NOT NULL` in the upsert logic, and emit a warning. At compute time, if the source's PGEN was built with chr:pos IDs (Phase 14 verify), construct the weights TSV's ID column as `chr:pos:ref:alt` instead of `rsid`. Planner should read `PrepareSourceVariantsCommand.php:494-508` to confirm the PGEN `--make-pgen` output's .pvar ID convention.

### Pitfall 9 — Darkstar bind-mount caching

**What goes wrong:** `darkstar/api/finngen/*.R` is bind-mounted at `/app/api/finngen/` per Phase 13.2-03 discovery. Editing `prs_compute.R` takes effect on **next job dispatch** (callr spawns a fresh R process). Editing `routes.R` requires `docker compose restart darkstar` because plumber's route table is loaded at startup.

**How to avoid:** After editing `routes.R`, always `docker compose restart darkstar`. Pattern is established in Phase 13.2's deploy log. Include this in Wave 4's deploy steps.

## Code Examples

Verified patterns gathered during this research:

### Stream-gunzip from an HTTPS fetch (PHP)
```php
// Source: backend/app/Services/Genomics/ClinVarSyncService.php:69-113
private function download(string $url): string {
    $tmp = tempnam(sys_get_temp_dir(), 'pgs_').'.txt.gz';
    $response = Http::timeout(600)->withOptions(['sink' => $tmp])->get($url);
    if ($response->failed()) {
        throw new \RuntimeException("download failed: HTTP {$response->status()}");
    }
    return $tmp;
}
private function parse(string $gzPath): iterable {
    $fh = @gzopen($gzPath, 'rb');
    try {
        while (($line = gzgets($fh)) !== false) {
            yield rtrim($line, "\r\n");
        }
    } finally { gzclose($fh); @unlink($gzPath); }
}
```

### plink2 argv invocation (R, HIGHSEC §10)
```r
# Source: darkstar/api/finngen/gwas_regenie.R:479-505
res <- processx::run(
  command = "/opt/regenie/plink2",
  args = c("--pfile", pgen_prefix, "--keep", keep_path,
           "--score", weights_path, "1", "2", "3", "header", "list-variants",
           "cols=+scoresums",
           "--out", out_prefix),
  echo_cmd = FALSE, stderr_to_stdout = TRUE,
  error_on_status = FALSE, timeout = 30 * 60)
if (res$status != 0L) {
  tail_lines <- utils::tail(strsplit(res$stdout %||% "", "\n")[[1]], 40)
  stop(sprintf("plink2 --score failed (exit %d): %s", res$status,
               paste(tail_lines, collapse = "\n")))
}
```

### Recharts BarChart + ReferenceArea for quintile bands (TypeScript)
```tsx
// Source: frontend/src/features/profiles/components/LabTrendChart.tsx:57-95 (ReferenceArea precedent)
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ResponsiveContainer } from 'recharts';

// Histogram data: [{ bin_mid: number, count: number }]
// Summary: { mean, median, q20, q40, q60, q80, iqr_q1, iqr_q3 }
const bands = [
  { x1: q_min, x2: q20,   opacity: 0.10, label: '1st quintile' },
  { x1: q20,   x2: q40,   opacity: 0.20, label: '2nd' },
  { x1: q40,   x2: q60,   opacity: 0.30, label: '3rd (median)' },
  { x1: q60,   x2: q80,   opacity: 0.20, label: '4th' },
  { x1: q80,   x2: q_max, opacity: 0.10, label: '5th' },
];
<ResponsiveContainer width="100%" height={280}>
  <BarChart data={histogram} margin={{ top: 16, right: 16, bottom: 32, left: 8 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-default)" />
    <XAxis dataKey="bin_mid" type="number" domain={[q_min, q_max]} scale="linear"
           stroke="var(--text-secondary)" fontSize={11} />
    <YAxis stroke="var(--text-secondary)" fontSize={11} />
    {bands.map((b, i) => (
      <ReferenceArea key={i} x1={b.x1} x2={b.x2} fill="var(--accent)" fillOpacity={b.opacity} />
    ))}
    <Bar dataKey="count" fill="var(--primary)" />
    <Tooltip formatter={((v: number) => [`${v}`, 'subjects']) as never} />
  </BarChart>
</ResponsiveContainer>
```
CLAUDE.md rule #11 (Recharts Tooltip formatter): always cast `as never`. `[VERIFIED: CLAUDE.md project gotchas]`

### FormRequest with `finngen.prs.compute` permission
```php
// Pattern: backend/app/Http/Requests/FinnGen/MaterializeWorkbenchCohortRequest.php:13-25
final class ComputePrsRequest extends FormRequest {
    public function authorize(): bool {
        return $this->user()?->can('finngen.prs.compute') ?? false;
    }
    public function rules(): array {
        return [
            'source_key' => 'required|string|max:64|regex:/^[A-Z][A-Z0-9_]*$/',
            'score_id' => 'required|string|max:32|regex:/^PGS\d{6,}$/',
            'cohort_definition_id' => 'nullable|integer|min:1',
            'overwrite_existing' => 'sometimes|boolean',
        ];
    }
}
```

### PGS Catalog REST metadata fetch
```php
// Source: [VERIFIED: https://www.pgscatalog.org/rest/score/PGS000001/ live fetch]
// Response shape (top-level keys):
//   id, name, ftp_scoring_file, ftp_harmonized_scoring_files,
//   publication: { doi, ... },
//   trait_reported, trait_efo: [{ id, ... }, ...],
//   variants_number, variants_genomebuild,
//   ancestry_distribution: {...},
//   license
$meta = Http::timeout(30)
    ->acceptJson()
    ->get("https://www.pgscatalog.org/rest/score/{$scoreId}/")
    ->throw()
    ->json();

$harmonizedGrch38 = $meta['ftp_harmonized_scoring_files']['GRCh38']['positions'] ?? null;
// e.g. "https://ftp.ebi.ac.uk/pub/databases/spot/pgs/scores/PGS000001/ScoringFiles/Harmonized/PGS000001_hmPOS_GRCh38.txt.gz"
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PRSice-2 | plink2 `--score` | ongoing (plink2 overtook PRSice for simple score calc) | Single binary; PGEN-native; no separate clumping step needed when consuming PGS Catalog pre-filtered weights. |
| FTP anonymous download | HTTPS (`https://ftp.ebi.ac.uk/...`) | 2024-ish | Same paths; https preferred. Both still work. `[CITED: pgscatalog.org/downloads]` |
| In-house score format | PGS Catalog Scoring File v2.0 | 2023 | Standardized `##` metadata header + canonical column names (rsID, chr_name, effect_allele, effect_weight). `[CITED: pgscatalog.org/downloads]` |
| GRCh37 default | GRCh38 harmonized files | 2024 | PGS Catalog generates `_hmPOS_GRCh38.txt.gz` for most scores. Prefer harmonized; store both positions. |

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Recharts version is 3.x (React 19 peer) | Standard Stack | Medium — if on Recharts 2.x, `ReferenceArea` API identical, but tooltip types may differ. Planner verifies with `cat frontend/package.json \| jq '.dependencies.recharts'`. |
| A2 | PGS Catalog REST API is stable and rate-limit-friendly for a single score fetch | Pattern 5 | Low — metadata fetch is one HTTP GET per score; PGS Catalog explicitly supports programmatic access. |
| A3 | `PDO` PostgreSQL driver has no streaming `COPY TO STDOUT` | Pattern 4 | Low — verified against PHP docs (`[CITED: php.net/manual/en/ref.pdo-pgsql.php]`) but planner may confirm with a 2-line spike. If wrong, fallback to raw `pg_copy_to` is still a valid path. |
| A4 | R's `DatabaseConnector::insertTable(bulkLoad=TRUE)` uses COPY FROM STDIN for PostgreSQL | R Worker Data Flow | Low — comment at `gwas_regenie.R:358-359` asserts this; mirrors the official DatabaseConnector 7.x docs. |
| A5 | `{source}_gwas_results.prs_subject_scores` is safe to add to `GwasSchemaProvisioner::provision()` without breaking existing Phase 14 summary_stats provisioning | Architecture | Low — provisioner uses `CREATE TABLE IF NOT EXISTS` so adding another IF NOT EXISTS block is additive. |
| A6 | Smoke test pick `PGS000001` (CAD ~77 variants) matches the REST API `variants_number` | Smoke test | None — verifiable via one REST call; planner confirms during Plan 5 (CHECKPOINT). |
| A7 | Windows PostgreSQL COPY + Laravel `chunkById` pattern works for 10M-row cohort exports | Pattern 4 | Medium — we don't today have any 10M-row cohort in DEV to stress-test. Cap-and-defer: test at 360-subject PANCREAS scale, document the 10M target as a future performance SLO. |

**6 of 7 assumptions are LOW risk**; A1 and A7 are MEDIUM. None are blocking.

## Open Questions

> **All 6 Open Questions RESOLVED by planner (2026-04-17) and locked in plans 17-01 through 17-07.**

1. **vocab schema ownership resolution path (see CRITICAL pitfall)** — **RESOLVED**
   - Plan 01 Task 1 ships migration `2026_04_25_000050_grant_vocab_create_to_migrator.php` which emits the GRANT and THROWS with remediation command if `parthenon_migrator` still lacks CREATE post-statement.
   - Plan 07 Task 1 is a `checkpoint:human-action` where the DBA runs `sudo -u postgres psql parthenon -c "GRANT CREATE ON SCHEMA vocab TO parthenon_migrator;"` before `./deploy.sh --db`.
   - Codification for non-DEV environments deferred to 17.1 (documented in 17-DEFERRED-ITEMS.md).

2. **Score picker UI style** — **RESOLVED**: plain `<select>` sorted by `trait_reported ASC, score_id ASC`. Implemented in Plan 04 Task 1 (backend sort) + Plan 05 Task 3 (ComputePrsModal picker). No autocomplete.

3. **PRS caching (Claude's Discretion)** — **RESOLVED**: NOT in Phase 17 scope. Deferred to Phase 17.1+ (documented in 17-DEFERRED-ITEMS.md). R worker computes directly against PGEN; plink2 streaming handles perf for current cohort sizes.

4. **CSV streaming chunk size** — **RESOLVED**: `chunkById(10000)` — hard-coded in Plan 04 Task 2 (CohortPrsController::download). Same order of magnitude as PG COPY buffer.

5. **Audit logging route** — **RESOLVED**: `finngen.runs` is the single audit trail. PrsDispatchService (Plan 03 Task 2) calls FinnGenRunService::create which persists the Run row with analysis_type='finngen.prs.compute' + full params JSONB. No separate `app.audit_log` writes.

6. **R testthat coverage** — **RESOLVED**: No R testthat for `prs_compute.R`. Plan 03 Task 2 Pest (PrsDispatchTest) covers the Laravel→Horizon→Run dispatch half; Plan 07 Task 4 end-to-end smoke-gen proves the R worker half. Matches Phase 13.2 precedent (cohort_ops.R also skipped testthat in favor of smoke).

## Environment Availability

Live-verified against DEV `beastmode:parthenon` (host PG17 via claude_dev) on 2026-04-17:

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| **plink2** | D-01 PRS compute | ✓ | alpha 6.33 (20260228) in Darkstar image at `/opt/regenie/plink2` | — |
| **PGS Catalog REST API** | D-16 metadata fetch | ✓ | — | File-header `##` comment parse |
| **PGS Catalog FTP (HTTPS)** | D-07 weights download | ✓ | — | none — required |
| **Darkstar container + finngen queue + Horizon** | D-10 dispatch | ✓ | — | — |
| **Phase 14 PANCREAS PGEN at `/opt/finngen-artifacts/variants/pancreas/genotypes.*`** | D-11 R worker input | ✓ (synthetic fixture from Phase 14-04) | 10k variants × 361 subjects | — |
| **`pancreas_results.cohort` with rows** | D-11 keep.tsv source | ✓ | Phase 13.2-05 landed `cohort_definition_id=100000000001` (135 subjects) + multiple user cohorts (249=237, 969=135, etc.) | — |
| **`parthenon_migrator` with CREATE on vocab schema** | D-07/D-08 migrations | ✗ | — | **Manual GRANT by superuser smudoshi — see CRITICAL pitfall** |
| **`parthenon_migrator` with CREATE on `{source}_gwas_results`** | D-09 migration (provisioner) | ✓ (verified — schema created by Phase 14 via AUTHORIZATION parthenon_migrator) | — | — |
| **Admin user `admin@acumenus.net` + password in memory ref** | Smoke test | ✓ | — | — |

**Missing dependencies with no fallback:** none (the vocab GRANT is a 1-command fix, not a blocker).

**Missing dependencies with fallback / prerequisite:**
- `parthenon_migrator` CREATE on `vocab` — requires one manual `sudo -u postgres psql` command before `./deploy.sh --db`. Plan 1 wave 0 task.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Pest 3.x over PHPUnit 11 (PHP backend); Vitest (frontend); R testthat (Darkstar — optional) |
| Config file | `backend/phpunit.xml`, `frontend/vitest.config.ts` |
| Quick run command | `docker compose exec -T php vendor/bin/pest tests/Feature/FinnGen/LoadPgsCatalogCommandTest.php --no-coverage` |
| Full suite command | `docker compose exec -T php vendor/bin/pest tests/Feature/FinnGen tests/Unit/FinnGen --no-coverage` |

### Phase Requirements → Test Map

| SC / Req | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|--------------|
| **SC-1 / GENOMICS-06** (ingestion idempotency) | Running `parthenon:load-pgs-catalog --score-id=PGS000001` twice results in exactly one row in vocab.pgs_scores and N rows in vocab.pgs_score_variants, with no duplicate-key errors | unit/feature | `pest tests/Feature/FinnGen/LoadPgsCatalogCommandTest.php -x` | ❌ Wave 0 |
| **SC-1 / GENOMICS-06** (HIGHSEC grants block) | The migration creates tables with explicit `GRANT SELECT ... TO parthenon_app` guarded by pg_roles existence check | feature | `pest tests/Feature/FinnGen/LoadPgsCatalogCommandTest.php --filter 'grants'` | ❌ Wave 0 |
| **SC-2 / GENOMICS-07** (dispatch 202 + run envelope shape) | `POST /endpoints/{name}/prs` with valid body returns 202 with `{ data: { run, cohort_definition_id, score_id, source_key, finngen_endpoint_generation_id? } }`; precondition failure returns 422 | feature | `pest tests/Feature/FinnGen/PrsDispatchTest.php -x` | ❌ Wave 0 |
| **SC-2 / GENOMICS-07** (R worker param passthrough) | `finngen_prs_compute_execute` receives score_id, cohort_definition_id, source_key and assembles weights.tsv + keep.tsv with correct FID/IID format | manual / smoke | `curl POST /api/v1/finngen/endpoints/E4_DM2/prs` → poll → psql verify | ❌ Wave 5 (CHECKPOINT) |
| **SC-2 / GENOMICS-07** (write-back to prs_subject_scores) | After a successful Darkstar run, `{source}_gwas_results.prs_subject_scores` contains one row per subject × score with plausible raw_score values | manual / smoke | `psql parthenon -c "SELECT COUNT(*), AVG(raw_score), STDDEV(raw_score) FROM pancreas_gwas_results.prs_subject_scores WHERE score_id='PGS000001'"` | ❌ Wave 5 |
| **SC-3 / GENOMICS-08** (histogram endpoint shape) | `GET /cohort-definitions/{id}/prs` returns aggregated histogram + quintiles + summary; zero raw per-subject rows leak | feature | `pest tests/Feature/FinnGen/CohortPrsEndpointsTest.php --filter 'histogram'` | ❌ Wave 0 |
| **SC-3 / GENOMICS-08** (CSV download streams) | `GET /cohort-definitions/{id}/prs/{scoreId}/download` returns `text/csv` with CSV header + N data rows for N subjects | feature | `pest tests/Feature/FinnGen/CohortPrsEndpointsTest.php --filter 'download'` | ❌ Wave 0 |
| **SC-3 / GENOMICS-08** (viz renders) | PrsDistributionPanel renders BarChart + 5 ReferenceArea overlays + summary-stat table | unit (Vitest) | `docker compose exec -T node sh -c "cd /app && npx vitest run src/features/cohort-definitions/components/__tests__/PrsDistributionPanel.test.tsx"` | ❌ Wave 0 |
| **SC-4 / GENOMICS-08** (empty state) | When no PRS row exists for (cohort, score), the drawer renders "Compute PRS" CTA + score picker populated from `GET /pgs-catalog/scores` | unit (Vitest) | `docker compose exec -T node sh -c "cd /app && npx vitest run src/features/cohort-definitions/components/__tests__/ComputePrsModal.test.tsx"` | ❌ Wave 0 |
| **invariant** (HIGHSEC §4.1 grants on new tables) | `GRANT USAGE + SELECT` on vocab.pgs_scores to parthenon_app verifiable via `has_table_privilege` | feature (migration) | `pest tests/Feature/FinnGen/LoadPgsCatalogCommandTest.php --filter 'grants'` (new test) | ❌ Wave 0 |
| **invariant** (no app.cohort_definitions.id > 100B) | Phase 13.2 T-13.2-S3 invariant still holds | psql | `psql -Atc "SELECT count(*) FROM app.cohort_definitions WHERE id > 100000000000"` → 0 | automated in Plan 5 |
| **invariant** (cross-schema FK to vocab.pgs_scores intact) | `prs_subject_scores.score_id` FK references `vocab.pgs_scores(score_id)` and ON DELETE CASCADE functions | feature | `pest ... --filter 'cross_schema_fk'` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `docker compose exec -T php vendor/bin/pest tests/Feature/FinnGen/{TheOneFileYouTouched}.php --no-coverage` (~10s)
- **Per wave merge:** `docker compose exec -T php vendor/bin/pest tests/Feature/FinnGen tests/Unit/FinnGen --no-coverage` + `docker compose exec -T node sh -c "cd /app && npx vitest run"` (~3m)
- **Phase gate:** Full Pest suite green, full Vitest green, Plan 5 CHECKPOINT curl smoke PGS000001 × PANCREAS × cohort_definition_id=249 (or generation-offset key) → DEPLOY-LOG with psql evidence of ≥1 row in pancreas_gwas_results.prs_subject_scores.

### Wave 0 Gaps

- [ ] `backend/tests/Feature/FinnGen/LoadPgsCatalogCommandTest.php` — covers GENOMICS-06 (idempotency + grants)
- [ ] `backend/tests/Feature/FinnGen/PrsDispatchTest.php` — covers GENOMICS-07 (202 shape + 422 preconditions); model on `GwasDispatchTest.php` (uses manual seed + fake RunService, avoids RefreshDatabase)
- [ ] `backend/tests/Feature/FinnGen/CohortPrsEndpointsTest.php` — covers GENOMICS-08 backend (histogram + CSV)
- [ ] `backend/tests/Unit/FinnGen/PgsCatalogFetcherTest.php` — unit tests on gunzip + parse (no network — use fixture gz)
- [ ] `backend/tests/Unit/FinnGen/PgsScoreIngesterTest.php` — upsert idempotency
- [ ] `frontend/src/features/cohort-definitions/components/__tests__/PrsDistributionPanel.test.tsx` — Recharts render + quintile overlay presence
- [ ] `frontend/src/features/cohort-definitions/components/__tests__/ComputePrsModal.test.tsx` — empty-state + picker population
- [ ] `backend/tests/Feature/FinnGen/PrsPermissionSeederTest.php` — verifies `finngen.prs.compute` exists and is assigned to 4 roles

No new framework install. Pest + Vitest + testthat all in place via Phase 14.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | yes | Sanctum bearer token on all 3 new routes (D-17); admin smoke-test uses `admin@acumenus.net` per memory ref |
| V3 Session Management | yes | Sanctum's 8h token expiration (HIGHSEC §1.2) unchanged |
| V4 Access Control | yes | `permission:finngen.prs.compute` on compute endpoint; `permission:finngen.prs.view` (bundled into `profiles.view`) on read endpoints |
| V5 Input Validation | yes | FormRequest with regex on `score_id` (`/^PGS\d{6,}$/`) and `source_key` (`/^[A-Z][A-Z0-9_]*$/`); integer rule on cohort_definition_id; no direct SQL string concat |
| V6 Cryptography | no | No new crypto — bearer tokens and PG cert already in place |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| **SQL injection via score_id in R worker** | Tampering | Validate regex `^PGS\d+$` BEFORE interpolation into `WHERE score_id = '%s'`. Also use `gsub("'", "''", score_id)` defensive-quote for SQL literals (same pattern as `cohort_ops.R` does for schema names). |
| **SSRF via PGS Catalog URL** | Tampering | Hardcode the FTP/REST URL templates. Users pass only `score_id` (regex-validated). No user-supplied URLs. |
| **Path traversal in export_folder** | Tampering | `export_folder` is constructed server-side as `/opt/finngen-artifacts/runs/{run_id}` where run_id is a ULID. Never accepts user input. |
| **Zip-bomb / gzip-bomb via PGS Catalog download** | Availability | Set `Http::timeout(600)` and monitor the `sink` tmp file size; reject if > 100MB (PGS files are 100KB-5MB in practice per §"PGS Catalog File Format"). |
| **PHI exposure in CSV download** | Info Disclosure | Download endpoint only returns (score_id, subject_id, raw_score). `subject_id` is the OMOP person_id which is a surrogate key; HIGHSEC §7 §4 classifies this as non-PHI in the research context. Require `auth:sanctum` + `permission:profiles.view` on the download endpoint as defense in depth. |
| **Privilege escalation via `parthenon.prs.compute` grant** | Elevation of Privilege | New permission is explicitly scoped — doesn't imply additional Darkstar admin capability. Viewer role explicitly excluded from `compute`; they still see the histogram via `profiles.view`. |
| **Cross-schema FK bypass via direct Eloquent writes** | Tampering | `PgsScore::$connection = 'omop'` (or 'pgsql' with `vocab` search-path segment); `PgsScoreVariant` similarly. Spatie $guarded defaults (no `$guarded = []` — HIGHSEC §3.1). |
| **Rate-abuse of PRS dispatch** | DoS | `throttle:10,1` on the dispatch endpoint (match generate route pattern at `routes/api.php:1088-1089`). |

## Sources

### Primary (HIGHSEC confidence)
- `.planning/phases/17-pgs-prs/17-CONTEXT.md` — all locked decisions [VERIFIED in session]
- `backend/app/Services/FinnGen/FinnGenSourceContextBuilder.php` lines 42-89 — confirms `schemas$cohort = resultsSchema` → `pancreas_results` [VERIFIED]
- `darkstar/api/finngen/gwas_regenie.R` lines 300-370 — live `DatabaseConnector::insertTable(bulkLoad=TRUE)` pattern [VERIFIED]
- `darkstar/api/finngen/cohort_ops.R` lines 387-554 — live 100B offset handling; `numeric` not `integer` [VERIFIED]
- `backend/app/Services/Genomics/ClinVarSyncService.php` lines 69-113 — live stream-gunzip pattern [VERIFIED]
- `backend/app/Http/Controllers/Api/V1/TextToSqlController.php` lines 347-382 — live StreamedResponse CSV pattern [VERIFIED]
- `backend/app/Console/Commands/ComputeReferenceRangesCommand.php` lines 80-106 — live `percentile_cont` [VERIFIED]
- `backend/database/migrations/2026_04_03_000006_add_patient_similarity_permissions.php` — Spatie permission seeding precedent [VERIFIED]
- `backend/database/migrations/2026_04_19_000200_create_finngen_gwas_covariate_sets_table.php` lines 61-78 — live HIGHSEC 3-tier grants block [VERIFIED]
- `backend/app/Models/App/FinnGenEndpointGeneration.php` line 40 — OMOP_COHORT_ID_OFFSET constant [VERIFIED]
- `docker/r/Dockerfile` lines 22-40, 393-395 — plink2 builder + runtime copy [VERIFIED]
- Live psql on DEV 2026-04-17: `pancreas_results.cohort` has `cohort_definition_id=100000000001 (135 subjects)` — confirms Phase 13.2 D-01 live; `vocab` owned by `smudoshi`, `parthenon_migrator` has USAGE but NOT CREATE [VERIFIED in session via psql]

### Secondary (MEDIUM)
- [PGS Catalog Download docs](https://www.pgscatalog.org/downloads/) — scoring file format v2.0, harmonized URL pattern, tab-delimited TSV format [CITED]
- [PGS Catalog REST API PGS000001 JSON](https://www.pgscatalog.org/rest/score/PGS000001/) — response schema: id, name, ftp_scoring_file, ftp_harmonized_scoring_files (GRCh37/GRCh38 > positions), publication.doi, trait_reported, trait_efo[], variants_number, variants_genomebuild, ancestry_distribution, license [VERIFIED via webfetch]
- [plink2 --score docs](https://www.cog-genomics.org/plink/2.0/score) — column args, `cols=+scoresums`, header modifier, missing-variant handling [CITED]
- [biostars 9550731](https://www.biostars.org/p/9550731) — .sscore default columns: #IID, ALLELE_CT, NAMED_ALLELE_DOSAGE_SUM, SCORE1_AVG [CITED]

### Tertiary (LOW, flagged in Assumptions)
- Recharts version assumption (A1) — planner verifies via package.json

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every library already in-project; every version pinned in a Dockerfile I read line-by-line
- Architecture patterns: HIGH — 4 live code precedents (gwas_regenie.R, ClinVarSyncService, TextToSqlController, LabTrendChart) read end-to-end
- Pitfalls: HIGH — 9 pitfalls, 8 verified via grep / file read / live psql; 1 (plink2 .sscore column case) cited from plink2 docs
- vocab schema CRITICAL pitfall: HIGH — live psql proved `parthenon_migrator` has no CREATE on vocab

**Research date:** 2026-04-17
**Valid until:** 2026-05-17 (30 days; infrastructure is stable — only upstream PGS Catalog response schema could drift)
