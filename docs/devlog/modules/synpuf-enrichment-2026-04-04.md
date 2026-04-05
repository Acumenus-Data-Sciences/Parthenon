# SynPUF 2.3M Enrichment — Complete

**Date:** 2026-04-04
**Status:** Complete
**Commits:** `1eb297148`, `a084b84f6`

## Summary

Completed all 7 stages of the SynPUF OMOP CDM v5.4 enrichment pipeline against the 2.3M beneficiary dataset on host PG17. The drug_era build required three iterations to get right, uncovering an OOM crash, a deadlock, a schema misconfiguration, and a critical performance bottleneck.

## Final Table Counts

| Table | Rows |
|-------|------|
| person | 2,326,856 |
| observation_period | 2,326,856 |
| visit_occurrence | 111,637,570 |
| drug_exposure | 127,637,474 |
| condition_era | 233,740,559 |
| drug_era | 126,415,877 |

## Issues Encountered & Fixed

### 1. OOM Crash (Machine Reboot)

**Root cause:** 16 parallel Python workers each spawned a PG backend. PG also spawned internal parallel workers per connection. With `work_mem = 1.5GB` per worker applied per-sort-node (6 sort/window ops in drug_era), actual memory usage was `16 × 1.5GB × 6 = ~144GB`, exceeding 128GB physical RAM + 8GB swap.

**Fix:**
- Reduced workers from 16 → 8
- Capped `work_mem` at 1GB per worker (8GB total budget)
- Added `SET max_parallel_workers_per_gather = 0` to each worker connection to prevent PG internal parallelism
- Memory stayed stable at ~103GB throughout subsequent runs

### 2. Deadlock (TRUNCATE Blocked by SELECT)

**Root cause:** The main connection ran `SELECT count(*) FROM synpuf.drug_era` in `_check_era_table()` inside a transaction. The parallel swap phase then tried `TRUNCATE synpuf.drug_era` on a separate connection, which requires `AccessExclusiveLock` — blocked by the main connection's lock. Python waited for the swap to complete; the swap waited for the main connection to release its lock. Classic deadlock.

**Fix:** Replaced main connection usage in check phase with a short-lived connection that closes immediately after checking, releasing all locks before parallel workers start.

### 3. VOCAB_SCHEMA Misconfiguration (0 Rows)

**Root cause:** `VOCAB_SCHEMA = "omop"` but vocabulary tables (concept_ancestor, concept) live in the `vocab` schema on host PG17. `omop.concept_ancestor` exists but has 0 rows. The drug_era CTE joins through concept_ancestor to resolve RxNorm Ingredients, so it silently produced 0 rows.

**Fix:** Changed `VOCAB_SCHEMA = "vocab"`. condition_era was unaffected because it doesn't use concept_ancestor.

### 4. 17-Hour Runtime (Two-Phase Materialization)

**Root cause:** The OHDSI drug_era algorithm has 8 nested CTEs that reference `ctePreDrugTarget` multiple times. When `ctePreDrugTarget` includes a join to `concept_ancestor` (78M rows), PostgreSQL re-evaluates that join for every CTE reference. With 138M drug_exposures fanning out through concept_ancestor, each chunk was processing billions of intermediate rows through 6+ sort passes. After 17 hours, temp files had plateaued at 51GB with no further progress.

**Fix:** Split into two phases:
- **Phase 1:** Materialize `ctePreDrugTarget` (the concept_ancestor join + date coalescing) into an indexed temp table per worker
- **Phase 2:** Run the era-building window functions against the materialized temp table

Result: drug_era build dropped from **17+ hours (never completed)** to **3 minutes 37 seconds**.

## Architecture: Parallel Era Build

```
Stage 7: Build Drug & Condition Eras
├── Check phase (short-lived connection, closes before build)
├── condition_era (8 parallel workers, hash-sharded by person_id % 8)
│   ├── Workers INSERT into UNLOGGED staging table
│   └── Atomic swap: TRUNCATE final + INSERT FROM staging + DROP staging
└── drug_era (8 parallel workers, two-phase per worker)
    ├── Phase 1: CREATE TEMP TABLE with concept_ancestor join + index
    ├── Phase 2: Era-building CTEs against temp table → staging table
    └── Atomic swap: same pattern as condition_era
```

## Key Takeaways

1. **Materialize expensive joins before window functions.** If a CTE is referenced multiple times and includes a large join, materialize it. PG's CTE optimization (inlining) can backfire when it means re-executing the join.

2. **`work_mem` is per-sort-node, not per-query.** A query with 6 sort/window operations can use 6× the configured `work_mem`. Multiply by parallel workers for true memory footprint.

3. **`max_parallel_workers_per_gather = 0` for worker pools.** When Python manages parallelism via ThreadPoolExecutor, disable PG's internal parallelism to prevent worker multiplication.

4. **Short-lived connections for check phases.** Any SELECT that precedes a parallel TRUNCATE must be on a connection that closes before the TRUNCATE starts.

5. **Vocabulary is in `vocab` schema, not `omop`.** This is documented in CLAUDE.md but the enrichment script predated the schema split.

## Next Steps

- [ ] Run Achilles characterization → `synpuf_results`
- [ ] Run DQD checks
- [ ] Verify source registration in `app.sources` / `app.source_daimons`
- [ ] Solr indexing of SynPUF clinical data
- [ ] UI smoke test: Data Sources, cohort queries, patient profiles
