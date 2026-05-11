# HOW-TO: Demo the Results Explorer

This guide walks through demoing every Results Explorer visualization in Parthenon. Since the R runtime produces these results during real analysis execution, we use an Artisan command to seed realistic demo data into `analysis_executions.result_json`.

---

## Prerequisites

1. Parthenon is deployed and accessible at `https://parthenon.acumenus.net` (or `http://localhost:8082`)
2. Admin user exists (`php artisan admin:seed`)
3. Sample analyses are seeded (`php artisan db:seed` runs `AnalysisSeeder`)
4. At least one data source configured (EUNOMIA or Acumenus CDM)

## Step 1: Seed Demo Results

Run the demo results seeder:

```bash
docker compose exec php php artisan results:seed-demo
```

This creates `analysis_executions` with `status=completed` and realistic `result_json` for each analysis type:

| Analysis Type | Visualizations Rendered |
|---------------|----------------------|
| **Estimation** | Forest Plot, KM Curves, PS Distribution, Love Plot, Attrition Diagram, Systematic Error Plot, Power Table, Effect Estimates Table |
| **Prediction** | ROC Curve, Calibration Plot, Precision-Recall Curve, Discrimination Box Plot, Decision Curve Analysis, Prediction Distribution, External Validation Comparison, Top Predictors Table |
| **Characterization** | Feature Comparison Tables (6 domain tabs), Covariate Balance Love Plot (with comparator) |
| **Incidence Rate** | Incidence Rate Table (expandable strata), Forest Plot |
| **SCCS** | IRR Estimates Table, Risk Window Timeline |
| **Cohort Diagnostics** | Visit Context Bar Chart, Age-at-Index Histogram, Observation Time IQR Cards, Cohort Counts |

## Step 2: Demo Walkthrough

### 2.1 — Population-Level Estimation

1. Navigate to **Analyses** in the sidebar
2. Click on **"Statin Effect on CAD Outcomes"** or **"ACE-I vs ARB for Hypertension"**
3. The results tab shows:

| Section | What to Point Out |
|---------|-------------------|
| **Summary Cards** | Target/comparator counts, outcome counts |
| **Forest Plot** | Hazard ratios with 95% CI on log scale; hover for tooltips |
| **Effect Estimates Table** | Color-coded HRs (teal = protective, crimson = harmful), p-values highlighted when significant |
| **PS Diagnostics** | AUC, mean/max SMD before vs after matching |
| **PS Distribution** | Mirrored histogram showing target/comparator overlap |
| **Kaplan-Meier Curves** | Survival curves with confidence bands for target (teal) and comparator (gold) |
| **Love Plot** | Before (crimson) vs after (teal) matching SMD scatter; vertical threshold at 0.1 |
| **Attrition Diagram** | Step-by-step cohort narrowing with counts |
| **Systematic Error Plot** | Funnel plot with negative controls — points should fall within the 95% funnel if no systematic bias |
| **Power Table** | MDRR per outcome with color bars (green <2.0, gold 2.0–4.0, red >4.0) |

**Key talking point:** "Every diagnostic an OHDSI researcher needs — PS balance, empirical calibration, statistical power — all in one view without switching to R Shiny."

### 2.2 — Patient-Level Prediction

1. Navigate to **Analyses** > **"CKD Progression Risk Model"** or **"Heart Failure Readmission Risk"**
2. The results tab shows:

| Section | What to Point Out |
|---------|-------------------|
| **Performance Cards** | AUC with CI, Brier score, calibration slope/intercept |
| **Population Summary** | Target population, outcome count, outcome rate |
| **ROC Curve** | Custom SVG with AUC annotation and filled area under curve |
| **Calibration Plot** | Observed vs predicted with ideal line; slope near 1.0 = well calibrated |
| **Precision-Recall Curve** | Important for imbalanced outcomes (low outcome rate); AUPRC annotation |
| **Discrimination Box Plot** | Predicted probability distributions — outcome group should shift right |
| **Decision Curve Analysis** | Net benefit — model line should be above "Treat All" and "Treat None" |
| **Prediction Distribution** | Stacked histogram — well-separated colors = good discrimination |
| **External Validation** | AUC forest plot across databases + metrics comparison table; DEV row highlighted in teal |
| **Top Predictors** | Coefficient direction (crimson = risk, teal = protective), importance bars |

**Key talking point:** "Nine visualization types for a single prediction model — from discrimination to clinical utility — all rendered as lightweight SVG, no Shiny server required."

### 2.3 — Characterization

1. Navigate to **Analyses** > **"T2DM Patient Characterization"**
2. The results tab shows:

| Section | What to Point Out |
|---------|-------------------|
| **Summary Header** | Cohort names with person counts, CSV download button |
| **Love Plot** | Appears when comparator cohort is present — SMD computed from feature proportions |
| **Feature Tabs** | Demographics, Conditions, Drugs, Procedures, Measurements, Visits |
| **Feature Table** | Side-by-side comparison with count, percent, and inline SMD bar |

**Key talking point:** "Compare two cohorts across six clinical domains with automatic SMD calculation and the familiar OHDSI Love Plot."

### 2.4 — Incidence Rate

1. Navigate to **Analyses** > **"New-Onset CKD in T2DM Patients"**
2. The results tab shows:

| Section | What to Point Out |
|---------|-------------------|
| **Summary Table** | Expandable rows — click chevron to see age/gender strata |
| **Forest Plot** | IR per 1,000 PY with confidence intervals |
| **Strata Details** | Indented rows showing stratified rates |

### 2.5 — Self-Controlled Case Series (SCCS)

1. Navigate to **Analyses** > **"NSAID Exposure and GI Bleeding"**
2. The results tab shows:

