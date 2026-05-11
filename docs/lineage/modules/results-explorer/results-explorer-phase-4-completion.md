# Results Explorer Phase 4 — Visualization Completion

**Date:** 2026-03-07
**Session:** Afternoon continuation
**Scope:** Complete all remaining Results Explorer visualization gaps across Estimation, Prediction, Characterization, Cohort Diagnostics, and Study Registry modules

---

## Summary

This session completed the Results Explorer visualization layer — the native React replacement for OHDSI's R Shiny results viewer. All visualizations are custom SVG components following the dark clinical design system, with no external charting library dependencies.

## Architecture Decision: JSONB over FastAPI

The original Results Explorer prompt proposed a full FastAPI microservice with 40+ endpoints, 20+ database tables, and a separate Python results service. We rejected this in favor of completing the existing JSONB architecture:

- **Results live in `analysis_executions.result_json`** — a single JSONB column per execution
- **Frontend components conditionally render** based on which fields are present in the JSON
- **No new backend endpoints needed** — the R runtime populates the JSONB on execution completion
- **Simpler to maintain** — one column vs 20+ normalized tables

This approach is sufficient for the current scale and can be migrated to a dedicated results service later if needed.

## What Was Built

### Phase A — Estimation Module (3 components)

| Component | File | Purpose |
|-----------|------|---------|
| `SystematicErrorPlot` | `estimation/components/SystematicErrorPlot.tsx` | Funnel plot for negative control calibration — plots log(RR) vs SE with 95% confidence funnel bounds |
| `PowerTable` | `estimation/components/PowerTable.tsx` | Sortable MDRR table with color-coded bars (green <2.0, gold 2.0-4.0, red >4.0) and power columns |
| `SccsTimeline` | `estimation/components/SccsTimeline.tsx` | Horizontal era-based timeline SVG with colored blocks by era type and IRR annotations |

All three wired into `EstimationResults.tsx` with conditional rendering on `result.negative_controls`, `result.power_analysis`, and `result.eras`.

### Phase B — Prediction Module (4 components)

| Component | File | Purpose |
|-----------|------|---------|
| `PrecisionRecallCurve` | `prediction/components/PrecisionRecallCurve.tsx` | 400×400 SVG PR curve with AUPRC annotation and filled area |
| `DiscriminationBoxPlot` | `prediction/components/DiscriminationBoxPlot.tsx` | Two horizontal box plots (outcome vs no-outcome) showing predicted probability distribution |
| `NetBenefitCurve` | `prediction/components/NetBenefitCurve.tsx` | Decision curve analysis with Model, Treat All, Treat None lines |
| `PredictionDistribution` | `prediction/components/PredictionDistribution.tsx` | Stacked histogram of predicted probabilities by outcome status |

All four wired into `PredictionResults.tsx` in two 2-column grids between the ROC/Calibration section and Top Predictors table.

### Phase C — Characterization Module

- **LovePlot integration** in `CharacterizationResults.tsx` — when a comparator cohort is present, SMD is computed from target vs comparator feature proportions using the binary proportion formula: `SMD = (p1 - p2) / sqrt((p1(1-p1) + p2(1-p2)) / 2)`. The existing `LovePlot` component from the estimation module is reused.

### Phase D — Cohort Diagnostics Module

**New component:** `CohortDiagnosticsPanel.tsx` — a full diagnostics panel that calls the existing `POST /api/v1/cohort-definitions/{id}/diagnostics` endpoint (backed by `CohortDiagnosticsService.php`).

Visualizations:
- **Cohort counts** — distinct persons and total records in metric cards
- **Visit context bar chart** — horizontal bars showing visit type distribution at index date
- **Age-at-index histogram** — SVG bar chart with 10-year age groups
- **Observation time IQR cards** — median days before/after index with interquartile range

Wired into the Diagnostics tab of `CohortDefinitionDetailPage.tsx`, above the existing CohortGenerationPanel.

### Phase E — Study Registry

Already fully implemented with 12 components, 3 pages, hooks, API, and types:
- `StudyResultsTab` — paginated results with type filtering, publishable/primary flags, evidence synthesis creation
- `StudyDashboard` — execution progress bar with status cards
- `StudySitesTab`, `StudyTeamTab`, `StudyMilestonesTab`, `StudyArtifactsTab`, etc.

No additional work needed.

## Remaining: ExternalValidationComparison

The one deferred component — will be implemented immediately after this devlog.

### Plan

**Purpose:** Visualize how a prediction model trained on one database performs when validated against external databases. Standard OHDSI PLP external validation workflow.

