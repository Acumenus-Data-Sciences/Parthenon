# DQD Fix & SynPUF Enrichment v2 — 2026-04-06

## Summary

Fixed DQD (Data Quality Dashboard) failures on SynPUF CDM and extended the enrichment script from 7 to 10 stages to address 13 DQD check failures. Implemented CTAS+atomic swap optimization that reduced per-table processing from 107+ minutes (never finished) to 15-31 minutes.

## DQD Bug Fix

**Root cause:** `RunDqdJob::handle()` was missing `SourceContext::forSource($this->source)`. Queue workers don't have HTTP middleware, so the `SourceAware` trait couldn't resolve database connections. Every single DQD check (170/170) failed with "Source context required but not set."

**Fix:** Added `SourceContext::forSource()` at top of `handle()`, matching the pattern in `RunAchillesJob`.

**Also fixed:** `JobController::getDqdJobs()` compared against the full check registry (170) even for category-specific runs. A completeness-only run (77 checks) showed as permanently "running" at 45%. Fixed by using category-aware expected counts for completed runs.

## SynPUF Enrichment v2 (10 Stages)

### New/Modified Stages

| Stage | Change | Rows | Time |
|-------|--------|------|------|
| 3 | Fixed race mapping: 8551 (Gender domain) → 0 (OMOP convention) | 152K | 1s |
| 6 | Extended to 6 tables + CTAS optimization (see below) | 777M | ~40m (sans SET LOGGED) |
| 8 | **NEW** — Derive drug_exposure_end_date from days_supply | 128M | 6m (parallel) |
| 9 | **NEW** — NULL out non-positive quantity/days_supply | 7M | 18m |
| 10 | **NEW** — Link drug_exposure to visits by date overlap | 9.2M | 4m |

### CTAS+Atomic Swap Optimization

The original approach used in-place `UPDATE ... SET concept_col = ... FROM best_mapping WHERE ...` on tables with 100M-303M rows. This was extremely slow due to:
- Full table scan per UPDATE (no useful index on concept_col)
- Row-level locks + WAL generation for each modified row
- Random I/O pattern (updating scattered rows in a 303M-row heap)

**New approach:** Single-pass `CREATE UNLOGGED TABLE staging AS SELECT ... LEFT JOIN mapping LEFT JOIN vocab` that applies both remap AND invalid-concept cleanup in one sequential scan. Then rebuild indexes on the staging table and atomic rename swap.

| Table | Rows | CTAS Time | Old UPDATE |
|-------|------|-----------|------------|
| condition_occurrence | 303M | 31m | 107m+ (never finished) |
| procedure_occurrence | 231M | 21-25m | 107m+ (never finished) |
| drug_exposure | 127M | 14-15m | deadlocked |
| measurement | 70M | 6-8m | — |
| observation | 39M | 3-6m | — |
| device_exposure | 5M | 22-28s | — |

**SET LOGGED skipped** — For a synthetic research dataset with an idempotent enrichment script, the ~18 min per large table for `ALTER TABLE SET LOGGED` is unnecessary. Tables remain UNLOGGED; re-run the enrichment script after any crash.

### DQD Results

| Metric | Before | After |
|--------|--------|-------|
| Total checks | 170 | 170 |
| Passed | 157 | 164 |
| Failed | 13 | 6 |
| Pass rate | 92.4% | 96.5% |

#### 7 Checks Fixed
- drug_exposure_end_date 100% null → derived from days_supply (Stage 8)
- drug provider_id 87% null → backfilled from matched visit (Stage 10)
- drug quantity non-positive 4.2% → NULLed (Stage 9)
- drug days_supply non-positive 2.1% → NULLed (Stage 9)
- race domain mismatch 6.5% → fixed 8551→0 (Stage 3)
- condition non-standard 7.7% → remapped to standard (Stage 6)
- device invalid concepts 1.8% → remapped + cleaned (Stage 6)

#### 6 Remaining (Expected)
- measurement value_as_number 100% — CMS claims have no lab values (inherent)
- measurement unit_concept_id 100% — CMS claims have no lab units (inherent)
- drug visit_occurrence_id 80% — most drugs outside visit date ranges
- measurement concept = 0 (27%) — invalid concepts zeroed per OMOP convention
- procedure concept = 0 (35%) — same
- observation concept = 0 (6%) — same

## Files Changed

- `backend/app/Jobs/Dqd/RunDqdJob.php` — Added SourceContext::forSource()
- `backend/app/Http/Controllers/Api/V1/JobController.php` — Category-aware DQD job tracking
- `scripts/synpuf_enrichment.py` — Extended 7→10 stages, CTAS optimization

## Key Lessons

1. **Queue jobs need manual SourceContext** — HTTP middleware doesn't apply to Horizon workers
2. **CTAS+swap >> in-place UPDATE** for large-table transformations (3-5x faster)
3. **Skip SET LOGGED for dev/research data** — saves ~18 min per 300M-row table
4. **Never run concurrent stages on the same table** — causes deadlocks
5. **Concept 8551 is Gender, not Race** — always verify concept domain before mapping