| Section | What to Point Out |
|---------|-------------------|
| **Population Summary** | Cases, outcomes, observation periods |
| **IRR Table** | Incidence Rate Ratios with CI, color-coded (crimson >1 = risk, teal <1 = protective) |
| **Risk Window Timeline** | Horizontal timeline showing exposure eras, risk windows, and IRR annotations |

### 2.6 — Cohort Diagnostics

1. Navigate to **Cohort Definitions** > click any cohort > **Diagnostics** tab
2. Click **"Run Diagnostics"** button
3. The panel shows:

| Section | What to Point Out |
|---------|-------------------|
| **Cohort Counts** | Distinct persons and total records |
| **Observation Time** | Median days before/after index with IQR |
| **Visit Context** | Bar chart of visit types at index date (inpatient, outpatient, ER, etc.) |
| **Age at Index** | Histogram of age distribution in 10-year bins |

**Key talking point:** "SQL-based diagnostics — no R required. Instant feedback on cohort quality."

### 2.7 — Study Registry

1. Navigate to **Studies** > click any study
2. Walk through the tabs:

| Tab | What to Demo |
|-----|--------------|
| **Dashboard** | Execution progress bar, status cards (pending/running/completed/failed) |
| **Cohorts** | Cohorts assigned to the study |
| **Analyses** | Linked analyses with execution status badges |
| **Results** | Filterable results list, publishable/primary flags, expandable details |
| **Synthesize** | Select 2+ results → choose meta-analysis method → create synthesis |
| **Sites** | Multi-site study management |
| **Team** | Team member management |
| **Milestones** | Study timeline tracking |

## Step 3: Design System Highlights

During the demo, point out:

- **All charts are custom SVG** — no D3, Recharts, or external charting library
- **Dark clinical theme** — designed for long viewing sessions in clinical research environments
- **Monospace numbers** — IBM Plex Mono for all quantitative data
- **Consistent color language** — teal (#2DD4BF) = good/primary, gold (#C9A227) = moderate/warning, crimson (#E85A6B) = concerning/danger
- **Accessible** — all SVGs have `role="img"` and `aria-label`, tooltips on bars/points
- **Responsive** — `overflow-x-auto` wrappers on all charts, 2-column grids collapse on mobile
- **Conditional rendering** — components only appear when the JSONB data includes the relevant fields

## Appendix A: Creating the Demo Seeder

If `results:seed-demo` doesn't exist yet, create it:

```bash
php artisan make:command SeedDemoResults
```

The command should:
1. Find each analysis type by name (from `AnalysisSeeder`)
2. Create an `AnalysisExecution` with `status=completed`
3. Populate `result_json` with realistic synthetic data matching the TypeScript interfaces

See the TypeScript type definitions for the exact JSONB structure:
- `frontend/src/features/estimation/types/estimation.ts` → `EstimationResult`
- `frontend/src/features/prediction/types/prediction.ts` → `PredictionResult`
- `frontend/src/features/analyses/types/analysis.ts` → `CharacterizationResult`, `IncidenceRateResult`
- `frontend/src/features/sccs/types/sccs.ts` → `SccsResult`

## Appendix B: Quick Screenshots Checklist

For documentation or pitch decks, capture these views:

- [ ] Estimation: Forest Plot + KM curves side by side
- [ ] Estimation: Love Plot showing before/after matching improvement
- [ ] Estimation: Systematic Error funnel plot
- [ ] Prediction: ROC + Calibration 2-column layout
- [ ] Prediction: Decision Curve + Prediction Distribution
- [ ] Prediction: External Validation forest plot + table
- [ ] Characterization: Love Plot + feature comparison table
- [ ] SCCS: Risk Window Timeline
- [ ] Cohort Diagnostics: Age histogram + visit context
- [ ] Study: Dashboard with progress bar

## Appendix C: Component File Map

```
frontend/src/features/
├── estimation/components/
│   ├── ForestPlot.tsx              ← HR forest plot (log scale)
│   ├── KaplanMeierPlot.tsx         ← Survival curves with CI bands
│   ├── PropensityScorePlot.tsx     ← PS distribution histogram
│   ├── LovePlot.tsx                ← Covariate balance scatter
│   ├── AttritionDiagram.tsx        ← Cohort attrition funnel
│   ├── SystematicErrorPlot.tsx     ← Negative control funnel plot
│   ├── PowerTable.tsx              ← MDRR table with power bars
│   ├── SccsTimeline.tsx            ← Risk window timeline
│   └── EstimationResults.tsx       ← Orchestrator (wires all above)
├── prediction/components/
│   ├── RocCurve.tsx                ← ROC with AUC annotation
│   ├── CalibrationPlot.tsx         ← Observed vs predicted
│   ├── PrecisionRecallCurve.tsx    ← PR curve with AUPRC
│   ├── DiscriminationBoxPlot.tsx   ← Box plots by outcome status
│   ├── NetBenefitCurve.tsx         ← Decision curve analysis
│   ├── PredictionDistribution.tsx  ← Stacked probability histogram
│   ├── ExternalValidationComparison.tsx ← AUC forest + metrics table
│   └── PredictionResults.tsx       ← Orchestrator (wires all above)
├── analyses/components/
│   ├── CharacterizationResults.tsx ← Feature tables + Love Plot
│   └── IncidenceRateResults.tsx    ← IR table + forest plot
├── sccs/components/
│   └── SccsResults.tsx             ← IRR table + timeline
├── cohort-definitions/components/
│   └── CohortDiagnosticsPanel.tsx  ← Visit/age/time diagnostics
└── studies/components/
    ├── StudyDashboard.tsx           ← Progress tracking
    └── StudyResultsTab.tsx          ← Results + synthesis
```