**Data source:** `PredictionResult.external_validation` — array of `ValidationMetrics[]`:
```ts
interface ValidationMetrics {
  database_name: string;
  auc: number;
  auc_ci_lower: number;
  auc_ci_upper: number;
  brier_score: number;
  calibration_slope: number;
  calibration_intercept: number;
  population_size: number;
  outcome_count: number;
}
```

**Component design — two sections:**

1. **AUC Forest Plot (SVG):**
   - Each row = one database (development + externals)
   - Horizontal axis: AUC 0.5–1.0
   - Diamond at AUC point, whisker line for 95% CI
   - Development highlighted in teal, externals in gold
   - Vertical dashed line at AUC = 0.5

2. **Metrics Comparison Table:**
   - Columns: Database, Population, Outcomes, AUC (95% CI), Brier, Cal. Slope, Cal. Intercept
   - Development row highlighted with teal left-border
   - Color-coding: AUC ≥ 0.7 teal, 0.6–0.7 gold, < 0.6 crimson
   - Cal. slope near 1.0 (0.8–1.2) teal, otherwise gold/crimson

**Wiring:** Conditionally rendered in `PredictionResults.tsx` when `result.external_validation` exists.

**No backend changes needed** — types and JSONB field already defined.

## Type Extensions (from prior session)

Added to `estimation.ts`:
- `NegativeControlOutcome` — for SystematicErrorPlot
- `PowerEntry` — for PowerTable
- `negative_controls` and `power_analysis` optional fields on `EstimationResult`

Added to `prediction.ts`:
- `BoxPlotStats` — for DiscriminationBoxPlot
- `ValidationMetrics` — for ExternalValidationComparison
- `precision_recall_curve`, `discrimination`, `net_benefit`, `prediction_distribution`, `external_validation`, `auprc` optional fields on `PredictionResult`

Added to `sccs.ts`:
- `SccsEra` — for SccsTimeline
- `eras` optional field on `SccsResult`

## Design System

All components follow the established dark clinical theme:
- **Backgrounds:** `#151518` card, `#0E0E11` inset, `#0E0E11` legend
- **Borders:** `#232328` default, `#323238` plot boundary
- **Grid lines:** `#232328` at 0.5 opacity
- **Text:** `#F0EDE8` primary, `#C5C0B8` secondary, `#8A857D` muted, `#5A5650` ghost
- **Data colors:** `#2DD4BF` teal (positive/primary), `#C9A227` gold (neutral/warning), `#E85A6B` crimson (negative/danger)
- **Monospace:** `font-['IBM_Plex_Mono',monospace]` for all numeric values
- **SVG:** All charts are hand-crafted SVG with `role="img"` and `aria-label` for accessibility

## Files Changed

### New Files
- `frontend/src/features/estimation/components/SystematicErrorPlot.tsx`
- `frontend/src/features/estimation/components/PowerTable.tsx`
- `frontend/src/features/estimation/components/SccsTimeline.tsx`
- `frontend/src/features/prediction/components/PrecisionRecallCurve.tsx`
- `frontend/src/features/prediction/components/DiscriminationBoxPlot.tsx`
- `frontend/src/features/prediction/components/NetBenefitCurve.tsx`
- `frontend/src/features/prediction/components/PredictionDistribution.tsx`
- `frontend/src/features/cohort-definitions/components/CohortDiagnosticsPanel.tsx`

### Modified Files
- `frontend/src/features/estimation/components/EstimationResults.tsx` — wired SystematicErrorPlot + PowerTable
- `frontend/src/features/estimation/types/estimation.ts` — added NegativeControlOutcome, PowerEntry types
- `frontend/src/features/prediction/components/PredictionResults.tsx` — wired 4 new chart components
- `frontend/src/features/prediction/types/prediction.ts` — added BoxPlotStats, ValidationMetrics types
- `frontend/src/features/sccs/components/SccsResults.tsx` — wired SccsTimeline
- `frontend/src/features/sccs/types/sccs.ts` — added SccsEra type
- `frontend/src/features/analyses/components/CharacterizationResults.tsx` — added LovePlot with SMD computation
- `frontend/src/features/cohort-definitions/pages/CohortDefinitionDetailPage.tsx` — wired CohortDiagnosticsPanel

## Commits

1. `feat: wire Results Explorer Phase 4 visualizations into result pages` — PredictionResults + SccsResults wiring
2. `feat: Results Explorer Phase C/D — LovePlot in characterization, cohort diagnostics panel` — CharacterizationResults + CohortDiagnosticsPanel

## What's Next

1. Implement `ExternalValidationComparison.tsx` (this session, next task)
2. Pathway Analysis module (treatment sequence sunburst/sankey — future phase)
3. Populate JSONB with real R runtime output as analyses are executed
