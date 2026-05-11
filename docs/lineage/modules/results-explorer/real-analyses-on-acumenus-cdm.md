# Real HADES Analyses on Acumenus CDM (1M Patients)

**Date:** 2026-03-07
**Goal:** Transform Parthenon from a demo with synthetic data into a working research platform by running real OHDSI HADES analyses against the production Acumenus CDM.

## What Was Done

### 1. Database & Source Configuration
- Created Acumenus CDM source (#2) with proper daimons (cdm→omop, vocab→omop, results→achilles_results)
- Set `db_host`, `db_database`, `username`, `password` via Eloquent (encrypted fields)
- Created cohort definitions for pre-generated cohorts (#21-25):
  - 21: ACE Inhibitor Users (141,655 members)
  - 22: Coronary Artery Disease Events (70,874)
  - 23: Lisinopril Users (100,271)
  - 24: Acute Myocardial Infarction (9,518)
  - 25: ARB Users (31,452) — newly generated

### 2. R Runtime Bug Fixes

**covariates.R — Exclusion bypass in `use_keys` path:**
The early-return path for direct FeatureExtraction parameter names (`useDemographicsAge`, etc.) skipped `spec$excludedConceptIds`. Fixed by merging spec-level exclusions into the args before `createCovariateSettings()`.

**estimation.R — CohortMethod v6 API for PS adjustment:**
`matchOnPs()`, `stratifyByPs()`, `trimByPs()` all changed in v6 to use Args objects:
- `matchOnPs(population, matchOnPsArgs = createMatchOnPsArgs(caliper, maxRatio))`
- `stratifyByPs(population, stratifyByPsArgs = createStratifyByPsArgs(numberOfStrata))`
- `trimByPs(population, trimByPsArgs = createTrimByPsArgs(trimFraction))`

**prediction.R — jsonlite S3 serialization crash:**
`plpResult$model$modelDesign$modelSettings` is an S3 object that `jsonlite::toJSON` can't serialize (`No method asJSON S3 class: modelSettings`). Fixed by `unclass()` before return.

**sccs.R — data.frame iteration bug:**
`jsonlite::fromJSON(simplifyVector=TRUE)` converts JSON `[{...}]` to a data.frame. `lapply` on data.frame iterates columns, not rows. Fixed by detecting `is.data.frame(raw_rw)` and converting to list-of-lists. Also: normalized underscore anchors (`era_start` → `era start`), removed `eventDependentObservation`, fixed summary extraction.

**RService.php — Null response handling:**
`runPrediction()` returned `$response->json()` which is `null` on HTTP 500. Added null coalescing to return an error array.

### 3. Analysis Design Iteration

The estimation pipeline required careful study design to avoid the "High correlation" error:
- Lisinopril vs ACE-I: 94% overlap → perfect correlation
- Added `excludedConceptIds` for all ACE-I + ARB ingredients (18 concepts)
- Removed `useDrugGroupEraLongTerm` (ATC class covariates still correlated)
- Final design: Lisinopril (#23) vs ARB (#25) with individual drug exposure covariates

### 4. Final Results

**Estimation (Lisinopril vs ARB, PS-matched):**
- 78,214 target, 5,383 comparator (after 1:1 matching)
- CAD: HR=1.02 [0.93, 1.12] p=0.66
- AMI: HR=0.77 [0.56, 1.06] p=0.11
- PS AUC=0.954, SMD after matching=0.017
- Full visualization data: KM curves, 50 covariate balance items, 6 attrition steps, PS distribution

**PLP (Lisinopril → AMI prediction, LASSO):**
- 24,501 subjects, 66 outcomes (0.27% rate)
- AUPRC=0.020, 200 ROC points, 100 calibration points, 30 top predictors
- Top predictors: age 75-79, aspirin use, age 70-74

**SCCS (Lisinopril exposure → AMI):**
- 3 risk window estimates with IRR and confidence intervals
- Acute (1-30d): IRR=93.0 [87.5, 98.8]
- Extended (31-60d): IRR=0.57 [0.32, 1.02]

## Lessons Learned

1. **CohortMethod v6 Args pattern**: All adjustment functions now require Args objects, not direct parameters
2. **Drug concept exclusion**: Must exclude ALL related drug concepts (ingredients + descendants) AND drug group era covariates when comparing related drug classes
3. **jsonlite simplifyVector**: Array-of-objects → data.frame breaks `lapply` iteration patterns
4. **R S3 classes**: PLP result objects contain non-serializable S3 classes; must `unclass()` before JSON return
5. **Source connection routing**: R container needs resolvable hostname for DB; `localhost` from Docker != host machine
6. **PS fitting time**: ~12 minutes for 100K subjects with thousands of covariates on Cyclops optimizer
