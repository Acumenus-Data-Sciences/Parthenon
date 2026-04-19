---
phase: 17-pgs-prs
plan: 04
subsystem: genomics
tags: [backend, read-api, histogram, csv-streaming, aggregation, cohort, prs]
requirements: [GENOMICS-06, GENOMICS-07, GENOMICS-08]
requirements_addressed: [GENOMICS-08]
wave: 3
depends_on: [17-01, 17-03]

dependency_graph:
  requires:
    - "vocab.pgs_scores table (Plan 17-01 migration)"
    - "{source}_gwas_results.prs_subject_scores table (Plan 17-01 GwasSchemaProvisioner extension)"
    - "PgsScoreIngester / LoadPgsCatalogCommand (Plan 17-02) for production data"
    - "profiles.view Spatie permission (pre-existing, HIGHSEC §6)"
  provides:
    - "GET /api/v1/cohort-definitions/{id}/prs (aggregated histogram + quintiles + summary)"
    - "GET /api/v1/cohort-definitions/{id}/prs/{scoreId}/download (streaming CSV)"
    - "GET /api/v1/pgs-catalog/scores (picker list)"
    - "PrsAggregationService::aggregate (public API for reuse)"
  affects:
    - "frontend Plan 17-05 — PrsDistributionPanel, ComputePrsModal, usePrsScores hook"

tech_stack:
  added: []
  patterns:
    - "server-side aggregation with PG width_bucket + percentile_cont (17-RESEARCH §Pattern 3)"
    - "Laravel StreamedResponse + chunkById(10000) (17-RESEARCH §Pattern 4)"
    - "schema allow-listing via regex (HIGHSEC T-17-S1)"

key_files:
  created:
    - backend/app/Services/FinnGen/PrsAggregationService.php
    - backend/app/Http/Controllers/Api/V1/CohortPrsController.php
    - backend/app/Http/Controllers/Api/V1/PgsCatalogController.php
    - backend/app/Http/Requests/FinnGen/DownloadPrsRequest.php
    - backend/tests/Feature/FinnGen/CohortPrsEndpointsTest.php
  modified:
    - backend/routes/api.php

decisions:
  - id: D-04-01
    title: Default connection for cross-schema vocab reads
    summary: |
      Controller + service use `DB::connection()` (default) with fully-qualified
      `vocab.pgs_scores` and `{source}_gwas_results.prs_subject_scores` table
      references, instead of `DB::connection('omop')`. Under Pest this routes
      to pgsql_testing (targeting parthenon_testing); under prod this routes to
      pgsql (parthenon). The omop connection is skipped because the AppServiceProvider
      test harness only reconfigures pgsql_testing, leaving `omop` pointed at
      prod parthenon — which would mix DBs during tests.
  - id: D-04-02
    title: Source schema enumeration
    summary: |
      CohortDefinition has no source_id (sources attach via CohortGeneration).
      The controller enumerates every App\Models\App\Source row, derives
      `{lower(source_key)}_gwas_results` as candidate schema, filters to schemas
      that exist via information_schema.schemata, then UNIONs results across
      sources. Single source key regex allow-list guards all interpolation
      (^[A-Z][A-Z0-9_]*$).
  - id: D-04-03
    title: width_bucket + LEAST clamp in subquery
    summary: |
      PG's width_bucket returns bin=(bins+1) for values equal to the upper
      bound. Initial implementation used `GROUP BY LEAST(bin, :bins)` with
      SELECT `LEAST(bin, :bins)::int AS bin` — PG rejected this (42803) because
      the cast makes the two expressions non-matching. Fixed by pushing the
      LEAST clamp into the binned CTE so the outer SELECT GROUPs on a plain
      column reference. Functionally identical, PG-satisfying.

metrics:
  duration_minutes: 30
  completed_date: 2026-04-18
  tasks_completed: 2
  tests_added: 12
  tests_passing: 12
---

# Phase 17 Plan 04: Cohort PRS Read API Summary

**One-liner:** Backend read API for cohort PRS: aggregated histogram + quintiles + summary stats (server-side PG width_bucket + percentile_cont), streaming CSV download (chunkById + fputcsv), and the PGS Catalog score picker — 3 routes registered under `auth:sanctum + permission:profiles.view`, with 12 Pest tests passing and the T-17-S2 information-disclosure invariant asserted.

## Scope

This plan delivers the **backend half** of GENOMICS-08 Success Criteria 3 + 4:

