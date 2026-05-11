# Analysis Execution — Phase 2: R-Backed CohortMethod on Acumenus CDM

**Date:** 2026-03-07
**Scope:** First live R HADES analysis execution on PostgreSQL 17 with 1M patients

## What Was Built

### 1. R Runtime Connectivity to Host PostgreSQL 17

**Problem:** The R container (`parthenon-r`) could not reach the host PostgreSQL 17 at `pgsql.acumenus.net` because Docker networking isolated it.

**Fix:** Added `extra_hosts: ["host.docker.internal:host-gateway"]` to `r-runtime` in `docker-compose.yml`. This maps `host.docker.internal` to the Docker host gateway IP, allowing R to connect to PG17 via the public hostname.

### 2. JDBC Driver Path Fix

**Problem:** `DATABASECONNECTOR_JAR_FOLDER` was `/app/jdbc` (stale image) instead of `/opt/jdbc` (current Dockerfile). The volume mount `./r-runtime:/app` clobbers `/app/jdbc` built in the image.

**Fix:** Rebuilt the R runtime image (`docker compose build r-runtime`) which bakes the correct `ENV DATABASECONNECTOR_JAR_FOLDER=/opt/jdbc` from the Dockerfile.

### 3. Plumber Sub-Router Mounting Fix

**Problem:** All mounted sub-routers returned 404 despite being registered in the OpenAPI spec. The root cause: `pr$mount("/", plumb("health.R"))` at the root path consumed all incoming requests, preventing sub-routers from matching.

**Fix:** Changed `plumber_api.R` to use `plumb("/app/api/health.R")` as the root router (not mounted at "/"), then mount all sub-routers onto it. Also switched all `plumb()` calls to use absolute paths (`/app/api/*.R`).

### 4. R `connection.R` — Flat Source Spec Support

**Problem:** `create_hades_connection()` expected `source_spec$dialect` + nested `source_spec$connection` object, but `HadesBridgeService::buildSourceSpec()` sends flat format: `dbms`, `server` ("host/database"), `port`, `user`, `password`.

**Fix:** Added a new code path in `create_hades_connection()` that checks for `source_spec$server` first (flat format), falling back to the nested `connection` object format.

### 5. CohortMethod v6 API Migration

**Problem:** The R estimation pipeline (`api/estimation.R`) used CohortMethod v5 API (`getDbCohortMethodData(covariateSettings=...)`) but we have v6 installed, which uses an args-builder pattern.

**Fix:** Updated all CohortMethod calls to v6 API:
- `createGetDbCohortMethodDataArgs(covariateSettings=...)` → `getDbCohortMethodData(getDbCohortMethodDataArgs=...)`
- `createCreateStudyPopulationArgs(...)` → `createStudyPopulation(createStudyPopulationArgs=...)`
- `createCreatePsArgs(...)` → `createPs(createPsArgs=...)`
- `createFitOutcomeModelArgs(...)` → `fitOutcomeModel(fitOutcomeModelArgs=...)`

### 6. Covariate Settings Pass-Through

**Problem:** `build_covariate_settings()` expected nested format (`demographics: {gender: true}`) but the backend sends FeatureExtraction parameter names directly (`useDemographicsGender: true`).

**Fix:** Added early detection in `covariates.R`: if spec keys start with `use`, pass them directly to `createCovariateSettings()`.

### 7. `%||%` Operator Fix

**Problem:** Custom null-coalescing operator used `nchar(a) > 0` which fails on `NA_real_` (returns NA, not TRUE/FALSE → "missing value where TRUE/FALSE needed").

**Fix:** Changed to `!anyNA(a)` check instead of `nchar()`.

## First R-Backed Analysis Results

**Lisinopril Users vs Hypertensive Controls — Cox Proportional Hazards**

| Outcome | Target (N) | Comparator (N) | HR | 95% CI | p-value |
|---------|-----------|----------------|------|--------|---------|
| Ischemic Heart Disease | 4,560 | 118,684 | 3.42 | [3.21, 3.64] | <0.001 |
| Acute Myocardial Infarction | 4,560 | 118,684 | 1.24 | [0.98, 1.55] | 0.059 |

- **IHD HR=3.42**: Significantly elevated risk in Lisinopril users — expected due to confounding by indication (ACE inhibitor prescribed to sicker patients)
- **AMI HR=1.24**: Borderline non-significant — clinically plausible
- **Execution time:** ~20 seconds for 2 outcomes on 1M patient CDM
- **Pipeline:** Queue dispatch (Horizon) → EstimationService → R Plumber → CohortMethod v6 → PostgreSQL 17

## Full Pipeline Verified

```
Frontend "Execute" button
  → POST /api/v1/estimation/{id}/execute {source_id: 9}
    → EstimationController::execute()
      → Creates AnalysisExecution (status: queued)
      → Dispatches RunEstimationJob to Horizon 'r-analysis' queue
        → EstimationService::execute()
          → HadesBridgeService::buildSourceSpec($source) → DB credentials
          → RService::runEstimation($spec) → HTTP POST to r-runtime:8787
            → R Plumber /analysis/estimation/run
              → DatabaseConnector::connect() → PG17 via host.docker.internal
              → CohortMethod::getDbCohortMethodData() (data extraction)
              → CohortMethod::createStudyPopulation() (per outcome)
              → CohortMethod::fitOutcomeModel() (Cox regression)
              → Returns HR, CI, p-value, event counts
          → Stores result_json in AnalysisExecution
        → Status: completed (24.9s)
```

## Files Modified

- `docker-compose.yml` — Added `extra_hosts` to r-runtime for PG17 access
- `r-runtime/plumber_api.R` — Fixed sub-router mounting (root router pattern + absolute paths)
- `r-runtime/R/connection.R` — Flat source spec support + `%||%` operator fix
- `r-runtime/R/covariates.R` — Direct FeatureExtraction parameter pass-through
- `r-runtime/api/estimation.R` — CohortMethod v6 API migration
- `backend/app/Services/Analysis/EstimationService.php` — Uses `HadesBridgeService::buildSourceSpec()`
- `backend/app/Services/Analysis/PredictionService.php` — Same fix
- `backend/app/Services/Analysis/SccsService.php` — Same fix

## What's Next

### Immediate
- Test Prediction (PatientLevelPrediction) and SCCS analyses on Acumenus CDM
- Update prediction.R and sccs.R to v6 API patterns
- Enable propensity score matching in estimation (PS-adjusted HR)

### Results Explorer (Phase 3)
- Forest plots, Kaplan-Meier curves, Love plots, attrition diagrams
- Per `docs/parthenon-results-explorer-prompt.md`
