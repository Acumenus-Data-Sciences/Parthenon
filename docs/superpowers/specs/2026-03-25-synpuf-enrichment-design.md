# SynPUF Enrichment Script — Design Specification

**Date:** 2026-03-25
**Status:** Approved
**Location:** `scripts/synpuf_enrichment.py`

## Purpose

Fix 7 data quality gaps in the `synpuf` schema (2.3M persons, 1.55B rows) on `pgsql.acumenus.net` so the CMS SynPUF dataset passes all OHDSI Achilles and DQD checks. Interactive Rich TUI with per-stage progress bars, row counters, and elapsed timers.

## Current Data Quality Issues

| # | Issue | Records Affected | Root Cause |
|---|-------|-----------------|------------|
| 1 | Missing `cdm_source` table | Entire dataset | Table never created during ETL |
| 2 | Missing CDM v5.4 tables (`drug_era`, `condition_era`, etc.) | Schema completeness | v5.x ETL didn't create derived tables |
| 3 | Unmapped race (concept_id=0) | 152,425 persons (6.5%) | CMS claims lacked race for some beneficiaries |
| 4 | Orphan persons (no observation_period) | 228,341 persons (9.8%) | ETL gap — persons loaded without matching obs periods |
| 5 | Unmapped visit types (concept_id=0) | 94,734,128 visits (84.8%) | Carrier claims not mapped to visit concepts |
| 6 | Non-standard concept IDs in clinical tables | 46M records across 3 tables | Source concepts loaded instead of standard equivalents |
| 7 | Missing `drug_era` and `condition_era` data | 0 rows (tables don't exist) | Derived tables never built |

## Pre-Run Safety

**Recommend database backup before running.** Stages 3, 5, and 6 perform UPDATE operations that change concept IDs. These are not reversible without a backup. Run `./scripts/db-backup.sh` or take a manual snapshot before executing.

## Stages

### Stage 1: `cdm_source` — Create CDM Source Metadata

**Action:** CREATE TABLE + INSERT one row. DDL matches the Laravel migration at `backend/database/migrations/2026_03_01_152022_create_cdm_cdm_source_table.php`, including the `id` auto-increment primary key.

```sql
CREATE TABLE IF NOT EXISTS synpuf.cdm_source (
    id                             BIGSERIAL PRIMARY KEY,
    cdm_source_name                VARCHAR(255) NOT NULL,
    cdm_source_abbreviation        VARCHAR(25),
    cdm_holder                     VARCHAR(255),
    source_description             TEXT,
    source_documentation_reference VARCHAR(255),
    cdm_etl_reference              VARCHAR(255),
    source_release_date            DATE,
    cdm_release_date               DATE,
    cdm_version                    VARCHAR(10),
    cdm_version_concept_id         INTEGER,
    vocabulary_version             VARCHAR(20)
);

INSERT INTO synpuf.cdm_source (
    cdm_source_name, cdm_source_abbreviation, cdm_holder,
    source_description, source_documentation_reference, cdm_etl_reference,
    source_release_date, cdm_release_date, cdm_version,
    cdm_version_concept_id, vocabulary_version
)
SELECT
    'CMS Synthetic Public Use Files (SynPUF)',
    'CMS SynPUF',
    'CMS / Acumenus Data Sciences',
    'CMS 2008-2010 Data Entrepreneurs Synthetic Public Use File (DE-SynPUF), 2.3M beneficiary sample. Converted to OMOP CDM v5.4.',
    'https://www.cms.gov/data-research/statistics-trends-and-reports/medicare-claims-synthetic-public-use-files',
    'ETL-CMS (OHDSI) + Parthenon v5.4 adaptation',
    '2024-01-01',
    CURRENT_DATE,
    'v5.4',
    756265,
    (SELECT vocabulary_version FROM omop.vocabulary WHERE vocabulary_id = 'None' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM synpuf.cdm_source);
```

**Progress:** Spinner only (instant).

**Idempotency:** `WHERE NOT EXISTS` prevents duplicate inserts on re-run.

### Stage 2: `empty_tables` — Create Missing CDM v5.4 Tables

**Action:** CREATE TABLE IF NOT EXISTS for: `drug_era`, `condition_era`, `dose_era`, `specimen`, `note`, `note_nlp`, `metadata`.

DDL follows OMOP CDM v5.4 spec exactly. Tables are created empty — `drug_era` and `condition_era` are populated in Stage 7.

**Progress:** Spinner per table.

### Stage 3: `race` — Fix Unmapped Race Concept IDs

**Action:** Single UPDATE.

```sql
UPDATE synpuf.person
SET race_concept_id = 8551  -- UNKNOWN
WHERE race_concept_id = 0;
```

**Progress:** Spinner + row count on completion. Expected: 152,425 rows updated.

**Idempotency:** Only updates where `race_concept_id = 0`. Re-running is a no-op.

### Stage 4: `observation_periods` — Derive Missing Observation Periods

**Action:** For 228,341 persons who have clinical events but no observation_period, derive from min/max event dates across all 6 event tables (condition, drug, procedure, measurement, visit, observation).

Uses `period_type_concept_id = 44814722` ("Period while enrolled in insurance") to match the existing 2,098,515 observation_period records already in the synpuf schema.

```sql
-- Materialized CTE approach: single pass across all event tables
INSERT INTO synpuf.observation_period (
    observation_period_id,
    person_id,
    observation_period_start_date,
    observation_period_end_date,
    period_type_concept_id
)
WITH orphan_persons AS (
    SELECT p.person_id
    FROM synpuf.person p
    WHERE NOT EXISTS (
        SELECT 1 FROM synpuf.observation_period op WHERE op.person_id = p.person_id
    )
),
all_event_dates AS (
    SELECT person_id, MIN(min_d) as min_date, MAX(max_d) as max_date
    FROM (
        SELECT person_id, MIN(condition_start_date) as min_d,
               MAX(COALESCE(condition_end_date, condition_start_date)) as max_d
        FROM synpuf.condition_occurrence WHERE person_id IN (SELECT person_id FROM orphan_persons)
        GROUP BY person_id
        UNION ALL
        SELECT person_id, MIN(drug_exposure_start_date),
               MAX(COALESCE(drug_exposure_end_date, drug_exposure_start_date))
        FROM synpuf.drug_exposure WHERE person_id IN (SELECT person_id FROM orphan_persons)
        GROUP BY person_id
        UNION ALL
        SELECT person_id, MIN(procedure_date), MAX(procedure_date)
        FROM synpuf.procedure_occurrence WHERE person_id IN (SELECT person_id FROM orphan_persons)
        GROUP BY person_id
        UNION ALL
        SELECT person_id, MIN(measurement_date), MAX(measurement_date)
        FROM synpuf.measurement WHERE person_id IN (SELECT person_id FROM orphan_persons)
        GROUP BY person_id
        UNION ALL
        SELECT person_id, MIN(visit_start_date),
               MAX(COALESCE(visit_end_date, visit_start_date))
        FROM synpuf.visit_occurrence WHERE person_id IN (SELECT person_id FROM orphan_persons)
        GROUP BY person_id
        UNION ALL
        SELECT person_id, MIN(observation_date), MAX(observation_date)
        FROM synpuf.observation WHERE person_id IN (SELECT person_id FROM orphan_persons)
        GROUP BY person_id
    ) dates
    GROUP BY person_id
)
SELECT
    (SELECT COALESCE(MAX(observation_period_id), 0) FROM synpuf.observation_period)
        + ROW_NUMBER() OVER (ORDER BY op.person_id),
    op.person_id,
    COALESCE(aed.min_date, '2008-01-01'::date),
    COALESCE(aed.max_date, '2010-12-31'::date),
    44814722  -- Period while enrolled in insurance (matches existing data)
FROM orphan_persons op
LEFT JOIN all_event_dates aed ON aed.person_id = op.person_id;
```

**Note on zero-event persons:** Orphan persons with no events in any table receive a fallback observation period of 2008-01-01 to 2010-12-31 (the SynPUF study window). These are likely data artifacts from the CMS extraction — they exist in the beneficiary summary but generated no claims. Creating a placeholder period is preferable to leaving them as orphans, since orphans fail DQD foreign key checks and cannot participate in any analysis.

**Progress:** Progress bar tracking inserted rows. Expected: ~228,341 rows.

**Idempotency:** WHERE NOT EXISTS in the orphan_persons CTE prevents duplicate observation periods.

### Stage 5: `visit_concepts` — Reclassify Unmapped Visit Types

**Action:** Batched UPDATE on 94.7M rows where `visit_concept_id = 0`.

CMS SynPUF visit source values encode claim type. Mapping logic:

| Source Pattern | Maps To | Concept ID |
|---------------|---------|------------|
| Carrier claims / professional | Outpatient Visit | 9202 |
| Default (remaining unmapped) | Outpatient Visit | 9202 |

SynPUF is predominantly Medicare carrier claims. The 94.7M unmapped visits are carrier/professional encounters. Standard OHDSI mapping for CMS carrier claims is Outpatient Visit (9202).

**Index optimization:** Before batching, create a partial index to accelerate finding `concept_id = 0` rows:

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_synpuf_visit_concept_zero
    ON synpuf.visit_occurrence (visit_occurrence_id)
    WHERE visit_concept_id = 0;
```

```sql
-- Batched by visit_occurrence_id ranges (~1M per batch)
UPDATE synpuf.visit_occurrence
SET visit_concept_id = 9202
WHERE visit_concept_id = 0
  AND visit_occurrence_id BETWEEN :start AND :end;
```

The partial index is dropped after the stage completes (it serves no purpose once concept_id = 0 is eliminated).

**Progress:** Progress bar tracking batches (estimated ~95 batches of 1M).

**Idempotency:** Only updates where `visit_concept_id = 0`.

### Stage 6: `concept_remap` — Map Non-Standard to Standard Concepts

**Action:** For each clinical table, UPDATE non-standard concept_ids to their standard equivalents using `omop.concept_relationship`.

Tables and columns:

| Table | Column | Non-Standard Rows |
|-------|--------|-------------------|
| `condition_occurrence` | `condition_concept_id` | 11,362,913 |
| `drug_exposure` | `drug_concept_id` | 4,554,827 |
| `procedure_occurrence` | `procedure_concept_id` | 30,345,730 |

**Handling multiple "Maps to" targets:** 47,867 source concepts have multiple standard "Maps to" targets. Tiebreaking logic:

1. **Domain match first:** Prefer the target whose `domain_id` matches the table's domain (e.g., `Condition` for `condition_occurrence`, `Drug` for `drug_exposure`, `Procedure` for `procedure_occurrence`).
2. **Lowest concept_id:** If multiple targets share the same domain (or no domain match exists), use the lowest `concept_id` (deterministic, reproducible).

Implementation uses a pre-materialized temp table of best mappings rather than inline subqueries:

```sql
-- Step 1: Materialize best mapping per source concept, scoped to domain
CREATE TEMP TABLE best_mapping AS
SELECT DISTINCT ON (cr.concept_id_1)
    cr.concept_id_1 AS source_concept_id,
    cr.concept_id_2 AS standard_concept_id
FROM omop.concept_relationship cr
JOIN omop.concept c2 ON c2.concept_id = cr.concept_id_2 AND c2.standard_concept = 'S'
WHERE cr.relationship_id = 'Maps to'
ORDER BY cr.concept_id_1,
    CASE WHEN c2.domain_id = :target_domain THEN 0 ELSE 1 END,
    cr.concept_id_2;

-- Step 2: UPDATE using temp table join
UPDATE synpuf.condition_occurrence co
SET condition_concept_id = bm.standard_concept_id
FROM best_mapping bm
WHERE bm.source_concept_id = co.condition_concept_id;
```

The temp table is rebuilt per clinical table with the appropriate `:target_domain` ('Condition', 'Drug', 'Procedure').

**Progress:** Progress bar per table (3 tables), showing rows affected on completion.

**Idempotency:** Only updates non-standard concepts. Re-running after a successful run finds nothing to update (all concept_ids already point to standard concepts).

**Note on unmapped records (concept_id = 0):** Records with `concept_id = 0` have no entry in `concept_relationship` and cannot be remapped. These remain as 0 and are documented as a known limitation. Counts: 4,532,032 drug records (3.5%), 1,246,833 procedure records (0.5%), 3,083 measurement records (<0.01%).

### Stage 7: `era_build` — Build Drug Era and Condition Era

**Action:** Populate `synpuf.drug_era` and `synpuf.condition_era` using the standard OHDSI era-building algorithm with a 30-day persistence window.

The algorithm (runs entirely in PostgreSQL via CTE):

1. For each person+ingredient (drug) or person+condition, order events by start date
2. Identify gaps > 30 days between consecutive exposures/occurrences
3. Merge events within 30-day gaps into continuous eras
4. Record era start date, era end date, and occurrence count

For drugs: roll up to ingredient level using `omop.concept_ancestor` (drug_concept_id -> ancestor where ancestor domain = 'Drug' and concept_class = 'Ingredient').

```sql
-- Drug era build (simplified)
INSERT INTO synpuf.drug_era (drug_era_id, person_id, drug_concept_id,
    drug_era_start_date, drug_era_end_date, drug_exposure_count, gap_days)
WITH ingredient_exposure AS (
    SELECT de.person_id,
           ca.ancestor_concept_id AS ingredient_concept_id,
           de.drug_exposure_start_date,
           COALESCE(de.drug_exposure_end_date,
                    de.drug_exposure_start_date + INTERVAL '1 day') AS drug_exposure_end_date
    FROM synpuf.drug_exposure de
    JOIN omop.concept_ancestor ca ON ca.descendant_concept_id = de.drug_concept_id
    JOIN omop.concept c ON c.concept_id = ca.ancestor_concept_id
        AND c.vocabulary_id = 'RxNorm'
        AND c.concept_class_id = 'Ingredient'
    WHERE de.drug_concept_id != 0
),
-- ... gap detection and era merging CTEs ...
```

**Transaction handling:** Stage 7 does NOT use TRUNCATE inside a transaction (TRUNCATE acquires ACCESS EXCLUSIVE lock and is DDL). Instead:

1. If table has rows and `--force` is not set: prompt user for confirmation
2. Run `TRUNCATE synpuf.drug_era` outside the transaction
3. Run `INSERT INTO ... WITH ...` in its own transaction
4. If INSERT fails, table is left empty (safe — eras are fully derived and can be rebuilt)

**Progress:** Spinner with elapsed timer per table (these are long-running server-side queries — 15-60 minutes each). Row count displayed on completion.

**Idempotency:** TRUNCATE + rebuild. Always produces fresh, consistent eras.

## CLI Interface

```
python scripts/synpuf_enrichment.py                  # Run all 7 stages
python scripts/synpuf_enrichment.py --stage 4        # Run only stage 4
python scripts/synpuf_enrichment.py --stage 4-7      # Run stages 4 through 7
python scripts/synpuf_enrichment.py --dry-run        # Show plan without executing
python scripts/synpuf_enrichment.py --stop-on-error  # Halt on first stage failure
python scripts/synpuf_enrichment.py --force          # Skip confirmation prompts (era rebuild)
```

## TUI Elements

Built with `rich` (already a project dependency from the SynPUF loader).

### Per-Stage Display

```
+-- Stage 5/7: Reclassify Unmapped Visit Types -----------------------+
| Before: 94,734,128 visits with concept_id = 0                      |
| ================================ 47/95 batches  49%  timer 12:34   |
| Rows updated: 47,000,000 / ~94,734,128                             |
+---------------------------------------------------------------------+
```

### Final Summary

```
+-- SynPUF Enrichment Summary ----------------------------------------+
|  #  Stage                    Rows Affected    Time     Status       |
|  1  cdm_source               1               0:01     pass         |
|  2  empty_tables              7 tables        0:02     pass         |
|  3  race                      152,425         0:08     pass         |
|  4  observation_periods        228,341         4:12     pass        |
|  5  visit_concepts             94,734,128     18:45     pass        |
|  6  concept_remap              ~38,000,000    22:31     pass        |
|  7  era_build                  ~15,000,000    47:19     pass        |
|                                                                     |
|  Total elapsed: 1h 32m 58s                                         |
+---------------------------------------------------------------------+
```

**Note on Stage 6 row count:** The ~38M "rows affected" figure represents records that were successfully remapped to standard concepts. The remaining ~8M of the 46M non-standard records either have no "Maps to" relationship in the vocabulary or map to concept_id = 0 (unmapped). These remain unchanged and are a known limitation of the SynPUF dataset.

### Dry Run Output

```
+-- SynPUF Enrichment -- Dry Run -------------------------------------+
|  #  Stage                    Estimated Rows   Action                |
|  1  cdm_source               1                CREATE + INSERT       |
|  2  empty_tables              7 tables         CREATE TABLE         |
|  3  race                      152,425          UPDATE               |
|  4  observation_periods        228,341          INSERT               |
|  5  visit_concepts             94,734,128       UPDATE (batched)    |
|  6  concept_remap              ~46,000,000      UPDATE (3 tables)   |
|  7  era_build                  ~15,000,000      INSERT (derived)    |
|                                                                     |
|  No changes made. Run without --dry-run to execute.                 |
+---------------------------------------------------------------------+
```

## Database Connection

Same pattern as `datasets/loaders/synpuf.py`:

```python
DB_DSN = {
    "host": os.environ.get("SYNPUF_DB_HOST", "pgsql.acumenus.net"),
    "port": int(os.environ.get("SYNPUF_DB_PORT", "5432")),
    "dbname": os.environ.get("SYNPUF_DB_NAME", "parthenon"),
    "user": os.environ.get("SYNPUF_DB_USER", "smudoshi"),
    "password": os.environ.get("SYNPUF_DB_PASSWORD", "acumenus"),
}
```

**Schemas:** `synpuf` (data), `synpuf_results` (Achilles output), `omop` (vocabulary lookups).

## Error Handling

- Each stage runs in its own transaction (BEGIN/COMMIT or ROLLBACK on error), except Stage 7 TRUNCATE which runs outside the transaction
- Failed stages log the error and continue to the next stage (unless `--stop-on-error`)
- Era build (Stage 7) partial failure leaves table empty (safe — fully derived, rebuild anytime)
- Connection errors retry once with a 5-second delay

## Idempotency

Every stage is safe to re-run:

| Stage | Idempotency Mechanism |
|-------|-----------------------|
| 1 | CREATE TABLE IF NOT EXISTS + INSERT WHERE NOT EXISTS |
| 2 | CREATE TABLE IF NOT EXISTS |
| 3 | UPDATE WHERE concept_id = 0 (no-op if already fixed) |
| 4 | WHERE NOT EXISTS (no duplicate obs periods) |
| 5 | UPDATE WHERE concept_id = 0 (no-op if already fixed) |
| 6 | Only updates non-standard concepts (no-op if already remapped) |
| 7 | TRUNCATE + rebuild (always fresh) |

## Dependencies

- `psycopg2` — PostgreSQL driver (installed)
- `rich` — TUI rendering (installed)
- No other dependencies

## What This Script Does NOT Do

- No Achilles or DQD re-run (trigger through the app separately)
- No vocabulary reload or update
- No index creation (use `scripts/importers/synpuf_optimize_indexes.sql`)
- No data deletion beyond era table TRUNCATE (all operations are additive or corrective)
- No schema drops or destructive operations
- Stages 3, 5, 6 are **not reversible** without a database backup