- `GET /api/v1/cohort-definitions/{id}/prs?bins=N` — returns aggregated PRS distributions for every score that has been computed against this cohort across every registered source schema. Response contains NO per-subject raw scores. `bins` clamped to [10, 200] with default 50.
- `GET /api/v1/cohort-definitions/{id}/prs/{scoreId}/download` — streams `text/csv` per-subject scores via `StreamedResponse` + `chunkById(10000)`, capped memory-pressure for cohorts up to ~10M subjects.
- `GET /api/v1/pgs-catalog/scores` — returns the picker list sorted by `(trait_reported ASC NULLS LAST, score_id ASC)`.

The frontend (Plan 17-05) consumes these via TanStack Query hooks.

## Implementation

### PrsAggregationService (147 lines)

Two PG queries per (schema, score_id, cohort_definition_id) tuple:

1. **Summary + quintiles** — single query computing `AVG`, `STDDEV`, `MIN`, `MAX`, `percentile_cont(0.20/0.40/0.50/0.60/0.80/0.25/0.75) WITHIN GROUP (ORDER BY raw_score)`, and `COUNT(*)`. Returns null summary + empty histogram when `subject_count = 0`.
2. **Histogram** — CTE-based: `bounds` captures MIN/MAX, `binned` uses `LEAST(width_bucket(raw_score, bounds.lo, bounds.hi, :bins), :bins)::int AS bin` so the upper-tail edge folds into the last bin AND the GROUP BY sees a plain column. Returns `[{bin, bin_lo, bin_hi, n}]` sorted by bin.

Input guards: schema regex `^[a-z][a-z0-9_]*$`, score_id regex `^PGS\d{6,}$`. All parameters bound. Bins clamped `max(10, min(200, $bins))` at the service boundary.

### CohortPrsController (185 lines)

`index(Request $request, int $id)`:
- `findOrFail` on CohortDefinition.
- `candidateSchemas()` enumerates `App\Models\App\Source` → `{lower(source_key)}_gwas_results`, filters via `information_schema.schemata` (parameterized IN list).
- For each schema, SELECT DISTINCT score_id with rows for this cohort.
- For each score, look up metadata via `SELECT pgs_name, trait_reported FROM vocab.pgs_scores` and call `PrsAggregationService::aggregate`.
- Returns `{scores: [{score_id, pgs_name, trait_reported, scored_at, subject_count, summary, quintiles, histogram}]}`.

`download(DownloadPrsRequest $request, int $id, string $scoreId)`:
- FormRequest authorizes via `profiles.view`, validates scoreId regex.
- Finds the FIRST schema carrying rows for (cohort, score); aborts 404 if none.
- `response()->streamDownload(...)` with `fputcsv` + `chunkById(10000)` on subject_id.
- Headers: `Content-Type: text/csv`, `Content-Disposition: attachment; filename="prs-{scoreId}-cohort-{id}.csv"`, `Cache-Control: no-cache`.

### PgsCatalogController (47 lines)

Single query on default connection: `SELECT score_id, pgs_name, trait_reported, variants_number FROM vocab.pgs_scores ORDER BY trait_reported ASC NULLS LAST, score_id ASC`. Deliberately bypasses the `App\Models\App\PgsScore` Eloquent model (which binds to `omop` connection) so the picker keeps working under Pest where `omop` points at prod parthenon and default points at parthenon_testing.

### DownloadPrsRequest (39 lines)

Standard FormRequest: `authorize()` checks `profiles.view`; `rules()` applies the `^PGS\d{6,}$` regex on the merged `scoreId` route param. Belt-and-suspenders with the route-level `->where('scoreId', '^PGS\d{6,}$')` constraint.

### Route registration (backend/routes/api.php)

Inside the existing `auth:sanctum` middleware group, after cohort-definitions CRUD:

```php
Route::get('/cohort-definitions/{id}/prs', [CohortPrsController::class, 'index'])
    ->whereNumber('id')
    ->middleware(['permission:profiles.view', 'throttle:120,1']);
Route::get('/cohort-definitions/{id}/prs/{scoreId}/download', [CohortPrsController::class, 'download'])
    ->whereNumber('id')
    ->where('scoreId', '^PGS\d{6,}$')
    ->middleware(['permission:profiles.view', 'throttle:10,1']);
Route::get('/pgs-catalog/scores', [PgsCatalogController::class, 'scores'])
    ->middleware(['permission:profiles.view', 'throttle:120,1']);
```

Throttles match the threat register (D-04 T-17-S4 DoS mitigation: 10/min on the heavy CSV download, 120/min on lightweight reads).

