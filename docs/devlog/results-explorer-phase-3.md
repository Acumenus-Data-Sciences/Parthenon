# Results Explorer — Phase 3: React Visualization Components

**Date:** 2026-03-06
**Scope:** Replace OHDSI R Shiny results layer with native React visualizations

## What Was Built

### 1. Kaplan-Meier Survival Curves (`KaplanMeierPlot.tsx`)

Custom SVG step-function survival curve component:
- Dual-arm display (target vs. comparator) with confidence bands
- Step-function rendering (true KM curves, not smoothed lines)
- Censor marks (small vertical ticks)
- Number-at-risk table below the chart (aligned with x-axis ticks)
- Log-rank p-value display
- Configurable time units (days, months, years)
- Legend with color-coded arms

### 2. Attrition Diagram (`AttritionDiagram.tsx`)

Side-by-side patient flow visualization:
- Target and comparator columns shown in parallel
- Each box shows step description + count (N = formatted)
- Exclusion boxes with red dashed connectors showing patients removed
- Arrows between steps with directional indicators
- Color-coded: teal for target, gold for comparator, red for exclusions

### 3. Propensity Score Distribution (`PropensityScorePlot.tsx`)

Overlapping density plot:
- Target and comparator PS distributions as filled area charts
- Semi-transparent overlapping fills for visual comparison
- PS AUC annotation in legend
- X-axis from 0 to 1 (propensity score range)

### 4. Love Plot (`LovePlot.tsx`)

Covariate balance scatter plot — the signature OHDSI visualization:
- X-axis: absolute standardized mean difference
- Each row = one covariate (before and after matching)
- Open circles (red) = before matching, filled circles (teal) = after matching
- Connecting lines between before/after for each covariate
- Dashed threshold line at |SMD| = 0.1
- SVG title tooltips on hover showing covariate name + SMD values

### 5. Enhanced Estimation Results Page

Wired all new components into `EstimationResults.tsx`:
- Summary cards (target, comparator, outcome counts)
- **Forest Plot** (existing — custom SVG)
- **Estimates Table** (existing — HR, CI, p-value)
- **PS Diagnostics** — updated to support both old and new R result formats
- **PS Distribution Plot** — NEW (from propensity_score.distribution)
- **Kaplan-Meier Curves** — NEW (from kaplan_meier.target/comparator)
- **Attrition Diagram** — NEW (from attrition steps)
- **Love Plot** — NEW (from covariate_balance)
- **Covariate Balance Table** — NEW (top 30 covariates with SMD before/after + visual bars)
- **Diagnostics** — updated (equipoise, MDRR, power)

### 6. R Pipeline Enhancements

- `estimation.R`: Added outcome name resolution from spec (backend sends `outcome_names` map)
- `estimation.R`: Aligned R output field names with frontend types (`target_outcomes`, `comparator_outcomes`, `log_hr`, `se_log_hr`)
- Backend `EstimationService.php`: Resolves outcome cohort names from CohortDefinition table before sending to R

### 7. Types Updated

- `estimation.ts`: Added `KaplanMeierPoint`, `KaplanMeierData`, `AttritionStep`, `PSDistPoint`, `CovariateBalanceEntry` interfaces
- `EstimationResult`: Extended with `covariate_balance`, `kaplan_meier`, `attrition`, `mdrr` fields
- `propensity_score`: Updated to support both flat (new R format) and nested (legacy) SMD fields

## Architecture Decision

The spec document (`parthenon-results-explorer-prompt.md`) proposed a separate FastAPI results service with dedicated database tables. Instead, we took a pragmatic approach:

- Results are already stored in `analysis_executions.result_json` (JSONB)
- The R pipeline already extracts all necessary data (KM, attrition, PS, balance)
- No new database tables, no new API endpoints, no Python service changes needed
- All visualizations render from the existing result JSON

This eliminates an entire layer of complexity while delivering the same user-facing functionality.

## Component Inventory

| Component | Type | Lines | Description |
|-----------|------|-------|-------------|
| `ForestPlot.tsx` | Custom SVG | 261 | Effect estimates with log-scale CI (existing) |
| `KaplanMeierPlot.tsx` | Custom SVG | 280 | Survival curves with number-at-risk table |
| `AttritionDiagram.tsx` | Custom SVG | 170 | Side-by-side patient flow |
| `PropensityScorePlot.tsx` | Custom SVG | 175 | PS distribution density overlap |
| `LovePlot.tsx` | Custom SVG | 185 | Covariate balance scatter |
| `RocCurve.tsx` | Custom SVG | 175 | ROC with AUC (existing, prediction) |
| `CalibrationPlot.tsx` | Custom SVG | 185 | Predicted vs observed (existing, prediction) |

All 7 visualization components are pure custom SVG — no external charting library dependencies. They follow the dark clinical theme consistently: #151518 background, #232328 borders, teal/gold/crimson accent colors, IBM Plex Mono for numeric values.

## Files Created
- `frontend/src/features/estimation/components/KaplanMeierPlot.tsx`
- `frontend/src/features/estimation/components/AttritionDiagram.tsx`
- `frontend/src/features/estimation/components/PropensityScorePlot.tsx`
- `frontend/src/features/estimation/components/LovePlot.tsx`

## Files Modified
- `frontend/src/features/estimation/components/EstimationResults.tsx` — wired all new components
- `frontend/src/features/estimation/types/estimation.ts` — added new type interfaces
- `r-runtime/api/estimation.R` — outcome names + aligned field names
- `backend/app/Services/Analysis/EstimationService.php` — resolve outcome names

## What's Next

### Immediate
- Run an estimation with PS matching on Acumenus CDM to generate full results (KM, attrition, balance)
- Visual verification of all components with real data

### Phase 3 Remaining
- SCCS results visualization (era-based timeline)
- Evidence synthesis meta-analysis forest plot (diamond for pooled estimates)
- Prediction model comparison view
- CSV export for all result tables
- Print-friendly mode (hide interactive controls)
