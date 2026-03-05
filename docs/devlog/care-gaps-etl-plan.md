# Care Gaps — Star Schema & Nightly ETL Architecture Plan

**Date:** 2026-03-04
**Context:** 1M Synthea patients in `omop` schema, 10 seeded bundles (expandable to 45), 40+ quality measures
**Status:** Architecture decision + implementation plan (not yet built)

---

## 1. The Core Question

> *"Do we need to develop and run both a star schema and nightly ETL to pre-populate cohorts that have the 45 care bundles applicable and determine what care gaps are currently open or closed?"*

**Short answer:** No to a full OLAP star schema. Yes to a materialized compliance layer with nightly ETL.

The distinction matters. A Kimball-style star schema with slowly-changing dimensions, conformed dimensions, and surrogate keys is over-engineering for this use case — we don't need historical snapshots of dimension attribute changes, and we already have a well-normalized source of truth (OMOP CDM). What we **do** need is a pre-computed, query-ready compliance cache that converts expensive multi-thousand-query PHP loops into fast SQL reads.

---

## 2. Why the Current Architecture Breaks at 1M Scale

The current `CareGapService.php` implements this flow:

```
findEligiblePatients() → returns list<int> (PHP array)
  ↓
foreach $chunk of 1000 patients:
  evaluateMeasure() → SELECT DISTINCT person_id FROM cdm_table
```

### Problem 1 — PHP Memory Loading

`findEligiblePatients()` returns **all eligible patient IDs as a PHP array**. For a high-prevalence condition:

| Bundle | Estimated Eligible (1M pts) | PHP Array Size |
|--------|----------------------------|----------------|
| HTN    | ~300K patients              | ~2.4 MB        |
| DM     | ~120K patients              | ~1.0 MB        |
| HLD    | ~250K patients              | ~2.0 MB        |
| CAD    | ~80K patients               | ~0.6 MB        |

Memory is not the critical problem — `1000 * int` is trivial. The critical problem is **what happens next**.

### Problem 2 — Query Explosion

For each bundle, `evaluateMeasure()` issues:
```
ceil(eligible_patients / 1000) queries per measure
```

For HTN with 300K patients, 6 measures:
```
300 chunks × 6 measures = 1,800 SQL queries
```

For all 10 bundles in a single run:
```
~10,000–15,000 SQL queries, sequential, on a single DB connection
```

At 50ms average per query → **8–12 minutes wall clock** for a full evaluation run.

At 45 bundles → **~50 minutes**. Completely impractical for nightly or on-demand use.

### Problem 3 — Results Are Aggregate Only

`care_gap_evaluations.result_json` stores population-level counts (met/not_met/excluded per measure). There is **no per-patient compliance record** anywhere in the current schema. This means:

- Cannot answer "which specific patients have open DM-01 gaps?"
- Cannot generate patient-level care gap lists for clinical outreach
- Cannot track individual patient gap closure over time
- Cannot compute patient risk scores (current `computeRiskDistribution` approximates based on overall compliance — it doesn't know which patients are in which risk tier)

### Problem 4 — DATEADD Dialect Bug

In `evaluateMeasure()`:
```php
AND t.{$dateColumn} >= DATEADD(CURRENT_DATE, -{$lookbackDays})
```

`DATEADD(CURRENT_DATE, -365)` is **not valid SQL in any dialect**. The correct PostgreSQL syntax is `CURRENT_DATE - INTERVAL '365 days'`. The SqlRendererService's `DATEADD` translation assumes `DATEADD(interval_unit, count, date)` signature (MSSQL convention). This query is currently broken — it would silently return zero matches on PostgreSQL because the expression doesn't parse, or the renderer emits invalid SQL.

---

## 3. Proposed Architecture — Materialized Compliance Layer

We need three new tables in the **parthenon app database** (not in the CDM schema):

### 3.1 Table: `care_gap_patient_bundles`

Pre-computes which patients belong to each bundle's denominator population.

```sql
CREATE TABLE care_gap_patient_bundles (
    id              BIGSERIAL PRIMARY KEY,
    source_id       INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    bundle_id       INTEGER NOT NULL REFERENCES condition_bundles(id) ON DELETE CASCADE,
    person_id       BIGINT NOT NULL,
    enrolled_at     DATE NOT NULL,      -- date of first qualifying condition occurrence
    refreshed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (source_id, bundle_id, person_id)
);

CREATE INDEX idx_cgpb_source_bundle    ON care_gap_patient_bundles (source_id, bundle_id);
CREATE INDEX idx_cgpb_source_person    ON care_gap_patient_bundles (source_id, person_id);
CREATE INDEX idx_cgpb_enrolled_at      ON care_gap_patient_bundles (source_id, bundle_id, enrolled_at DESC);
```

**Row count estimate:** 1M patients × average 2.3 bundles/patient = ~2.3M rows. Trivial.

### 3.2 Table: `care_gap_patient_measures`

Pre-computes open/closed/excluded status **per patient × measure**, with the date of last service and calculated due date.

```sql
CREATE TABLE care_gap_patient_measures (
    id                  BIGSERIAL PRIMARY KEY,
    source_id           INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    bundle_id           INTEGER NOT NULL REFERENCES condition_bundles(id) ON DELETE CASCADE,
    measure_id          INTEGER NOT NULL REFERENCES quality_measures(id) ON DELETE CASCADE,
    person_id           BIGINT NOT NULL,
    status              VARCHAR(20) NOT NULL DEFAULT 'open', -- 'met', 'open', 'excluded'
    last_service_date   DATE NULL,           -- most recent qualifying event date
    due_date            DATE NULL,           -- next due date (last_service_date + frequency)
    days_overdue        INTEGER NULL,        -- NULL if not overdue, positive if overdue
    is_deduplicated     BOOLEAN NOT NULL DEFAULT FALSE,
    refreshed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (source_id, measure_id, person_id)
);

CREATE INDEX idx_cgpm_source_bundle_measure ON care_gap_patient_measures (source_id, bundle_id, measure_id);
CREATE INDEX idx_cgpm_source_bundle_status  ON care_gap_patient_measures (source_id, bundle_id, status);
CREATE INDEX idx_cgpm_source_person         ON care_gap_patient_measures (source_id, person_id);
CREATE INDEX idx_cgpm_open_gaps             ON care_gap_patient_measures (source_id, bundle_id, due_date) WHERE status = 'open';
```

**Row count estimate:** 2.3M enrolled × 4 measures/enrollment = ~9.2M rows. Still manageable for PostgreSQL — this is a routine operational table.

### 3.3 Table: `care_gap_snapshots`

Replaces `care_gap_evaluations.result_json` for the aggregate dashboard view. One row per (bundle × source × snapshot date). Keeps historical trend data.

```sql
CREATE TABLE care_gap_snapshots (
    id                      BIGSERIAL PRIMARY KEY,
    source_id               INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    bundle_id               INTEGER NOT NULL REFERENCES condition_bundles(id) ON DELETE CASCADE,
    cohort_definition_id    INTEGER NULL REFERENCES cohort_definitions(id) ON DELETE SET NULL,
    snapshot_date           DATE NOT NULL,
    person_count            INTEGER NOT NULL DEFAULT 0,
    measures_met            INTEGER NOT NULL DEFAULT 0,
    measures_open           INTEGER NOT NULL DEFAULT 0,
    measures_excluded       INTEGER NOT NULL DEFAULT 0,
    compliance_pct          NUMERIC(5,2) NOT NULL DEFAULT 0,
    risk_high_count         INTEGER NOT NULL DEFAULT 0,
    risk_medium_count       INTEGER NOT NULL DEFAULT 0,
    risk_low_count          INTEGER NOT NULL DEFAULT 0,
    etl_duration_ms         INTEGER NULL,
    computed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (source_id, bundle_id, snapshot_date, cohort_definition_id)
);

CREATE INDEX idx_cgs_source_bundle_date ON care_gap_snapshots (source_id, bundle_id, snapshot_date DESC);
```

**Retention policy:** Keep 2 years of daily snapshots = 730 rows per bundle per source = 7,300 rows for 10 bundles. Negligible.

---

## 4. The ETL — Pure SQL, No PHP Memory

### 4.1 Architecture Overview

```
Scheduler (daily 02:00 AM)
  └── CareGapNightlyRefreshJob
        ├── Per source × bundle:
        │     Step A: Refresh patient_bundles (1 UPSERT query)
        │     Step B: Per measure: Refresh patient_measures (1-2 queries)
        │     Step C: Aggregate snapshot (1 query)
        └── Cleanup: Expire old patient_measures for removed patients
```

Total queries for 10 bundles × 1 source × 40 measures: **~50 queries**
vs. current: **~15,000 queries**

### 4.2 Step A — Patient Bundle Enrollment (Pure SQL)

```sql
-- Upsert all patients with qualifying conditions into care_gap_patient_bundles
-- Runs as a single INSERT ... SELECT on the CDM
INSERT INTO care_gap_patient_bundles
    (source_id, bundle_id, person_id, enrolled_at, refreshed_at)
SELECT
    :source_id,
    :bundle_id,
    co.person_id,
    MIN(co.condition_start_date)   AS enrolled_at,
    NOW()
FROM {cdmSchema}.condition_occurrence co
WHERE co.condition_concept_id IN (:concept_ids)
GROUP BY co.person_id
ON CONFLICT (source_id, bundle_id, person_id) DO UPDATE SET
    enrolled_at  = LEAST(EXCLUDED.enrolled_at, care_gap_patient_bundles.enrolled_at),
    refreshed_at = NOW();
```

**For DM (120K eligible) → single query, executes in <500ms with proper indexes.**

With `CREATE INDEX idx_co_concept_person_date ON omop.condition_occurrence (condition_concept_id, person_id, condition_start_date)` → <200ms.

### 4.3 Step B — Measure Compliance Per Patient (Pure SQL)

For **measurement domain** measures (HbA1c, BP, eGFR, lipid panel):

```sql
INSERT INTO care_gap_patient_measures
    (source_id, bundle_id, measure_id, person_id, status, last_service_date,
     due_date, days_overdue, refreshed_at)
SELECT
    cgpb.source_id,
    cgpb.bundle_id,
    :measure_id,
    cgpb.person_id,
    CASE WHEN m.person_id IS NOT NULL THEN 'met' ELSE 'open' END  AS status,
    MAX(m.measurement_date)                                         AS last_service_date,
    CASE WHEN m.person_id IS NOT NULL
         THEN MAX(m.measurement_date) + INTERVAL ':lookback_days days'
         ELSE NULL END                                              AS due_date,
    CASE WHEN m.person_id IS NULL
         THEN NULL  -- will be computed in aggregate step
         ELSE 0 END                                                 AS days_overdue,
    NOW()
FROM care_gap_patient_bundles cgpb
LEFT JOIN {cdmSchema}.measurement m
    ON  m.person_id = cgpb.person_id
    AND m.measurement_concept_id IN (:concept_ids)
    AND m.measurement_date >= CURRENT_DATE - INTERVAL ':lookback_days days'
WHERE cgpb.source_id = :source_id
  AND cgpb.bundle_id = :bundle_id
GROUP BY cgpb.source_id, cgpb.bundle_id, cgpb.person_id,
         CASE WHEN m.person_id IS NOT NULL THEN 'met' ELSE 'open' END,
         m.person_id
ON CONFLICT (source_id, measure_id, person_id) DO UPDATE SET
    status            = EXCLUDED.status,
    last_service_date = EXCLUDED.last_service_date,
    due_date          = EXCLUDED.due_date,
    days_overdue      = EXCLUDED.days_overdue,
    refreshed_at      = NOW();
```

**One query per measure replaces 300 PHP-chunked queries.**

For **drug domain** measures (statin therapy, ACE/ARB, beta-blocker):

```sql
-- Same pattern, join to drug_exposure table instead of measurement
```

For **procedure domain** measures (retinal exam, foot exam, colonoscopy):

```sql
-- Same pattern, join to procedure_occurrence
```

### 4.4 Step C — Aggregate Snapshot

```sql
INSERT INTO care_gap_snapshots
    (source_id, bundle_id, snapshot_date, person_count,
     measures_met, measures_open, measures_excluded, compliance_pct,
     risk_high_count, risk_medium_count, risk_low_count, computed_at)
SELECT
    :source_id,
    :bundle_id,
    CURRENT_DATE,
    COUNT(DISTINCT cgpm.person_id)                                          AS person_count,
    SUM(CASE WHEN cgpm.status = 'met'      THEN 1 ELSE 0 END)              AS measures_met,
    SUM(CASE WHEN cgpm.status = 'open'     THEN 1 ELSE 0 END)              AS measures_open,
    SUM(CASE WHEN cgpm.status = 'excluded' THEN 1 ELSE 0 END)              AS measures_excluded,
    ROUND(
        SUM(CASE WHEN cgpm.status = 'met' THEN 1 ELSE 0 END)::NUMERIC /
        NULLIF(SUM(CASE WHEN cgpm.status != 'excluded' THEN 1 ELSE 0 END), 0)
        * 100, 2
    )                                                                        AS compliance_pct,
    -- Risk: patients with 0 measures met = high risk
    COUNT(DISTINCT CASE WHEN per_patient.met_count = 0 THEN per_patient.person_id END),
    -- Risk: patients with 1 to (n-1) measures met = medium
    COUNT(DISTINCT CASE WHEN per_patient.met_count > 0
                         AND per_patient.met_count < per_patient.total_count
                         THEN per_patient.person_id END),
    -- Risk: patients with all measures met = low
    COUNT(DISTINCT CASE WHEN per_patient.met_count = per_patient.total_count
                         THEN per_patient.person_id END),
    NOW()
FROM care_gap_patient_measures cgpm
JOIN (
    SELECT person_id,
           SUM(CASE WHEN status = 'met' THEN 1 ELSE 0 END)  AS met_count,
           COUNT(*)                                           AS total_count
    FROM   care_gap_patient_measures
    WHERE  source_id = :source_id AND bundle_id = :bundle_id
      AND  is_deduplicated = FALSE
    GROUP  BY person_id
) per_patient ON per_patient.person_id = cgpm.person_id
WHERE cgpm.source_id = :source_id
  AND cgpm.bundle_id = :bundle_id
  AND cgpm.is_deduplicated = FALSE
ON CONFLICT (source_id, bundle_id, snapshot_date, cohort_definition_id) DO UPDATE SET
    person_count      = EXCLUDED.person_count,
    measures_met      = EXCLUDED.measures_met,
    measures_open     = EXCLUDED.measures_open,
    measures_excluded = EXCLUDED.measures_excluded,
    compliance_pct    = EXCLUDED.compliance_pct,
    risk_high_count   = EXCLUDED.risk_high_count,
    risk_medium_count = EXCLUDED.risk_medium_count,
    risk_low_count    = EXCLUDED.risk_low_count,
    computed_at       = NOW();
```

---

## 5. Required CDM Indexes

These indexes do not exist on the Synthea `omop` schema and are **critical** for ETL performance. They should be created once as a migration (read-only CDM — superuser required, or the DB admin runs them separately):

```sql
-- condition_occurrence: drives bundle enrollment queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_co_concept_person
    ON omop.condition_occurrence (condition_concept_id, person_id, condition_start_date DESC);

-- measurement: drives HbA1c, BP, eGFR, lipid, creatinine measures
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_meas_concept_person_date
    ON omop.measurement (measurement_concept_id, person_id, measurement_date DESC);

-- drug_exposure: drives statin, ACE/ARB, beta-blocker, metformin measures
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_drug_concept_person_date
    ON omop.drug_exposure (drug_concept_id, person_id, drug_exposure_start_date DESC);

-- procedure_occurrence: drives retinal exam, foot exam, dialysis measures
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_proc_concept_person_date
    ON omop.procedure_occurrence (procedure_concept_id, person_id, procedure_date DESC);

-- observation: drives BMI, smoking status, depression screen measures
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_obs_concept_person_date
    ON omop.observation (observation_concept_id, person_id, observation_date DESC);
```

`CONCURRENTLY` means no table lock — safe to run on a live system.

**Estimated index build time on 1M patients** (local SSD):
- `condition_occurrence` (~3M rows): ~30 seconds
- `measurement` (~710M rows — this is the big one): 20–40 minutes
- `drug_exposure` (~50M rows): ~3 minutes
- `procedure_occurrence` (~30M rows): ~2 minutes
- `observation` (~20M rows): ~1 minute

**The measurement index is the critical path.** Without it, BP/HbA1c/lipid queries full-scan 710M rows every night.

---

## 6. Incremental vs. Full Refresh Strategy

### Option A — Full Nightly Replace (Simpler, Recommended Initially)

```
TRUNCATE care_gap_patient_bundles, care_gap_patient_measures
→ Rebuild from scratch nightly
```

**Pros:** Correct by construction — no stale rows. Simple to implement.
**Cons:** ~5-10 minute window where dashboard shows stale data.

**ETL runtime estimate (full refresh, 1M patients, 10 bundles, 40 measures):**
- Step A (10 bundles × 1 query each): ~5 seconds total
- Step B (40 measures × 1 query each): ~40 seconds total
- Step C (10 bundles × 1 query each): ~5 seconds total
- **Total: ~1 minute** (vs. 10–30 minutes today)

At 45 bundles × 4 sources: ~4 minutes. Completely tractable.

### Option B — Incremental Refresh (Future Enhancement)

Only process patients with CDM events in the last 24 hours:

```sql
-- Find patients with new events since last refresh
WITH recently_active AS (
    SELECT DISTINCT person_id FROM omop.measurement
    WHERE measurement_date >= CURRENT_DATE - INTERVAL '1 day'
    UNION
    SELECT DISTINCT person_id FROM omop.drug_exposure
    WHERE drug_exposure_start_date >= CURRENT_DATE - INTERVAL '1 day'
    UNION
    SELECT DISTINCT person_id FROM omop.procedure_occurrence
    WHERE procedure_date >= CURRENT_DATE - INTERVAL '1 day'
)
-- Then run Step B only for patients in recently_active
```

**Pros:** Much faster for large populations with sparse daily updates.
**Cons:** Misses lookback window changes (e.g., a measure that was "met" but the qualifying event aged out of the 365-day window). Requires a separate monthly full refresh pass.

**Recommendation:** Start with full nightly replace. Add incremental if ETL runtime exceeds 15 minutes in production.

---

## 7. New Laravel Jobs & Classes

### 7.1 `CareGapNightlyRefreshJob`

```php
class CareGapNightlyRefreshJob implements ShouldQueue
{
    public $timeout = 3600;  // 1 hour max
    public $queue = 'analysis';

    public function handle(CareGapRefreshService $service): void
    {
        $sources = Source::where('is_active', true)->with('daimons')->get();

        foreach ($sources as $source) {
            $bundles = ConditionBundle::where('is_active', true)
                ->with('measures')
                ->get();

            foreach ($bundles as $bundle) {
                $service->refreshBundle($source, $bundle);
            }
        }
    }
}
```

### 7.2 `CareGapRefreshService`

Replaces `CareGapService` for scheduled evaluation. Key methods:

```php
public function refreshBundle(Source $source, ConditionBundle $bundle): void
    // Runs Steps A + B + C in a transaction
    // Logs timing per bundle to care_gap_snapshots.etl_duration_ms

public function refreshBundlePatients(Source $source, ConditionBundle $bundle): int
    // Step A: Returns count of enrolled patients

public function refreshMeasure(Source $source, ConditionBundle $bundle, QualityMeasure $measure): void
    // Step B: One measure at a time

public function refreshSnapshot(Source $source, ConditionBundle $bundle): void
    // Step C: Aggregate to snapshot
```

### 7.3 Scheduler Registration

In `routes/console.php`:

```php
Schedule::job(new CareGapNightlyRefreshJob())
    ->dailyAt('02:00')
    ->withoutOverlapping(60)
    ->onOneServer()
    ->appendOutputTo(storage_path('logs/care-gap-refresh.log'));
```

### 7.4 Keep `CareGapService` for On-Demand Runs

The existing `CareGapService` is used for user-triggered evaluations via the UI. It should be refactored to:
1. Fix the `DATEADD` bug (use `CURRENT_DATE - INTERVAL ':n days'`)
2. When `care_gap_patient_measures` rows exist for the requested bundle/source, read from the materialized layer instead of hitting CDM directly
3. Fall back to CDM if no materialized data exists (for first run)

---

## 8. New API Endpoints for Patient-Level Gap Data

With `care_gap_patient_measures` in place, we can expose:

```
GET /api/v1/care-gaps/{bundleId}/patients?source_id=X&status=open&page=1
    → Paginated list of patient_ids with open gaps for a bundle
    → Joins to person table for age/gender demographics

GET /api/v1/care-gaps/{bundleId}/patients/{personId}
    → Per-patient gap card: all measures, status, last_service_date, due_date

GET /api/v1/care-gaps/{bundleId}/trend?source_id=X&days=90
    → Compliance trend from care_gap_snapshots: daily compliance_pct × 90 data points

GET /api/v1/care-gaps/at-risk?source_id=X&bundle_codes[]=DM&bundle_codes[]=HTN
    → Patients with open gaps in 2+ bundles simultaneously (multi-condition management)
    → Uses JOIN on care_gap_patient_bundles across bundles
```

---

## 9. The DATEADD Bug — Must Fix Before 1M Run

In `CareGapService.php` line 362:
```php
AND t.{$dateColumn} >= DATEADD(CURRENT_DATE, -{$lookbackDays})
```

The `SqlRendererService` translates `DATEADD` using SQL Server syntax: `DATEADD(datepart, number, date)`. The call above passes only 2 arguments (date and number — no datepart). This is broken.

**Fix:**
```php
AND t.{$dateColumn} >= {CURRENT_DATE} - INTERVAL '{$lookbackDays}' DAY
// After SqlRendererService dialect translation → PostgreSQL: CURRENT_DATE - INTERVAL '365 days'
```

Or use the OMOP-standard `DATEADD` template format that SqlRendererService already handles:
```php
AND t.{$dateColumn} >= DATEADD(day, -{$lookbackDays}, {CURRENT_DATE})
```

This must be fixed regardless of which architecture we implement.

---

## 10. Testing Strategy on 1M Synthea Patients

### 10.1 Baseline Benchmark

Before implementing the new architecture, capture current performance:

```bash
# Time a full 10-bundle evaluation on Eunomia (2,694 patients) — reference point
time php artisan tinker --execute="app(CareGapService::class)->evaluate(...)"

# Then benchmark on Acumenus ohdsi source (1M patients)
# Expect: 10–30 minutes
```

### 10.2 Index Creation

```bash
# Run on local PG 17 as smudoshi (has superuser on ohdsi)
psql -U smudoshi -d ohdsi -c "
  CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_co_concept_person
  ON omop.condition_occurrence (condition_concept_id, person_id, condition_start_date DESC);
"
# Repeat for measurement, drug_exposure, procedure_occurrence, observation
```

Monitor progress with:
```sql
SELECT phase, blocks_done, blocks_total,
       round(blocks_done::numeric/nullif(blocks_total,0)*100,1) AS pct
FROM pg_stat_progress_create_index;
```

### 10.3 Refresh Service Benchmark

After implementing `CareGapRefreshService`:

```bash
# Full 10-bundle refresh
time php artisan care-gaps:refresh --source=ACUMENUS_PROD

# Expected: < 2 minutes with indexes
# Verify: SELECT COUNT(*) FROM care_gap_patient_bundles; → ~2.3M rows
# Verify: SELECT COUNT(*) FROM care_gap_patient_measures; → ~9M rows
```

### 10.4 Validation

Cross-check patient counts against direct CDM query:

```sql
-- Should match care_gap_patient_bundles count for DM
SELECT COUNT(DISTINCT person_id)
FROM omop.condition_occurrence
WHERE condition_concept_id IN (201826, 443238, 4193704);

-- Should match care_gap_patient_measures where measure=DM-01 and status='met'
SELECT COUNT(DISTINCT person_id)
FROM omop.measurement
WHERE measurement_concept_id IN (3004410, 3034639, 40758583)
  AND measurement_date >= CURRENT_DATE - INTERVAL '365 days'
  AND person_id IN (SELECT person_id FROM omop.condition_occurrence
                    WHERE condition_concept_id IN (201826, 443238, 4193704));
```

---

## 11. Implementation Sequence

| Phase | Task | Effort |
|-------|------|--------|
| **CGE-1** | Fix `DATEADD` bug in `CareGapService::evaluateMeasure()` | 30 min |
| **CGE-2** | Migration: create `care_gap_patient_bundles`, `care_gap_patient_measures`, `care_gap_snapshots` | 2 hours |
| **CGE-3** | Create CDM indexes (concurrent, no downtime) | 30 min + wait time |
| **CGE-4** | Implement `CareGapRefreshService` with pure SQL UPSERT methods | 4 hours |
| **CGE-5** | Implement `CareGapNightlyRefreshJob` + scheduler registration | 1 hour |
| **CGE-6** | Artisan command `care-gaps:refresh` for manual triggering | 30 min |
| **CGE-7** | Benchmark on 1M patients; validate counts | 2 hours |
| **CGE-8** | Refactor `CareGapService` to read from materialized layer | 2 hours |
| **CGE-9** | New API endpoints (patient list, trend, at-risk) | 3 hours |
| **CGE-10** | Frontend: patient-level gap table + compliance trend chart | 4 hours |

**Total:** ~20 hours. Start with CGE-1 through CGE-7 (the pure backend/ETL work) before any frontend changes.

---

## 12. What We Are NOT Building

- **A Kimball star schema** — no `dim_date`, `dim_patient`, `dim_provider` surrogate key tables. The OMOP CDM is already a dimensional model; we don't need to re-model it.
- **A separate OLAP database** (Snowflake, Redshift, ClickHouse) — PostgreSQL 17 with proper indexes handles 1M patients trivially.
- **A streaming ETL pipeline** (Kafka, Spark) — overkill. Nightly batch SQL is correct for claims/CDM data which is inherently batch-loaded.
- **An SCD2 (slowly changing dimension) history for patients** — OMOP already tracks observation period and event history natively.
- **Cohort pre-materialization** — OMOP cohort tables (`results.cohort`) handle this; we intersect with cohorts at bundle enrollment time via the existing `cohortDefinitionId` filter.

---

## 13. Summary Decision Matrix

| Question | Answer |
|----------|--------|
| Need a star schema? | No — use OMOP CDM + materialized compliance cache |
| Need nightly ETL? | Yes — `CareGapNightlyRefreshJob` daily at 2 AM |
| Pre-compute bundle membership? | Yes — `care_gap_patient_bundles` table |
| Pre-compute per-patient measures? | Yes — `care_gap_patient_measures` table |
| Store aggregate snapshots? | Yes — `care_gap_snapshots` for trend dashboards |
| Query language for ETL? | Pure SQL (INSERT...SELECT) — no PHP loops |
| CDM indexes needed? | Yes — 5 indexes on condition/measurement/drug/procedure/observation |
| Fix DATEADD bug first? | Yes — current evaluations return incorrect results |
| Timeline to implement CGE-1–7? | ~10 hours |
| Expected ETL runtime at 1M patients, 10 bundles? | < 2 minutes (from current ~15 minutes) |
| Expected ETL runtime at 1M patients, 45 bundles? | < 8 minutes |