## Sample Response Shape

### GET `/api/v1/cohort-definitions/777100/prs`

```json
{
  "scores": [
    {
      "score_id": "PGS000001",
      "pgs_name": "PRS77_BC",
      "trait_reported": "Breast Cancer",
      "scored_at": "2026-04-18T20:43:21+00:00",
      "subject_count": 100,
      "summary": {
        "mean": 0.032,
        "stddev": 0.981,
        "min": -2.543,
        "max": 2.712,
        "median": 0.018,
        "iqr_q1": -0.651,
        "iqr_q3": 0.712
      },
      "quintiles": { "q20": -0.854, "q40": -0.231, "q60": 0.290, "q80": 0.872 },
      "histogram": [
        { "bin": 1,  "bin_lo": -2.543, "bin_hi": -2.401, "n": 1 },
        { "bin": 6,  "bin_lo": -1.824, "bin_hi": -1.723, "n": 3 },
        { "bin": 25, "bin_lo": -0.052, "bin_hi":  0.049, "n": 8 }
      ]
    }
  ]
}
```

No `subject_id`, `raw_score`, or `subjects` keys anywhere — T-17-S2 Information-Disclosure assertion holds.

### GET `/api/v1/cohort-definitions/777100/prs/PGS000001/download` (first 3 lines)

```
score_id,subject_id,raw_score
PGS000001,900000,1.2394
PGS000001,900001,-0.5012
```

100 data rows (fixture size) after the header. Total: 101 lines.

### GET `/api/v1/pgs-catalog/scores`

```json
{
  "scores": [
    { "score_id": "PGS000001", "pgs_name": "PRS77_BC", "trait_reported": "Breast Cancer", "variants_number": 77 }
  ]
}
```

## Verification

### Pest (12/12 passing, 215 assertions, 12.0s)

```
✓ returns aggregated PRS envelope with histogram, quintiles, summary
✓ clamps ?bins=500 to 200 and ?bins=3 to 10
✓ does NOT expose per-subject raw scores in the index response (T-17-S2)
✓ returns empty scores array when no prs_subject_scores rows exist for this cohort
✓ returns 401 for unauthenticated GET /prs
✓ returns sorted picker list from vocab.pgs_scores
✓ returns 401 for unauthenticated GET /pgs-catalog/scores
✓ streams CSV download with header + row-per-subject
✓ returns 404 when no PRS rows exist for (cohort, score)
✓ returns 404 for missing cohort_definition_id
✓ returns 404 for invalid scoreId (route constraint)
✓ returns 401 for unauthenticated CSV download
```

### Route list

```
GET|HEAD  api/v1/cohort-definitions/{id}/prs                           Api\V1\CohortPrsController@index
GET|HEAD  api/v1/cohort-definitions/{id}/prs/{scoreId}/download        Api\V1\CohortPrsController@download
GET|HEAD  api/v1/pgs-catalog/scores                                    Api\V1\PgsCatalogController@scores
```

### Pint + PHPStan level 8

Both clean on the 4 production PHP files + test file.

## Threat Register Attestation

| Threat ID | Status | Evidence |
|-----------|--------|----------|
| T-17-S1 (Tampering, schema+score_id) | MITIGATED | Regex allow-lists in PrsAggregationService::aggregate and CohortPrsController::candidateSchemas; all other bindings parameterized. |
| T-17-S2 (Information Disclosure, histogram) | MITIGATED | Server-side aggregation only; Pest test asserts response contains no `subject_id` / `raw_score` / `subjects` keys. |
| T-17-S2b (Info Disclosure, CSV download) | ACCEPTED | Explicit opt-in; subject_id is a surrogate key; profiles.view gates. |
| T-17-S3 (EoP, read endpoints) | MITIGATED | permission:profiles.view on all 3 routes. |
| T-17-S4 (DoS, download) | MITIGATED | throttle:10,1 on download; chunkById(10000) caps memory; no full materialization. |
| T-17-S-IDOR (cohort_id in URL) | MITIGATED | CohortDefinition::findOrFail enforces Laravel default scope; no new IDOR surface. |

## Deviations from Plan

### Rule 1 — Bug

