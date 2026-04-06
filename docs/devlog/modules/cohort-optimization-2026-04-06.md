# Cohort Generation — 90x Performance Fix + 20 Cohort Fixes

**Date:** 2026-04-06
**Status:** Complete
**Commits:** TBD

## Summary

Fixed all 20 cohorts with zero or missing patient counts, and optimized the cohort SQL compiler to reduce drug-heavy cohort generation from **3+ hours (never completing)** to **under 2 minutes** — a 90x improvement.

## Root Causes Found

### 1. `intval()` Bug on Concept Arrays (Fixed 2026-04-04)

`ConceptSetSqlBuilder::buildConceptListClause()` was using `intval()` on concept objects (arrays), producing `IN (1)` instead of actual concept IDs like `IN (37018196, 201826)`. All cohorts generated before the fix got 0 patients.

### 2. Missing Lab Measurement Concepts

Two cohorts (#68 Heart Failure, #69 CKD) used BNP and eGFR concept IDs that didn't match the actual measurement data in the Acumenus CDM:
- **BNP:** Cohort used 3035452/3029435, actual data is 3029187/42870364
- **eGFR:** Cohort used 3049187/3053283 (CKD-EPI), actual data is 46236952 (MDRD formula)

Fixed by adding the correct concepts to each cohort definition's concept sets.

### 3. Missing SynPUF Achilles Tables

The `synpuf_results` schema lacked the 4 Achilles output tables (`achilles_results`, `achilles_results_dist`, `achilles_analysis`, `achilles_performance`). Laravel migrations only created them in the default `results` schema. Created them manually; Achilles completed 128/128 analyses with 0 failures.

### 4. Cohort SQL Compiler Performance (The Big One)

Drug-heavy cohorts with 22+ ingredient concept sets (expanding to ~20K drug concept IDs via concept_ancestor) took 3+ hours and never completed against the 1M-patient Acumenus CDM (86M drug_exposure rows).

**Three compounding bottlenecks:**

| Bottleneck | Pattern | Impact |
|---|---|---|
| CTE inlining | PG 12+ inlines CTEs, re-evaluating concept_ancestor (78M rows) at every reference | 5x redundant work |
| LEFT JOIN + HAVING COUNT = 0 | Absence checks materialized ALL matching drug_exposure rows before aggregating | Billions of intermediate rows |
| Default work_mem (256MB) | Large sorts spilled to disk repeatedly | I/O-bound instead of memory-bound |

## Optimizations Applied

### 1. `AS MATERIALIZED` on Concept Set CTEs

Forces PostgreSQL to evaluate concept_ancestor joins once and cache the result, preventing re-evaluation at each reference site.

```sql
-- Before: PG inlines this at every reference (5x evaluation)
codesetId_2 AS (
    SELECT DISTINCT concept_id FROM (
        SELECT ca.descendant_concept_id FROM vocab.concept_ancestor ca 
        WHERE ca.ancestor_concept_id IN (1596977, 46221581, ...)
    ) included
)

-- After: Evaluated once, cached
codesetId_2 AS MATERIALIZED (...)
```

### 2. `NOT EXISTS` for Absence Checks (The Key Win)

Replaced `LEFT JOIN + GROUP BY + HAVING COUNT = 0` with `WHERE NOT EXISTS`. NOT EXISTS short-circuits after the first matching row, while LEFT JOIN materializes ALL matches.

```sql
-- Before: Materializes all 86M drug_exposure matches per person
inclusion_rule_1 AS (
    SELECT qe.person_id
    FROM qualified_events qe
    LEFT JOIN omop.drug_exposure e ON qe.person_id = e.person_id
        AND e.drug_concept_id IN (SELECT concept_id FROM codesetId_2)
        AND e.drug_exposure_start_date >= qe.start_date - INTERVAL '365 days'
    GROUP BY qe.person_id
    HAVING COUNT(e.person_id) = 0
)

-- After: Stops at first match per person
inclusion_rule_1 AS (
    SELECT DISTINCT qe.person_id
    FROM qualified_events qe
    WHERE NOT EXISTS (
        SELECT 1 FROM omop.drug_exposure e
        WHERE e.person_id = qe.person_id
            AND e.drug_concept_id IN (SELECT concept_id FROM codesetId_2)
            AND e.drug_exposure_start_date >= qe.start_date - INTERVAL '365 days'
    )
)
```

### 3. `EXISTS` for Simple Existence Checks

For "at least 1 occurrence" (Type=2, Count<=1), replaced `JOIN + GROUP BY + HAVING COUNT >= 1` with `WHERE EXISTS`.

### 4. Session-Level Query Tuning

```php
$conn->unprepared("SET LOCAL work_mem = '1GB'");
$conn->unprepared("SET LOCAL max_parallel_workers_per_gather = 4");
```

## Results

### Performance

| Cohort | Before | After | Speedup |
|---|---|---|---|
| #71 Prediabetes Watchful Waiting (22 drug ingredients, 3 absence rules) | 3+ hours (never completed) | 1 min 47 sec | **90x** |
| #196 Statin Users (4 drug ingredients, 1 absence rule) | Unknown (0 patients due to bug) | ~3 min | N/A |

### Cohort Counts

| ID | Name | Before | After | Fix |
|----|------|--------|-------|-----|
| 71 | Prediabetes Watchful Waiting | 0 | **380,481** | intval bug + optimization |
| 196 | S7: Statin Users Primary Prevention | 0 | **51,906** | intval bug |
| 197 | S9: Prediabetes No Glucose-Lowering Drugs | 0 | **363,583** | intval bug |
| 80 | Cardiometabolic Dyad | Failed | **17,472** | intval bug |
| 72 | T2DM First Occurrence | Never run | **75,431** | Generated |
| 81 | MACE | Never run | **53,650** | Generated |
| 139 | T2DM with HbA1c | Never run | **25,163** | Generated |
| 66 | Essential Hypertension | Never run | **62,106** | Generated |
| 68 | Heart Failure w/ BNP | 0 | **27,702** | Added NT-proBNP concepts |
| 69 | CKD Stage 3-5 w/ eGFR | 0 | **61,165** | Added MDRD eGFR concept |
| 210-219 | IRSF Cohorts (10) | Never run | **81-1,084 each** | Generated against IRSF CDM |

### SynPUF Achilles

Created missing tables in `synpuf_results` schema. Run completed: 128/128 analyses, 0 failures.

## Key Takeaways

1. **NOT EXISTS is dramatically faster than LEFT JOIN + HAVING COUNT = 0 for absence checks.** The LEFT JOIN pattern materializes all matches; NOT EXISTS stops at the first. For 86M-row drug_exposure, this is the difference between 3 hours and 2 minutes.

2. **`AS MATERIALIZED` prevents CTE inlining.** When a CTE with an expensive join (concept_ancestor) is referenced multiple times, PG 12+ inlines it at each site. MATERIALIZED forces single evaluation.

3. **Concept set definitions must match actual CDM data.** eGFR and BNP have multiple LOINC variants; the standard OMOP concepts (CKD-EPI formula) may not match the actual data (MDRD formula). Always verify with `SELECT DISTINCT measurement_concept_id FROM measurement`.

4. **Same pattern as drug_era fix.** The SynPUF enrichment devlog documented identical symptoms (concept_ancestor re-evaluation causing 17h+ runtimes). The fix pattern is consistent: materialize expensive intermediate results before reuse.

## Future Optimization (P1)

The research identified a **two-phase temp table execution** pattern (matching OHDSI circe-be architecture) that could further reduce to 3-5 minutes:
1. Materialize concept sets + pre-filtered domain events into indexed temp tables
2. Run cohort logic against temp tables instead of base clinical tables
3. Clean up temp tables after INSERT

This is the approach OHDSI's circe-be uses natively. Implementation effort: ~2-3 days.

## Files Changed

- `backend/app/Services/Cohort/Builders/ConceptSetSqlBuilder.php` — `AS MATERIALIZED` on concept set CTEs
- `backend/app/Services/Cohort/Builders/PrimaryCriteriaBuilder.php` — `AS MATERIALIZED` on primary/qualified events
- `backend/app/Services/Cohort/Builders/InclusionCriteriaBuilder.php` — NOT EXISTS for absence, EXISTS for existence
- `backend/app/Services/Cohort/CohortGenerationService.php` — SET LOCAL work_mem/parallel workers
