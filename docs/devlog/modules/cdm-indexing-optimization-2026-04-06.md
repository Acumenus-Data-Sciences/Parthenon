# CDM Indexing Optimization & Achilles Transaction Safety

**Date:** 2026-04-06
**Scope:** SynPUF CDM, Acumenus CDM, Achilles Engine
**Commit:** `4627b5889` (fix: wrap DELETE+INSERT in transaction)

## Problem

SynPUF's Data Explorer showed a failure for "patients with conditions" — the condition_occurrence record count was zero despite 302M rows and 1.97M distinct patients in the table.

### Root Cause

Achilles Analysis 400 (`COUNT(DISTINCT person_id) GROUP BY condition_concept_id`) timed out after 30 minutes on SynPUF's 302M-row `condition_occurrence` table. The Achilles engine executed the analysis SQL as two separate statements without a transaction:

1. `DELETE FROM achilles_results WHERE analysis_id = 400` — committed instantly
2. `INSERT INTO achilles_results SELECT ... COUNT(DISTINCT person_id) ...` — timed out at 30min

The DELETE had already committed, so the timeout left zero rows for analysis 400. The dashboard showed this as a failure.

Two underlying issues:
- **No composite index** on `(condition_concept_id, person_id)` — only separate single-column indexes, forcing a full sequential scan with hash aggregation across 302M rows
- **No transaction wrapping** in the Achilles engine — a failed INSERT couldn't roll back the preceding DELETE

## Fixes

### 1. Achilles Engine Transaction Safety (`AchillesEngineService.php`)

Wrapped the DELETE + INSERT execution in `BEGIN/COMMIT` with rollback on failure. Switched from `SET statement_timeout` (session-level, persists after error) to `SET LOCAL statement_timeout` (transaction-scoped, auto-clears).

```php
// Before: separate statements, no transaction
$conn->statement('SET statement_timeout = 1800000');
foreach ($statements as $statement) {
    $conn->statement($statement);
}
$conn->statement('SET statement_timeout = 0');

// After: transactional with rollback
$conn->beginTransaction();
try {
    $conn->statement('SET LOCAL statement_timeout = 1800000');
    foreach ($statements as $statement) {
        $conn->statement($statement);
    }
    $conn->commit();
} catch (\Throwable $txnError) {
    $conn->rollBack();
    throw $txnError;
}
```

### 2. SynPUF CDM Full Indexing (OHDSI Standard)

**Before:** 47 indexes — PKs + single-column indexes on person_id, concept_id, visit_occurrence_id.

**After:** 50 indexes — optimized composites replacing redundant singles.

| Index Pattern | Tables | Purpose |
|---|---|---|
| `(concept_id, person_id)` | condition, drug, procedure, measurement, observation, visit | Achilles per-concept person counts (index-only scan) |
| `(person_id, date)` | condition, drug, procedure, measurement, visit, observation_period | Patient timelines, cohort generation, temporal queries |
| `(concept_id)` | condition_era, drug_era, device_exposure, death(cause) | Era/domain concept lookups |
| `(person_id)` | condition_era, drug_era, payer_plan, death | Era/domain person lookups |
| `(person_id, cost_event_id)` | cost | Cost analysis joins |

**15 redundant single-column indexes dropped** (covered by composite leading columns), freeing ~25GB of index space.

### 3. Acumenus CDM Gap Fill

Acumenus already had good 3-column composites `(concept_id, person_id, date DESC)` on the major clinical tables. Gaps filled:

| Table | New Index | Purpose |
|---|---|---|
| condition_era | `(condition_concept_id)` | Achilles Analysis 1000 |
| drug_era | `(drug_concept_id)` | Achilles Analysis 900 |
| visit_occurrence | `(visit_concept_id, person_id)` | Achilles Analysis 200 |
| device_exposure | `(person_id)`, `(device_concept_id)` | Achilles Analysis 2100 |
| observation_period | `(person_id, start_date)` composite | Cohort entry/exit lookups |
| note | `(note_type_concept_id)` | Achilles Analysis 2200 |
| death | `(person_id)`, `(cause_concept_id)` | Achilles Analysis 500/501 |
| payer_plan_period | `(person_id)` | Achilles Analysis 1600 |

1 redundant index dropped, `ANALYZE` run on all tables in both schemas.

## Impact

- **Analysis 400 now completes** — 7,828 condition concept rows populated for SynPUF
- **Future Achilles timeouts are safe** — failed analyses preserve prior results instead of leaving empty tables
- **All Achilles analyses benefit** from composite indexes — `COUNT(DISTINCT person_id)` queries on drug (700), procedure (600), measurement (1800) no longer risk the same timeout
- **Cohort generation faster** — `(person_id, date)` composites support the most common cohort SQL patterns (observation period lookups, event date filters)
- **~25GB index space reclaimed** on SynPUF from dropping redundant single-column indexes

## Verification

```sql
-- Confirm Analysis 400 populated
SELECT COUNT(*) FROM synpuf_results.achilles_results WHERE analysis_id = 400;
-- 7828 rows

-- Confirm no missing record count analyses
SELECT analysis_id, CASE WHEN COUNT(*) > 0 THEN 'present' ELSE 'MISSING' END
FROM synpuf_results.achilles_results
WHERE analysis_id IN (0, 101, 200, 400, 500, 600, 700, 800, 900, 1000, 1800)
GROUP BY analysis_id;
-- All present
```

## Lessons

1. **Always wrap DELETE + INSERT in a transaction** when the INSERT depends on the DELETE. This is especially critical for long-running analytical queries.
2. **`SET LOCAL` > `SET`** for statement timeouts inside transactions — it's automatically scoped and doesn't leak if the transaction fails.
3. **Composite indexes on `(concept_id, person_id)` are essential for OHDSI** — every domain's "persons with at least one X" analysis uses this pattern. Without them, `COUNT(DISTINCT person_id)` on 100M+ row tables will timeout.
4. **Concurrent index builds on the same table deadlock** in PostgreSQL — build one index per table at a time, or accept retries.