**[Rule 1] Fixed width_bucket GROUP BY grouping error**
- **Found during:** Task 1, first `pest` run
- **Issue:** Initial SQL `SELECT LEAST(bin, :bins)::int AS bin ... GROUP BY LEAST(bin, :bins)` raised `SQLSTATE[42803]: column "binned.bin" must appear in the GROUP BY clause or be used in an aggregate function` because the `::int` cast makes the SELECT expression structurally different from the GROUP BY expression in PG's grouping rules.
- **Fix:** Moved the `LEAST(..., :bins)::int` clamp into the `binned` CTE so the outer SELECT groups on a plain column reference. Same functional semantics; upper-tail edge still folds into the last bin.
- **Files modified:** `backend/app/Services/FinnGen/PrsAggregationService.php`
- **Commit:** 591036cd7 (shipped with Task 1)

### Rule 3 — Blocking infrastructure

**[Rule 3] Default connection instead of omop in tests**
- **Found during:** Task 1 first `pest` run
- **Issue:** Plan template said "DB::connection('omop')". In the Pest runtime, AppServiceProvider only reconfigures `pgsql_testing` — `omop` still points at prod parthenon (host PG17). The worktree's Wave 1 `prs_subject_scores` provisioning only landed in parthenon_testing (via migration + test seeder). Using `omop` caused `42P01 relation "pancreas_gwas_results.prs_subject_scores" does not exist` because prod parthenon only has `summary_stats` in that schema.
- **Fix:** Switched to `DB::connection()` (default) everywhere — routes to `pgsql_testing`→parthenon_testing under Pest and `pgsql`→parthenon under prod. All SQL uses fully-qualified schema names so search_path doesn't matter. Applied the same change to `PgsCatalogController` (bypassing the `PgsScore` model which is bound to `omop`).
- **Files modified:** `backend/app/Services/FinnGen/PrsAggregationService.php`, `backend/app/Http/Controllers/Api/V1/CohortPrsController.php`, `backend/app/Http/Controllers/Api/V1/PgsCatalogController.php`, `backend/tests/Feature/FinnGen/CohortPrsEndpointsTest.php`
- **Commit:** 591036cd7 (shipped with Task 1)

### Rule 2 — Missing plan context fix

**[Rule 2] CohortDefinition has no source_id column**
- **Found during:** Task 1 planning
- **Issue:** Plan template assumed `$cohort->source_id` but CohortDefinition migration carries no source_id column. Sources attach to cohorts via `CohortGeneration.source_id` (many-to-one with cohort; many-to-one with Source), so a cohort can have PRS runs on multiple sources simultaneously.
- **Fix:** Replaced single-source resolution with `candidateSchemas()` helper that enumerates every registered Source, derives `{lower(source_key)}_gwas_results`, filters via `information_schema.schemata`, and UNIONs results across all schemas. Matches the real-world invariant (1 cohort → N sources → N PRS runs).
- **Files modified:** `backend/app/Http/Controllers/Api/V1/CohortPrsController.php`
- **Commit:** 591036cd7

### Rule 1 — Test harness assertion

**[Rule 1] Content-Disposition header quoting**
- **Found during:** Task 2 test run
- **Issue:** Test asserted `toContain('filename="prs-...csv"')` (with double quotes as sent in the header). Laravel's Symfony response layer rewrites the filename with no surrounding quotes in the HeaderBag (`attachment; filename=prs-....csv`).
- **Fix:** Changed assertion to `toContain("prs-{scoreId}-cohort-{id}.csv")->toStartWith('attachment')` — same invariant, matches what the framework actually sends.
- **Files modified:** `backend/tests/Feature/FinnGen/CohortPrsEndpointsTest.php`
- **Commit:** 4dea87e23

## Commits

- **591036cd7** `feat(17-04): cohort PRS read API — aggregated histogram + picker (Task 1)` — 6 files changed, 669 insertions
- **4dea87e23** `test(17-04): 5 CSV-download Pest tests — streaming + 404 + auth (Task 2)` — 1 file changed, 53 insertions

Total: 7 files, 722 insertions. 12 tests green. Pint + PHPStan level 8 clean.

## Self-Check: PASSED

- Service file: FOUND `backend/app/Services/FinnGen/PrsAggregationService.php` (147 LOC)
- Controllers: FOUND `CohortPrsController.php` (185 LOC) and `PgsCatalogController.php` (47 LOC)
- FormRequest: FOUND `DownloadPrsRequest.php` (39 LOC)
- Test file: FOUND `CohortPrsEndpointsTest.php` (289 LOC, 12 tests)
- Routes: 3 registered (verified via `php artisan route:list`)
- Commits: 591036cd7 + 4dea87e23 FOUND in `git log`
- Pest: 12/12 green
- Pint: clean
- PHPStan level 8: No errors
