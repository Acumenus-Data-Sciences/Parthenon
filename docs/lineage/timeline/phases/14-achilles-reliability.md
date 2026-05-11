# Phase 14 — Achilles Engine Reliability Hardening

**Date:** 2026-03-24
**Branch:** main

---

## Summary

After hours of repeated Achilles characterization failures on the SynPUF dataset (source 47, OHDSI Acumenus CDM), root-caused and permanently fixed four compounding bugs that made every run fragile. The measurement table's size (~100M+ rows) exposed timing and retry issues that smaller datasets (Eunomia) never triggered.

---

## Root Causes Identified

### Bug 1: Non-resumable retries (the killer)
`RunAchillesJob::handle()` used `AchillesRun::create()` to insert the run record. On retry after a timeout, the same `run_id` UUID hit a unique constraint violation — instant crash. **The job could never recover from a timeout.**

### Bug 2: Job timeout too short
`$timeout = 3600` (1 hour), but analysis 1811 (measurement records by concept by year-month) alone took **116 minutes** on SynPUF's measurement table. The job timed out mid-query, then Bug 1 prevented retry.

### Bug 3: No analysis-level resume
When a run completed 111/127 analyses then died, the retry re-ran all 127 from scratch. **175 minutes of work thrown away** on each retry attempt.

### Bug 4: Zombie "running" status
Failed runs stayed in `status=running` forever because `RunAchillesJob` had no `failed()` method. The UI showed perpetually "running" jobs with no way to recover.

---

## What Was Fixed

### 1. RunAchillesJob — Retry Resilience (`RunAchillesJob.php`)

| Before | After |
|--------|-------|
| `AchillesRun::create()` — crashes on retry | `AchillesRun::updateOrCreate()` — idempotent |
| No `failed()` method — zombies forever | `failed()` marks run as failed with timestamp |
| `$timeout = 3600` (1 hour) | `$timeout = 10800` (3 hours) |
| `$tries = 2` | `$tries = 3` with `$backoff = 30` |

Note: `status` remains excluded from `$fillable` per HIGHSEC 3.1 — set via explicit `update()` calls only.

### 2. AchillesEngineService — Resume Capability (`AchillesEngineService.php`)

- On retry, queries `achilles_run_steps` for already-completed analyses and **skips them**
- Only inserts step rows for analyses that don't have rows yet (idempotent)
- Resets any steps stuck in `running` status from a prior crashed attempt back to `pending`
- Added `SET LOCAL statement_timeout = 1800000` (30 min) per-statement timeout to prevent single queries from blocking the entire run forever

### 3. SQL Optimization — Year-Month Analyses

Replaced `EXTRACT(YEAR FROM date) * 100 + EXTRACT(MONTH FROM date)` with `date_trunc('month', date)` across 5 analysis files. The old pattern forced per-row arithmetic on every row; `date_trunc` is a single function call that PostgreSQL can optimize with HashAggregate on fewer distinct values.

| Analysis | File | Table |
|----------|------|-------|
| 1811 | `Measurement/Analysis1811.php` | measurement (concept x month) |
| 1805 | `Measurement/Analysis1805.php` | measurement (month) |
| 811 | `Observation/Analysis811.php` | observation (concept x month) |
| 802 | `Observation/Analysis802.php` | observation (month) |
| 2003 | `DataDensity/Analysis2003.php` | 6-table UNION ALL (all domains) |

### 4. Cleanup

- Marked 4 zombie runs (IDs 3-6) as `failed` with timestamps
- Truncated `failed_jobs` queue
- Launched fresh run `e471a8b8` — verified progressing at 21/127 with 0 failures within 60 seconds

---

## Architecture Decision: Resume vs. Restart

Chose **resume** over restart because:
- SynPUF measurement analyses take 2+ hours total — restarting from scratch wastes all prior work
- The `achilles_run_steps` table already tracks per-analysis status — resume is a simple `WHERE status = 'completed'` query
- No data integrity risk: each analysis does `DELETE WHERE analysis_id = X` then `INSERT`, so re-running a completed analysis is safe but wasteful

---

## Files Changed

```
backend/app/Jobs/Achilles/RunAchillesJob.php
backend/app/Services/Achilles/AchillesEngineService.php
backend/app/Services/Achilles/Analyses/Measurement/Analysis1811.php
backend/app/Services/Achilles/Analyses/Measurement/Analysis1805.php
backend/app/Services/Achilles/Analyses/Observation/Analysis811.php
backend/app/Services/Achilles/Analyses/Observation/Analysis802.php
backend/app/Services/Achilles/Analyses/DataDensity/Analysis2003.php
```

---

## Lessons Learned

1. **Always implement `failed()` on long-running queue jobs.** Without it, there's no cleanup path and runs become zombies.
2. **`create()` in a retryable job is a time bomb.** Any job that might retry must use `updateOrCreate()` or `firstOrCreate()` for its tracking records.
3. **Per-statement timeouts are essential** when a single SQL query can run for hours. The job-level timeout kills the PHP process but doesn't cancel the PostgreSQL query — it keeps running on the DB side.
4. **Resume > restart** for any batch job over 10 minutes. The marginal cost of tracking completion state is trivial compared to re-running hours of work.
5. **`date_trunc` > `EXTRACT` arithmetic** for year-month grouping in PostgreSQL. Fewer function calls per row, better HashAggregate performance, and cleaner SQL.
