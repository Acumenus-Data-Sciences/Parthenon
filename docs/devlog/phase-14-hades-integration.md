# Phase 14 — HADES R Package Integration for Full PLE/PLP Parity

**Date:** 2026-03-03
**Branch:** master

---

## Summary

Full implementation of OHDSI HADES package integration, replacing all R sidecar stubs with real CohortMethod, PatientLevelPrediction, SelfControlledCaseSeries, and EvidenceSynthesis pipelines. Added two entirely new analysis types (SCCS and Evidence Synthesis) end-to-end — backend models, services, jobs, controllers, migrations, routes, and complete React frontend features with designers, results viewers, and detail pages.

Also extracted a shared `CovariateSettingsPanel` component with 12 FeatureExtraction domains (including comorbidity indices), upgraded both Estimation and Prediction designers with expanded capabilities, and added an SVG forest plot for meta-analysis results.

---

## Architecture

### R Sidecar — Before vs After

```
BEFORE (stubs):
  /stubs/estimation  → 501 "not implemented"
  /stubs/prediction  → 501 "not implemented"

AFTER (full HADES):
  /analysis/estimation/run        → CohortMethod 10-step pipeline
  /analysis/prediction/run        → PatientLevelPrediction full pipeline
  /analysis/sccs/run              → SelfControlledCaseSeries pipeline
  /analysis/evidence-synthesis/run → Meta-analysis (Bayesian RE / Fixed Effect)
```

### Docker — Two-Stage Build

```dockerfile
Stage 1 (hades-base): R 4.4 + Java + HADES packages + Python ML + JDBC driver
Stage 2 (runtime):    App code only (fast rebuilds)
```

HADES packages installed from OHDSI R-universe: DatabaseConnector, SqlRender, Cyclops, Andromeda, FeatureExtraction, CohortMethod, PatientLevelPrediction, SelfControlledCaseSeries, EvidenceSynthesis, and supporting packages.

### Shared R Infrastructure

| File | Purpose |
|------|---------|
| `R/connection.R` | DatabaseConnector wrapper, `%||%` null-coalescing operator |
| `R/covariates.R` | JSON → `createCovariateSettings()` mapper (100+ flags) |
| `R/progress.R` | Structured logger + `safe_execute()` error wrapper |
| `R/results.R` | Result serialization: KM data, PS distribution, balance, ROC, calibration, predictors |

---

## What Was Built

### Backend (Laravel)

**New Models:**
- `SccsAnalysis` — polymorphic executions, soft deletes, `design_json` cast
- `EvidenceSynthesisAnalysis` — same pattern, no source dependency

**New Services:**
- `SccsService` — resolves schemas, calls `RService::runSccs()`
- `EvidenceSynthesisService` — takes estimates from design_json, calls `RService::runEvidenceSynthesis()`

**New Jobs:**
- `RunSccsJob` — `r-analysis` queue, 14400s timeout, NotifiesOnCompletion
- `RunEvidenceSynthesisJob` — same pattern, no Source parameter

**New Controllers:**
- `SccsController` — full CRUD + execute + executions + showExecution
- `EvidenceSynthesisController` — full CRUD + execute (no source_id) + executions

**New Migrations:**
- `create_sccs_analyses_table` — id, name, description, design_json, author_id, timestamps, softDeletes
- `create_evidence_synthesis_analyses_table` — same schema

**Modified:**
- `RService` — endpoints changed from `/stubs/*` to `/analysis/*/run`, added `runSccs()` and `runEvidenceSynthesis()`, default timeout 7200s
- `EstimationController` — expanded validation: `poisson` model, PS methods (matching/stratification/iptw), caliper settings, negative controls, study period
- `PredictionController` — expanded validation: 9 model types, split settings (nFold, type), preprocess settings
- `config/services.php` — R timeout default 300 → 7200
- `routes/api.php` — added SCCS and Evidence Synthesis route groups

### R Runtime

**Rewrites:**
- `api/estimation.R` — Full CohortMethod pipeline: connect → covariates → extract data → PS fitting → matching/stratification/IPTW → balance → KM curves → outcome models (cox/logistic/poisson) → negative control calibration
- `api/prediction.R` — Full PLP pipeline: connect → covariates → extract → model config (9 types) → population → split → preprocess → runPlp → extract performance/ROC/calibration/predictors

**New:**
- `api/sccs.R` — SCCS pipeline: extract data → study population → era covariates → interval data → fit model → IRR estimates
- `api/evidence_synthesis.R` — Meta-analysis: fixed-effect or Bayesian random-effects, per-site + pooled estimates

**Infrastructure:**
- `docker/r/Dockerfile` — two-stage build with all HADES dependencies
- `plumber_api.R` — mounted `/analysis/sccs` and `/analysis/evidence-synthesis`

### Frontend (React/TypeScript)

**New Shared Component:**
- `CovariateSettingsPanel` — 12 covariate domains in 3 groups (core, extended, comorbidity indices) + time windows editor

**New SCCS Feature (6 files):**
- Types: `SccsDesign`, `RiskWindow`, `SccsResult`, `SccsEstimate`
- API + hooks following established patterns
- `SccsDesigner` — risk windows editor, model type selector (simple/age/season/age+season), population settings
- `SccsResults` — population summary cards + IRR estimates table with color-coded ratios
- `SccsDetailPage` — Design/Results tabs, source selector, execution history

