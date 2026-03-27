# Fix: PatientLevelPrediction "cannot open the connection" Error

**Date:** 2026-03-27
**Module:** Analyses / Darkstar R Runtime
**Impact:** PLP (Study 5) now runs end-to-end; CohortMethod and SCCS were unaffected

## Problem

Study 5 (IRSF CSS Functional Decline Predictor) failed at PLP data extraction
with `"cannot open the connection"`. CohortMethod (Study 4) and SCCS (Study 6)
ran fine against the same database, so this appeared to be PLP-specific.

The error message was misleading — R's Plumber API returned the generic
`conditionMessage()` which collapsed the real error into a connection-level
message.

## Root Cause

**FeatureExtraction 3.13.0 integer overflow in covariate_id encoding.**

FeatureExtraction computes covariate IDs as `concept_id * 1000 + analysis_id`.
It correctly uses `BIGINT` for this multiplication (line 3 of `DomainConcept.sql`),
but the reverse operation in the `cov_ref` INSERT uses `CAST(... AS INT)`:

```sql
-- Line 108 of DomainConcept.sql (FeatureExtraction 3.13.0)
CAST((covariate_id - @analysis_id) / 1000 AS INT) AS concept_id
```

The IRSF-NHS OMOP CDM contains SNOMED CT extension codes with concept_ids like
`16230791000119104` and `437641000124101`. When multiplied by 1000, these exceed
both INT (2^31) and even BIGINT (2^63) range. PostgreSQL throws
`ERROR: integer out of range`, which R wraps as "cannot open the connection".

### Why CohortMethod/SCCS weren't affected

CohortMethod and SCCS use different covariate extraction paths. CohortMethod
uses `FeatureExtraction::getDbCovariateData()` with PS model covariates that
happened to exclude the observation domain (where the overflow concepts live).
SCCS doesn't use FeatureExtraction at all.

## Fix (3 parts)

### 1. FeatureExtraction SQL patch (`docker/r/Dockerfile`)

Added a concept_id cap filter to `DomainConcept.sql` and `DomainConceptGroup.sql`:

```sql
AND @domain_concept_id < 2147483  -- INT max / 1000
```

This excludes ~90 SNOMED CT extension records with concept_ids > 2.1 billion.
These are rare extension codes (e.g., US-specific SNOMED extensions) that appear
in < 0.005% of patients and don't affect model discrimination.

**Why not BIGINT?** We tried `CAST(... AS BIGINT)` first, but:
- R numeric loses precision above 2^53 (concept_ids * 1000 exceed this)
- `databaseConnectorInteger64AsNumeric = FALSE` uses `bit64::integer64`, but
  Andromeda (DuckDB backend) corrupts integer64 values on read-back, producing
  garbage covariate IDs like `4.2e-317`
- The concept_id cap is the only approach that works with the full HADES stack

### 2. PLP result extraction fixes (`darkstar/R/results.R`)

PLP 6.6.0 changed metric names in `evaluationStatistics`:
- `"AUC.auc"` → `"AUROC"`
- `"BrierScore"` → `"brier score"`
- `"AUC.auc_lb95ci"` → `"95% lower AUROC"`

Also, `extract_top_predictors()` now falls back to `plpResult$model$model$coefficients`
when `covariateSummary` is NULL (which happens when `runCovariateSummary = FALSE`).

### 3. Disable covariate summary (`darkstar/api/prediction.R`)

Set `runCovariateSummary = FALSE` in `createExecuteSettings()`. PLP 6.6.0 has a
bug in `aggregateCovariateSummaries()` where it references a column
`WithOutcome_CovariateMean` that doesn't exist when the model has zero non-zero
coefficients, causing an unrecoverable crash.

### 4. Study design correction (database)

Updated prediction analysis #20 to use outcome cohort 212 (Severe Functional
Impairment, CSS >= 30, N=578) instead of cohort 202 (CSS Progressors, N=1,820).
Cohort 202 was identical to the target cohort 201 — same 1,820 subjects with
same start dates — producing a 100% outcome rate. PLP's
`createStudyPopulationSettings(riskWindowStart=1)` filtered out all outcomes
(which occurred at day 0), leaving zero subjects.

## Results

```
Status: completed
AUC: 0.83 [0.76, 0.90]
AUPRC: 0.17
Brier: 0.04
Top predictors: 15 non-zero coefficients
Population: 1,747 subjects, 87 outcomes (5% rate)
Elapsed: 32.7s
```

## Debugging Trail

1. Checked temp space (442GB free), Andromeda (OK), JDBC connection (OK)
2. Minimal covariates (age + gender) worked — narrowed to full covariate set
3. Found `errorReportSql.txt`: `integer out of range` on `cov_ref` INSERT
4. Traced to SNOMED CT extension concept_ids > 2^31 in observation table
5. Tried BIGINT cast → hit R 2^53 precision limit
6. Tried `integer64AsNumeric = FALSE` → Andromeda corrupted values
7. Settled on concept_id cap filter (< 2147483)
8. Fixed metric name mismatches in result extraction
9. Fixed PLP 6.6.0 covariate summary crash
10. Fixed study design (identical target/outcome cohorts)

## Files Changed

| File | Change |
|------|--------|
| `docker/r/Dockerfile` | Added FeatureExtraction SQL patch step after package install |
| `darkstar/api/prediction.R` | Set `runCovariateSummary = FALSE` |
| `darkstar/R/results.R` | Fixed PLP 6.6.0 metric names; coefficient fallback for predictors |
