# Analyses Hardening Audit

Date: 2026-03-14

## Frontend route inventory

- `/analyses`
  - `AnalysesPage`
  - Cross-type list page for characterization, incidence rate, pathways, estimation, prediction, SCCS, evidence synthesis
- `/analyses/characterizations/:id`
  - `CharacterizationDetailPage`
  - Subpanels: `CharacterizationDesigner`, `CharacterizationResults`, `CharacterizationVerdictDashboard`, `FeatureComparisonTable`
- `/analyses/incidence-rates/:id`
  - `IncidenceRateDetailPage`
  - Subpanels: `IncidenceRateDesigner`, `IncidenceRateResults`, `IncidenceRateVerdictDashboard`
- `/analyses/pathways/:id`
  - `PathwayDetailPage`
- `/analyses/estimations/:id`
  - `EstimationDetailPage`
  - Subpanels: `EstimationDesigner`, `EstimationResults`, `EstimationVerdictDashboard`, `ForestPlot`, `KaplanMeierPlot`, `LovePlot`, `PowerTable`, `PropensityScorePlot`, `SystematicErrorPlot`
- `/analyses/predictions/:id`
  - `PredictionDetailPage`
  - Subpanels: `PredictionDesigner`, `PredictionResults`, `PredictionVerdictDashboard`, `CalibrationPlot`, `DiscriminationBoxPlot`, `ExternalValidationComparison`, `NetBenefitCurve`, `PrecisionRecallCurve`, `PredictionDistribution`, `RocCurve`
- `/analyses/sccs/:id`
  - `SccsDetailPage`
- `/analyses/evidence-synthesis/:id`
  - `EvidenceSynthesisDetailPage`

## Current failure pattern

Most crashes so far fall into one of four buckets:

- `result_json` arrays or nested objects are missing on historical executions
- design JSON is partially populated on older analyses
- special-case routes are treated like normal resources
- route errors fall through to the React Router default boundary, which hides context

## Backend payload-normalization status

- `EstimationController::showExecution`
  - already normalizes `result_json` via `EstimationResultNormalizer`
- `CharacterizationController::showExecution`
  - returns raw `result_json`
- `IncidenceRateController::showExecution`
  - returns raw `result_json`
- `PredictionController::showExecution`
  - returns raw `result_json`
- `SccsController::showExecution`
  - returns raw `result_json`
- `EvidenceSynthesisController::showExecution`
  - returns raw `result_json`

This means the frontend is still responsible for defensive handling for every non-estimation analysis type.

## Highest-risk frontend boundaries

- Detail pages that auto-select the latest completed execution and immediately render results
- Result containers that deserialize `execution.result_json` directly
- Shared chart/table components that assume string or array fields exist
- Designers that reconstruct state from partially-populated `design_json`
- Cohort-definition subcomponents embedded inside analysis designers

## Recommended hardening order

1. Add per-route `errorElement` coverage for all analysis detail pages.
2. Introduce backend normalizers for characterization, incidence rate, prediction, SCCS, and evidence synthesis execution payloads.
3. Introduce one frontend adapter per analysis result type so components never render raw `result_json`.
4. Add fixture-based regression tests for:
   - current payload
   - historical payload
   - completed execution with missing arrays
   - failed execution
   - empty result payload
5. Audit analysis designers for partial `design_json` handling and normalize on load.

## Immediate next targets

- Add `CharacterizationResultNormalizer` on backend read/write paths
- Add `IncidenceRateResultNormalizer` on backend read/write paths
- Add `PredictionResultNormalizer` on backend read/write paths
- Add detail-page execution guards where missing `execution.result_json` still reaches results components
- Add route-level tests for analysis error boundaries once the frontend TypeScript baseline is cleaned up