**New Evidence Synthesis Feature (7 files):**
- Types: `SiteEstimate`, `PooledEstimate`, `PerSiteResult`, `EvidenceSynthesisResult`
- API + hooks (no source_id for execute — meta-analysis of existing results)
- `EvidenceSynthesisDesigner` — site estimates table with HR preview, method config (Bayesian chain/burn-in/subsample)
- `ForestPlot` — SVG forest plot with log-scale axis, per-site CIs, pooled diamond
- `EvidenceSynthesisResults` — pooled summary cards + forest plot + per-site table
- `EvidenceSynthesisDetailPage` — direct execute (no source needed)

**Enhanced Existing:**
- Estimation types: added `poisson` model, PS `method` field, `caliperScale`, `studyPeriod`
- Prediction types: added 6 model types (9 total), `nFold`, split `type`, `preprocessSettings`
- Both designers: replaced inline covariate sections with shared `CovariateSettingsPanel`
- EstimationDesigner: added PS method selector dropdown, poisson model option
- PredictionDesigner: all 9 PLP model types in selector
- Router: added `sccs/:id` and `evidence-synthesis/:id` routes

---

## Key Decisions

1. **Two-stage Docker build** — HADES packages take 15+ minutes to install; caching them in a base layer means app code changes rebuild in seconds
2. **CamelCase/snake_case harmonization** — R endpoints accept both conventions via `%||%` fallback chains, so existing frontend JSON and new backend specs both work
3. **No source for Evidence Synthesis** — meta-analysis operates on pre-collected estimates, not a CDM database, so execute() takes no source_id
4. **Shared CovariateSettingsPanel** — eliminated ~300 lines of duplication across estimation/prediction designers and provides a central place for future FeatureExtraction enhancements
5. **12 covariate domains** — expanded beyond the original 5-6 to include device exposure, visit counts, and 4 comorbidity indices (Charlson, DCSI, CHADS2, CHA2DS2-VASc)

---

## Verification

| Check | Result |
|-------|--------|
| `npx tsc --noEmit` | 0 errors |
| `npx vitest run` | 64/64 passed |
| `php artisan test` | 109/109 passed (905 assertions) |
| `npx vite build` | Successful (2.48s) |

---

## File Manifest

### New Files (28)

| Layer | File |
|-------|------|
| Docker | `docker/r/Dockerfile` (rewrite) |
| R | `r-runtime/R/connection.R` |
| R | `r-runtime/R/covariates.R` |
| R | `r-runtime/R/progress.R` |
| R | `r-runtime/R/results.R` |
| R | `r-runtime/api/estimation.R` (rewrite) |
| R | `r-runtime/api/prediction.R` (rewrite) |
| R | `r-runtime/api/sccs.R` |
| R | `r-runtime/api/evidence_synthesis.R` |
| Backend | `app/Models/App/SccsAnalysis.php` |
| Backend | `app/Models/App/EvidenceSynthesisAnalysis.php` |
| Backend | `app/Services/Analysis/SccsService.php` |
| Backend | `app/Services/Analysis/EvidenceSynthesisService.php` |
| Backend | `app/Jobs/Analysis/RunSccsJob.php` |
| Backend | `app/Jobs/Analysis/RunEvidenceSynthesisJob.php` |
| Backend | `app/Http/Controllers/Api/V1/SccsController.php` |
| Backend | `app/Http/Controllers/Api/V1/EvidenceSynthesisController.php` |
| Backend | `database/migrations/2026_03_03_200000_create_sccs_analyses_table.php` |
| Backend | `database/migrations/2026_03_03_200001_create_evidence_synthesis_analyses_table.php` |
| Frontend | `src/components/analysis/CovariateSettingsPanel.tsx` |
| Frontend | `src/features/sccs/types/sccs.ts` |
| Frontend | `src/features/sccs/api/sccsApi.ts` |
| Frontend | `src/features/sccs/hooks/useSccs.ts` |
| Frontend | `src/features/sccs/components/SccsDesigner.tsx` |
| Frontend | `src/features/sccs/components/SccsResults.tsx` |
| Frontend | `src/features/sccs/pages/SccsDetailPage.tsx` |
| Frontend | `src/features/evidence-synthesis/types/evidenceSynthesis.ts` |
| Frontend | `src/features/evidence-synthesis/api/evidenceSynthesisApi.ts` |
| Frontend | `src/features/evidence-synthesis/hooks/useEvidenceSynthesis.ts` |
| Frontend | `src/features/evidence-synthesis/components/EvidenceSynthesisDesigner.tsx` |
| Frontend | `src/features/evidence-synthesis/components/ForestPlot.tsx` |
| Frontend | `src/features/evidence-synthesis/components/EvidenceSynthesisResults.tsx` |
| Frontend | `src/features/evidence-synthesis/pages/EvidenceSynthesisDetailPage.tsx` |

### Modified Files (12)

| Layer | File | Change |
|-------|------|--------|
| R | `r-runtime/plumber_api.R` | Added SCCS + ES router mounts |
| Backend | `app/Services/RService.php` | New endpoints, runSccs/runES, timeout 7200 |
| Backend | `config/services.php` | R timeout 300 → 7200 |
| Backend | `app/Http/Controllers/Api/V1/EstimationController.php` | Expanded validation |
| Backend | `app/Http/Controllers/Api/V1/PredictionController.php` | Expanded validation |
| Backend | `routes/api.php` | Added SCCS + ES routes |
| Frontend | `src/features/estimation/types/estimation.ts` | Added poisson, PS method, studyPeriod |
| Frontend | `src/features/prediction/types/prediction.ts` | 9 model types, split/preprocess settings |
| Frontend | `src/features/estimation/components/EstimationDesigner.tsx` | Shared covariate panel, PS method, poisson |
| Frontend | `src/features/prediction/components/PredictionDesigner.tsx` | Shared covariate panel, 9 model types |
| Frontend | `src/app/router.tsx` | SCCS + ES routes |
