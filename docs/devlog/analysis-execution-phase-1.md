# Analysis Execution — Phase 1: First Live Results

**Date:** 2026-03-07
**Scope:** End-to-end analysis execution on the Acumenus CDM (1M patients, PostgreSQL 17)

## What Was Built

### 1. Cohort Generation Command (`cohorts:generate`)

**File:** `backend/app/Console/Commands/GenerateCohortsCommand.php`

An Artisan command that generates clinically meaningful cohorts directly from OMOP CDM data:

```bash
php artisan cohorts:generate --source=ACUMENUS --fresh
```

**Features:**
- Interactive source selector (or `--source=KEY` flag)
- Auto-creates `{results_schema}.cohort` table if missing (with indexes)
- Generates condition-based cohorts (first diagnosis + 365d prior observation)
- Generates drug-based cohorts (first exposure via `concept_ancestor` hierarchy)
- Records `CohortGeneration` entries for each cohort/source pair
- `--fresh` flag to clear and regenerate

**Cohorts generated on Acumenus CDM:**

| Cohort | Concept(s) | Subjects |
|--------|-----------|----------|
| Essential Hypertension | 320128 | 141,655 |
| Ischemic Heart Disease | 319844, 4185932, 315286 | 70,874 |
| Type 2 Diabetes Mellitus | 201826, 443238 | 28,237 |
| Lisinopril Users | 1308216 (ingredient + descendants) | 100,271 |
| Acute Myocardial Infarction | 4329847, 312327, 434376 | 9,518 |

### 2. First Successful Analysis Execution

**IHD Incidence in Hypertensive Patients** — completed in 3 seconds:

| Outcome | Persons at Risk | Events | Person-Years | IR per 1000 PY |
|---------|----------------|--------|-------------|-----------------|
| Ischemic Heart Disease | 141,359 | 44,035 | 2,714,970 | 16.22 |
| Acute MI | 141,359 | 6,604 | 3,269,302 | 2.02 |

Gender stratification:
- IHD: Males 19.0/1000 PY vs Females 12.8/1000 PY
- AMI: Males 2.4/1000 PY vs Females 1.5/1000 PY

**AMI Incidence in Type 2 Diabetics** — age-stratified results:

| Age Group | IR per 1000 PY |
|-----------|----------------|
| 18-34 | 2.21 |
| 35-49 | 3.85 |
| 50-64 | 6.53 |
| 65+ | 8.95 |

### 3. Full Pipeline Verified

The complete execution path works end-to-end:

```
Frontend "Execute" button
  → POST /api/v1/incidence-rates/{id}/execute {source_id: 9}
    → IncidenceRateController::execute()
      → Creates AnalysisExecution (status: queued)
      → Dispatches RunIncidenceRateJob to Horizon 'analysis' queue
        → IncidenceRateService::execute()
          → Resolves source daimons (omop/omop/achilles_results)
          → Builds incidence rate SQL with stratification
          → Executes against 'cdm' connection (pgsql.acumenus.net:5432/ohdsi)
          → Applies min cell count masking
          → Stores result_json
        → Status: completed
```

Verified both synchronous execution (tinker) and queue-based execution (Horizon).

## Architecture Inventory (Post-Research)

The existing infrastructure is more complete than initially estimated:

| Component | Status | Notes |
|-----------|--------|-------|
| Analysis Models (7 types) | Complete | Polymorphic executions via MorphMany |
| Analysis Controllers | Complete | Full CRUD + execute + executions endpoints |
| Analysis Services | Complete | IR/Pathway = pure SQL; Estimation/Prediction/SCCS = R sidecar |
| Job Classes (7) | Complete | SQL jobs on 'analysis' queue (1h), R jobs on 'r-analysis' queue (4h) |
| HadesBridgeService | Complete | Formats source spec for R Plumber study bridge |
| RService | Complete | HTTP client to R Plumber at r-runtime:8787 |
| Frontend Execute UI | Complete | Execute buttons, source selector, status polling, results display |
| Cohort Generation | **NEW** | `cohorts:generate` command |
| Cohort Table | **NEW** | Auto-created in results schema |

## What's Next

### Immediate (Phase 2: R-Backed Analyses)
- Fix source spec format mismatch in EstimationService/PredictionService/SccsService (send DB credentials, not Laravel connection name)
- Fix R runtime connectivity to PG17 (add `extra_hosts` to docker-compose for host.docker.internal)
- Execute Estimation analysis (CohortMethod) on Acumenus CDM
- Execute Characterization (SQL-based, should work now)

### Results Explorer (Phase 3: per `docs/parthenon-results-explorer-prompt.md`)
- Forest plots, Kaplan-Meier curves, Love plots, attrition diagrams
- Replace R Shiny results viewer with native React components
- Study registry and cross-study comparison

## Files Created/Modified
- `backend/app/Console/Commands/GenerateCohortsCommand.php` — NEW: cohort generation command
- `docs/devlog/analysis-execution-phase-1.md` — NEW: this devlog
