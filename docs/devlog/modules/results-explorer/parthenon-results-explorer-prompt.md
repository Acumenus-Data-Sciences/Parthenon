# Claude Code Implementation Prompt: Parthenon Results Explorer

## Replacing OHDSI's R Shiny / OpenShinyServer with a Native React + FastAPI Results Visualization Layer

---

## Project Context

**Parthenon** is Acumenus Data Sciences' open-source OHDSI/OMOP replacement platform — a single Docker Compose stack that consolidates the functionality of ATLAS, WebAPI, Strategus, HADES, Achilles, and the fragmented R Shiny results ecosystem into a unified Laravel 11 + React 19 + TypeScript + Python FastAPI application. The codebase lives at `github.com/sudoshi/parthenon`.

**The Problem We're Solving:** OHDSI relies on R Shiny (via OpenShinyServer, ShinyDeploy, OhdsiShinyModules, and ShinyAppBuilder) as its universal results visualization layer. Every completed study — cohort diagnostics, population characterization, effect estimation (CohortMethod, SCCS), patient-level prediction, incidence rates, and evidence synthesis — is viewed through standalone R Shiny applications deployed to `data.ohdsi.org` / `results.ohdsi.org`. This creates an R runtime dependency, a fragmented deployment model (dozens of independent R processes), limited frontend sophistication, and no unified platform experience.

**Our Solution:** Build a **React Results Explorer** — a modular, interactive results visualization system natively embedded in Parthenon's existing React 19 + TypeScript frontend, backed by Python FastAPI analytics API endpoints. This eliminates R entirely from the evidence exploration workflow while providing equivalent or superior interactive capabilities.

---

## Existing Tech Stack (Do Not Change)

| Layer | Technology |
|-------|-----------|
| **Backend API** | Laravel 11 (PHP 8.4) — routes, auth, Eloquent ORM, Inertia.js bridge |
| **Frontend** | React 19, TypeScript, Vite, TailwindCSS, Inertia.js |
| **AI/Analytics Service** | Python FastAPI + MedGemma (separate container) |
| **Analytics Engine** | R Plumber (HADES stubs — being phased out) |
| **Database** | PostgreSQL 17 with OMOP CDM v5.4 |
| **Infrastructure** | Docker Compose, Traefik reverse proxy |
| **State Management** | React hooks (useState, useReducer, useContext) |
| **Charting (existing)** | Recharts (already in package.json) |

### Key Architectural Constraints
- Inertia.js bridges Laravel and React — page components receive props from Laravel controllers
- TailwindCSS is the styling system — no CSS modules, no styled-components
- The FastAPI service runs as a separate Docker container, accessed via internal Docker networking
- PostgreSQL has both the OMOP CDM schema and a `results` schema for analytics outputs
- All new React components should be TypeScript (.tsx) with proper type definitions
- Follow existing code conventions: functional components, hooks, no class components

---

## What OHDSI's Shiny Layer Does (Functional Requirements to Replicate)

The following modules from `OhdsiShinyModules` must be replicated as React components backed by FastAPI endpoints. Each module corresponds to a tab/section in OHDSI's ShinyAppBuilder-generated viewer:

### Module 1: Cohort Diagnostics Explorer

**OHDSI Source:** `CohortDiagnostics` R package → `DiagnosticsExplorer` Shiny app

**Purpose:** Validate phenotype definitions before using them in studies. Lets researchers examine whether their cohort definitions capture the intended patient populations.

**Views to implement:**
1. **Cohort Counts** — Table showing cohort record counts across databases, with bar charts for visual comparison
2. **Incidence Rates** — Line/area charts showing incidence rates over time (per 1000 person-years), stratified by age/sex/calendar year
3. **Time Distributions** — Box plots or violin plots showing distribution of observation time, time-to-event
4. **Cohort Overlap** — Venn diagrams or UpSet plots showing overlap between cohort definitions
5. **Concept Set Diagnostics** — Treemaps or tables showing which vocabulary concepts are included/excluded, concept counts, orphan concepts, included source concepts
6. **Index Event Breakdown** — Stacked bar charts showing which events triggered cohort entry
7. **Visit Context** — Tables showing the visit types (inpatient, outpatient, ER) where cohort entries occur
8. **Cohort Characterization** — Large sortable/filterable tables of covariate means (demographics, conditions, drugs, procedures) with comparison columns across databases

**Data shape:** Results stored in PostgreSQL results schema. Tables include `cohort_count`, `incidence_rate`, `time_distribution`, `relationship_count`, `concept_sets`, `index_event_breakdown`, `visit_context`, `covariate_value`.

### Module 2: Characterization

**OHDSI Source:** `Characterization` R package, `CohortIncidence` R package

**Purpose:** Describe patient populations — baseline demographics, comorbidity profiles, medication history, lab distributions — before running comparative studies.

**Views to implement:**
1. **Covariate Balance Table** — Massive table (potentially 10,000+ rows) of covariates with mean values for target vs. comparator cohorts, with standardized mean difference (SMD). Must support virtual scrolling.
2. **Love Plot (Covariate Balance Scatter)** — Scatter plot with SMD on x-axis, covariates as dots, reference line at |SMD| = 0.1. Before vs. after matching comparison. This is a critical OHDSI visualization.
3. **Time-to-Event** — Kaplan-Meier curves comparing time-to-outcome across cohorts
4. **Incidence Summary Table** — Tabular summary of incidence rates with confidence intervals, stratified by subgroup
5. **Dechallenge-Rechallenge** — Table showing drug rechallenge outcomes

**Data shape:** `covariate_value`, `covariate_ref`, `cohort_incidence_rate`, `time_to_event`, `dechallenge_rechallenge` tables.

### Module 3: Effect Estimation (CohortMethod + SCCS + EvidenceSynthesis)

**OHDSI Source:** `CohortMethod`, `SelfControlledCaseSeries`, `EvidenceSynthesis` R packages

**Purpose:** Display results of causal inference analyses — hazard ratios, odds ratios, relative risks from new-user cohort studies and self-controlled designs.

**Views to implement:**
1. **Forest Plot** — THE signature OHDSI visualization. Horizontal forest plot showing effect estimates (HR/OR/RR) with 95% CIs across databases, with diamond for meta-analysis. Must support:
   - Multiple outcomes on y-axis
   - Grouped by database
   - Diamond shapes for pooled estimates
   - Reference line at HR = 1.0
   - Log scale x-axis
   - Hover tooltips with exact values
2. **Attrition Diagram** — Funnel/Sankey flow diagram showing how many patients were excluded at each step (initial cohort → age filter → prior observation → washout → matching → final)
3. **Propensity Score Distribution** — Overlapping histograms or density plots showing PS distribution for target vs. comparator, before and after matching
4. **Covariate Balance (before/after)** — Love plot (same as Module 2) showing balance improvement after PS matching
5. **Kaplan-Meier Plot** — Survival curves with number-at-risk table below
6. **Systematic Error (Calibration) Plot** — Scatter plot showing effect size vs. standard error for negative control outcomes, with expected distribution funnel. Used for empirical calibration assessment.
7. **Power Analysis Table** — Table showing minimum detectable relative risk (MDRR) per outcome
8. **SCCS Era-Based Results** — Table and timeline visualization for self-controlled case series

**Data shape:** `cm_result`, `cm_attrition`, `cm_propensity_model`, `cm_covariate_balance`, `cm_kaplan_meier`, `cm_negative_control`, `sccs_result`, `es_result` tables.

### Module 4: Patient-Level Prediction

**OHDSI Source:** `PatientLevelPrediction` R package

**Purpose:** Display performance of machine learning prediction models (LASSO, gradient boosting, deep learning) trained on OMOP data.

**Views to implement:**
1. **ROC Curve** — Receiver Operating Characteristic curve with AUC value. Interactive threshold slider.
2. **Calibration Plot** — Predicted vs. observed probability plot with ideal line and confidence bands
3. **Precision-Recall Curve** — With AUPRC value
4. **Discrimination Box Plot** — Box plots of predicted probability for outcome vs. no-outcome groups
5. **Model Coefficients Table** — Sortable table of model features with coefficients/importance scores, filterable by domain (demographics, conditions, drugs, etc.)
6. **Net Benefit (Decision Curve Analysis)** — Line plot showing net benefit vs. threshold probability, comparing model to treat-all and treat-none strategies
7. **Prediction Distribution** — Histogram of predicted probabilities
8. **External Validation Comparison** — Side-by-side performance metrics across development and validation databases
9. **Demographic Calibration** — Calibration broken down by age group and sex

**Data shape:** `plp_result`, `plp_performance`, `plp_covariate`, `plp_calibration`, `plp_discrimination`, `plp_demographic` tables.

### Module 5: Data Diagnostics / Database Explorer

**OHDSI Source:** `Achilles` R package, `DataQualityDashboard`

**Purpose:** Profile the underlying OMOP CDM database — record counts, data density over time, concept frequency distributions.

**Views to implement:**
1. **Data Source Summary** — Cards showing total persons, observation period spans, record counts by domain
2. **Data Density Over Time** — Area/line charts showing record volume by year for each domain (conditions, drugs, procedures, measurements)
3. **Domain Treemaps** — Treemaps showing most frequent concepts within each domain
4. **Person Demographics** — Age/sex pyramids, race/ethnicity distribution, observation period histograms
5. **DQD Results Dashboard** — Table of data quality check results (pass/fail/warning) with drill-down to specific issues

**Data shape:** `achilles_results`, `achilles_analysis`, `achilles_results_dist`, `dqd_results` tables.

### Module 6: Study Registry & Evidence Catalog

**OHDSI Source:** `data.ohdsi.org` landing page, `OhdsiShinyAppExplorer`

**Purpose:** Browsable catalog of all completed studies with metadata, links to results viewers, and associated publications.

**Views to implement:**
1. **Study Catalog** — Searchable/filterable grid of study cards showing study name, type (estimation/prediction/characterization), databases included, status, associated publications
2. **Study Detail Page** — Hub that routes to the appropriate results module(s) for each study
3. **Cross-Study Comparison** — For studies examining the same outcome, show comparative forest plots

**Data shape:** `study_registry` table (to be created), linking to results in other module tables.

---

## Implementation Plan

### Phase 1: Foundation (Backend API + Core Components)

#### 1A. FastAPI Results Service

Create a new FastAPI router module within the existing FastAPI service container.

**File structure:**
```
fastapi_service/
├── app/
│   ├── main.py                    # Existing entry point
│   ├── routers/
│   │   ├── __init__.py
│   │   ├── results/
│   │   │   ├── __init__.py
│   │   │   ├── router.py          # Main results router
│   │   │   ├── cohort_diagnostics.py
│   │   │   ├── characterization.py
│   │   │   ├── estimation.py
│   │   │   ├── prediction.py
│   │   │   ├── data_diagnostics.py
│   │   │   └── study_registry.py
│   │   └── ...
│   ├── models/
│   │   ├── results/
│   │   │   ├── __init__.py
│   │   │   ├── cohort_diagnostics.py   # Pydantic response models
│   │   │   ├── characterization.py
│   │   │   ├── estimation.py
│   │   │   ├── prediction.py
│   │   │   └── data_diagnostics.py
│   │   └── ...
│   ├── services/
│   │   ├── results/
│   │   │   ├── __init__.py
│   │   │   ├── query_builder.py    # Parameterized SQL query construction
│   │   │   ├── aggregation.py      # Statistical computations (KM curves, meta-analysis)
│   │   │   └── export.py           # CSV/JSON export service
│   │   └── ...
│   └── db/
│       ├── connection.py           # Existing async PG connection pool
│       └── results_schema.py       # Results schema table definitions
```

**Key API endpoints to implement:**

```
# Cohort Diagnostics
GET  /api/results/cohort-diagnostics/{study_id}/cohort-counts
GET  /api/results/cohort-diagnostics/{study_id}/incidence-rates?stratify_by=age,sex,year
GET  /api/results/cohort-diagnostics/{study_id}/time-distributions
GET  /api/results/cohort-diagnostics/{study_id}/cohort-overlap
GET  /api/results/cohort-diagnostics/{study_id}/concept-sets/{cohort_id}
GET  /api/results/cohort-diagnostics/{study_id}/index-events/{cohort_id}
GET  /api/results/cohort-diagnostics/{study_id}/visit-context/{cohort_id}
GET  /api/results/cohort-diagnostics/{study_id}/characterization?cohort_ids=1,2&database_ids=a,b

# Characterization
GET  /api/results/characterization/{study_id}/covariates?target_id=1&comparator_id=2&database_id=a&min_threshold=0.01
GET  /api/results/characterization/{study_id}/time-to-event?target_id=1&outcome_id=3
GET  /api/results/characterization/{study_id}/incidence-summary

# Estimation
GET  /api/results/estimation/{study_id}/forest-plot?outcome_ids=1,2,3&analysis_ids=1,2
GET  /api/results/estimation/{study_id}/attrition?target_id=1&comparator_id=2&database_id=a
GET  /api/results/estimation/{study_id}/propensity-scores?target_id=1&comparator_id=2&database_id=a
GET  /api/results/estimation/{study_id}/covariate-balance?target_id=1&comparator_id=2&database_id=a
GET  /api/results/estimation/{study_id}/kaplan-meier?target_id=1&comparator_id=2&outcome_id=3&database_id=a
GET  /api/results/estimation/{study_id}/calibration-plot?analysis_id=1&database_id=a
GET  /api/results/estimation/{study_id}/power?analysis_id=1
GET  /api/results/estimation/{study_id}/sccs?outcome_id=3&database_id=a

# Prediction
GET  /api/results/prediction/{study_id}/performance?model_id=1&database_id=a
GET  /api/results/prediction/{study_id}/roc?model_id=1&database_id=a
GET  /api/results/prediction/{study_id}/calibration?model_id=1&database_id=a
GET  /api/results/prediction/{study_id}/coefficients?model_id=1&sort_by=abs_value&limit=100
GET  /api/results/prediction/{study_id}/net-benefit?model_id=1&database_id=a
GET  /api/results/prediction/{study_id}/demographic-calibration?model_id=1&database_id=a

# Data Diagnostics
GET  /api/results/data-diagnostics/{database_id}/summary
GET  /api/results/data-diagnostics/{database_id}/density?domain=condition,drug,procedure
GET  /api/results/data-diagnostics/{database_id}/treemap?domain=condition&level=1
GET  /api/results/data-diagnostics/{database_id}/demographics
GET  /api/results/data-diagnostics/{database_id}/dqd-results?category=completeness,conformance

# Study Registry
GET  /api/results/studies?type=estimation&status=completed&search=diabetes
GET  /api/results/studies/{study_id}
POST /api/results/studies                    # Register new study
PUT  /api/results/studies/{study_id}         # Update metadata

# Export
GET  /api/results/export/{study_id}/{module}?format=csv
GET  /api/results/export/{study_id}/{module}?format=json
```

**Technical requirements for the FastAPI layer:**
- Use `asyncpg` for async database connections (existing pattern in the codebase)
- All Pydantic response models must be strictly typed — no `Any` types
- Implement cursor-based pagination for large result sets (covariate tables can exceed 50,000 rows)
- Add `ETag` / `If-None-Match` caching headers for expensive queries
- All query parameters should be validated with Pydantic `Query` types
- SQL queries must use parameterized queries via `asyncpg` — no string interpolation
- Implement query timeouts (30s default, configurable)
- Return `Content-Disposition` headers for export endpoints

#### 1B. Results Database Schema Migration

Create a Laravel migration that establishes the results schema tables. These mirror the OHDSI `ResultModelManager` schema but are adapted for PostgreSQL.

**Critical tables to create:**

```sql
-- Study Registry
CREATE TABLE results.study (
    study_id SERIAL PRIMARY KEY,
    study_name VARCHAR(500) NOT NULL,
    study_type VARCHAR(50) NOT NULL,  -- 'estimation', 'prediction', 'characterization', 'diagnostics'
    description TEXT,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB  -- flexible storage for publications, authors, etc.
);

-- Database Source Registry
CREATE TABLE results.database_meta (
    database_id VARCHAR(255) PRIMARY KEY,
    database_name VARCHAR(500) NOT NULL,
    database_description TEXT,
    vocabulary_version VARCHAR(50),
    cdm_version VARCHAR(20),
    person_count BIGINT,
    max_obs_period_end DATE
);

-- Cohort Diagnostics tables
CREATE TABLE results.cohort_count (...);
CREATE TABLE results.incidence_rate (...);
CREATE TABLE results.time_distribution (...);
CREATE TABLE results.cohort_overlap (...);
CREATE TABLE results.index_event_breakdown (...);
CREATE TABLE results.visit_context (...);
CREATE TABLE results.concept_sets (...);

-- Characterization tables
CREATE TABLE results.covariate_value (...);
CREATE TABLE results.covariate_ref (...);
CREATE TABLE results.cohort_incidence (...);
CREATE TABLE results.time_to_event (...);

-- Estimation tables
CREATE TABLE results.cm_result (...);
CREATE TABLE results.cm_attrition (...);
CREATE TABLE results.cm_covariate_balance (...);
CREATE TABLE results.cm_kaplan_meier_dist (...);
CREATE TABLE results.cm_propensity_model (...);
CREATE TABLE results.cm_negative_control (...);
CREATE TABLE results.sccs_result (...);
CREATE TABLE results.es_result (...);

-- Prediction tables
CREATE TABLE results.plp_result (...);
CREATE TABLE results.plp_performance (...);
CREATE TABLE results.plp_covariate (...);
CREATE TABLE results.plp_calibration (...);
CREATE TABLE results.plp_discrimination (...);

-- Data Diagnostics tables
CREATE TABLE results.achilles_results (...);
CREATE TABLE results.achilles_results_dist (...);
CREATE TABLE results.dqd_results (...);
```

For the exact column definitions, reference the OHDSI `ResultModelManager` package's `inst/sql/` directory. The key columns are documented in the OHDSI `CohortDiagnostics`, `CohortMethod`, `PatientLevelPrediction`, and `Achilles` R package documentation. Adapt SQL Server syntax to PostgreSQL where needed.

### Phase 2: React Component Library

#### 2A. Directory Structure

```
resources/js/
├── Components/
│   ├── ResultsExplorer/
│   │   ├── index.ts                       # Barrel export
│   │   ├── ResultsExplorerLayout.tsx       # Main layout with sidebar navigation
│   │   ├── StudySelector.tsx               # Dropdown/search for selecting active study
│   │   │
│   │   ├── CohortDiagnostics/
│   │   │   ├── index.ts
│   │   │   ├── CohortCountsTable.tsx
│   │   │   ├── IncidenceRateChart.tsx
│   │   │   ├── TimeDistributionPlot.tsx
│   │   │   ├── CohortOverlapVenn.tsx
│   │   │   ├── ConceptSetExplorer.tsx
│   │   │   ├── IndexEventBreakdown.tsx
│   │   │   ├── VisitContextTable.tsx
│   │   │   └── CharacterizationTable.tsx
│   │   │
│   │   ├── Characterization/
│   │   │   ├── index.ts
│   │   │   ├── CovariateBalanceTable.tsx   # Virtual scrolling for 10K+ rows
│   │   │   ├── LovePlot.tsx               # THE key OHDSI scatter plot
│   │   │   ├── KaplanMeierCurve.tsx       # Shared with Estimation
│   │   │   ├── IncidenceSummaryTable.tsx
│   │   │   └── DechallengeRechallenge.tsx
│   │   │
│   │   ├── Estimation/
│   │   │   ├── index.ts
│   │   │   ├── ForestPlot.tsx             # Custom SVG — Recharts won't suffice
│   │   │   ├── AttritionDiagram.tsx       # Sankey/funnel flow
│   │   │   ├── PropensityScorePlot.tsx
│   │   │   ├── CovariateBalancePlot.tsx   # Re-uses LovePlot
│   │   │   ├── KaplanMeierPlot.tsx
│   │   │   ├── CalibrationPlot.tsx        # Negative controls scatter
│   │   │   ├── PowerTable.tsx
│   │   │   └── SCCSTimeline.tsx
│   │   │
│   │   ├── Prediction/
│   │   │   ├── index.ts
│   │   │   ├── ROCCurve.tsx
│   │   │   ├── CalibrationPlot.tsx
│   │   │   ├── PrecisionRecallCurve.tsx
│   │   │   ├── DiscriminationBoxPlot.tsx
│   │   │   ├── ModelCoefficientsTable.tsx
│   │   │   ├── NetBenefitCurve.tsx
│   │   │   ├── PredictionDistribution.tsx
│   │   │   └── ValidationComparison.tsx
│   │   │
│   │   ├── DataDiagnostics/
│   │   │   ├── index.ts
│   │   │   ├── DataSourceSummary.tsx
│   │   │   ├── DataDensityChart.tsx
│   │   │   ├── DomainTreemap.tsx
│   │   │   ├── DemographicsPyramid.tsx
│   │   │   └── DQDResultsTable.tsx
│   │   │
│   │   ├── StudyRegistry/
│   │   │   ├── index.ts
│   │   │   ├── StudyCatalog.tsx
│   │   │   ├── StudyDetailPage.tsx
│   │   │   └── CrossStudyComparison.tsx
│   │   │
│   │   └── shared/
│   │       ├── index.ts
│   │       ├── DatabaseSelector.tsx        # Multi-select for database filtering
│   │       ├── CohortSelector.tsx          # Cohort picker
│   │       ├── AnalysisSelector.tsx        # Analysis type picker
│   │       ├── ExportButton.tsx            # CSV/JSON download trigger
│   │       ├── VirtualTable.tsx            # Virtualized table for large datasets
│   │       ├── InfoTooltip.tsx             # Methodology help popovers
│   │       ├── LoadingState.tsx            # Skeleton loader
│   │       ├── ErrorBoundary.tsx           # Error handling wrapper
│   │       └── NoDataPlaceholder.tsx       # Empty state
│   └── ...
├── hooks/
│   ├── useResultsApi.ts                    # Generic fetch hook with caching
│   ├── useCohortDiagnostics.ts
│   ├── useCharacterization.ts
│   ├── useEstimation.ts
│   ├── usePrediction.ts
│   └── useDataDiagnostics.ts
├── types/
│   ├── results/
│   │   ├── index.ts
│   │   ├── cohort-diagnostics.ts
│   │   ├── characterization.ts
│   │   ├── estimation.ts
│   │   ├── prediction.ts
│   │   ├── data-diagnostics.ts
│   │   └── study-registry.ts
│   └── ...
├── utils/
│   ├── results/
│   │   ├── formatters.ts                   # Number formatting, CI formatting
│   │   ├── statistical.ts                  # Client-side stat helpers
│   │   ├── color-scales.ts                 # Consistent color mapping for databases
│   │   └── export.ts                       # CSV generation helpers
│   └── ...
└── Pages/
    └── ResultsExplorer/
        ├── Index.tsx                        # Main page (Inertia route)
        ├── Study.tsx                        # Study-specific results page
        └── Compare.tsx                      # Cross-study comparison page
```

#### 2B. Critical Component Implementation Notes

**ForestPlot.tsx — This is the highest-priority custom visualization.**

Recharts cannot render a proper OHDSI forest plot. Build this as a custom SVG component:
- Horizontal layout: outcome labels on left, CI whiskers in center, effect estimates on right
- Log-scale x-axis (typical range 0.1 to 10.0)
- Reference line at x = 1.0 (null effect)
- Each row = one database result; grouped rows for same outcome
- Diamond shape for meta-analysis pooled estimate (wider = wider CI)
- Color-coded by database using consistent color-scale
- Hover tooltip: "HR 0.85 (95% CI: 0.72–1.01), p = 0.062, Database: Optum EHR"
- Responsive: adapt to container width
- Print-friendly mode (no hover states, labels always visible)

**LovePlot.tsx — Second highest priority.**

Scatter plot showing standardized mean differences (SMD):
- X-axis: SMD (typically -0.5 to 0.5, warn if > 0.1)
- Each dot = one covariate
- Two series: "Before Matching" (open circles) and "After Matching" (filled circles)
- Vertical dashed reference lines at SMD = ±0.1
- On hover, show covariate name and both SMD values
- Optionally connect before/after dots with lines for the same covariate
- Must handle 5,000+ covariates — use canvas rendering or decimation for performance

**KaplanMeierPlot.tsx — Shared between Characterization and Estimation.**

Step-function survival curves:
- Y-axis: Survival probability (0 to 1.0)
- X-axis: Time (days or months, user-selectable)
- Multiple lines for target vs. comparator cohorts
- Shaded confidence bands (95% CI)
- Number-at-risk table below the chart (aligned with x-axis ticks)
- Censor marks (small vertical ticks on the curve)
- Log-rank test p-value displayed
- Zoom/pan capability for long follow-up periods

**AttritionDiagram.tsx**

Vertical funnel/flow diagram:
- Each box = a step in the attrition process with count
- Arrows between boxes with count of excluded patients
- Side labels: exclusion reason and count
- Side-by-side for target and comparator
- Use SVG with flexbox-like layout

**VirtualTable.tsx — Critical shared component.**

Many OHDSI result tables have 10,000–50,000+ rows (covariate tables). Implement:
- Windowed rendering (only render visible rows + buffer)
- Use `@tanstack/react-virtual` or equivalent
- Column sorting (client-side for small datasets, server-side for large)
- Column filtering (text search, numeric range)
- Column resizing
- Sticky header
- CSV export of filtered view
- Configurable row height

#### 2C. Hooks Architecture

```typescript
// hooks/useResultsApi.ts
// Generic hook for results API calls with caching, loading states, error handling

interface UseResultsApiOptions<T> {
  endpoint: string;
  params?: Record<string, string | number | boolean | undefined>;
  enabled?: boolean;       // Conditional fetching
  staleTime?: number;      // Cache duration in ms (default: 5 minutes)
  refetchOnMount?: boolean;
}

interface UseResultsApiResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  isStale: boolean;
}

// Implementation should:
// - Use AbortController for request cancellation on unmount
// - Implement in-memory cache keyed by endpoint + params hash
// - Support ETag-based conditional requests
// - Provide loading/error/data states
// - Handle 401/403 by redirecting to login
// - Transform snake_case API responses to camelCase TypeScript
```

```typescript
// hooks/useEstimation.ts
// Domain-specific hook wrapping useResultsApi

export function useForestPlotData(studyId: string, options: {
  outcomeIds?: number[];
  analysisIds?: number[];
  databaseIds?: string[];
}) {
  return useResultsApi<ForestPlotData>({
    endpoint: `/api/results/estimation/${studyId}/forest-plot`,
    params: {
      outcome_ids: options.outcomeIds?.join(','),
      analysis_ids: options.analysisIds?.join(','),
      database_ids: options.databaseIds?.join(','),
    },
    enabled: !!studyId,
  });
}
```

#### 2D. TypeScript Type Definitions

```typescript
// types/results/estimation.ts

export interface EffectEstimate {
  analysisId: number;
  targetId: number;
  comparatorId: number;
  outcomeId: number;
  outcomeName: string;
  databaseId: string;
  databaseName: string;
  rr: number;              // Relative risk / hazard ratio
  ci95Lb: number;          // 95% CI lower bound
  ci95Ub: number;          // 95% CI upper bound
  pValue: number;
  calibratedRr?: number;   // After empirical calibration
  calibratedCi95Lb?: number;
  calibratedCi95Ub?: number;
  calibratedPValue?: number;
  logRr: number;
  seLogRr: number;
  targetSubjects: number;
  comparatorSubjects: number;
  targetOutcomes: number;
  comparatorOutcomes: number;
}

export interface ForestPlotData {
  estimates: EffectEstimate[];
  metaAnalysis?: EffectEstimate[];  // Pooled estimates
  analysisDescriptions: Record<number, string>;
  outcomeDescriptions: Record<number, string>;
}

export interface AttritionStep {
  sequenceNumber: number;
  description: string;
  subjectsCount: number;
  excludedCount: number;
  excludedReason: string;
}

export interface AttritionData {
  targetAttrition: AttritionStep[];
  comparatorAttrition: AttritionStep[];
  targetCohortName: string;
  comparatorCohortName: string;
}

export interface KaplanMeierPoint {
  time: number;
  surv: number;
  survLower: number;
  survUpper: number;
  nAtRisk: number;
  nEvents: number;
  nCensored: number;
}

export interface KaplanMeierData {
  targetCurve: KaplanMeierPoint[];
  comparatorCurve: KaplanMeierPoint[];
  logRankPValue: number;
  targetCohortName: string;
  comparatorCohortName: string;
}

// ... Define equivalent interfaces for all other modules
```

### Phase 3: Laravel Integration

#### 3A. Routes

Add to `routes/web.php`:

```php
// Results Explorer routes
Route::prefix('results')->middleware(['auth'])->group(function () {
    Route::get('/', [ResultsExplorerController::class, 'index'])->name('results.index');
    Route::get('/study/{studyId}', [ResultsExplorerController::class, 'study'])->name('results.study');
    Route::get('/compare', [ResultsExplorerController::class, 'compare'])->name('results.compare');
});
```

#### 3B. Controller

The Laravel controller serves Inertia pages (renders React components with initial props). The heavy data fetching is done client-side from React via the FastAPI endpoints.

```php
class ResultsExplorerController extends Controller
{
    public function index()
    {
        // Minimal server-side data: study list for initial render
        $studies = DB::connection('results')
            ->table('results.study')
            ->select('study_id', 'study_name', 'study_type', 'status', 'created_at')
            ->where('status', 'active')
            ->orderByDesc('updated_at')
            ->get();

        return Inertia::render('ResultsExplorer/Index', [
            'studies' => $studies,
            'fastApiBaseUrl' => config('services.fastapi.url'),
        ]);
    }

    public function study(string $studyId)
    {
        $study = DB::connection('results')
            ->table('results.study')
            ->where('study_id', $studyId)
            ->firstOrFail();

        return Inertia::render('ResultsExplorer/Study', [
            'study' => $study,
            'fastApiBaseUrl' => config('services.fastapi.url'),
        ]);
    }
}
```

### Phase 4: Import/Compatibility Layer

#### 4A. OHDSI Results Importer

Create a FastAPI endpoint and CLI tool that can ingest results from the standard OHDSI pipeline:

```
POST /api/results/import
Content-Type: multipart/form-data

file: results.zip       # Standard OHDSI results zip from Strategus/HADES
study_name: "My Study"
study_type: "estimation"
```

This endpoint must:
1. Accept the standard OHDSI results zip format (CSV files organized by module)
2. Parse CSV files and bulk-insert into the results schema
3. Handle the `ResultModelManager` naming conventions
4. Create/update the study registry entry
5. Return import status with row counts per table

Also create a CLI command:
```bash
python -m app.cli.import_results --zip /path/to/results.zip --study-name "My Study" --study-type estimation
```

This ensures backward compatibility — sites currently using HADES/Strategus can import their existing results into Parthenon without re-running analyses.

---

## Design System & Visual Requirements

### Color Palette for Results

Define a consistent color palette for database identification (OHDSI convention):

```typescript
// utils/results/color-scales.ts
export const DATABASE_COLORS = [
  '#1f77b4',  // Blue (primary)
  '#ff7f0e',  // Orange
  '#2ca02c',  // Green
  '#d62728',  // Red
  '#9467bd',  // Purple
  '#8c564b',  // Brown
  '#e377c2',  // Pink
  '#7f7f7f',  // Gray
  '#bcbd22',  // Olive
  '#17becf',  // Cyan
] as const;

export const ESTIMATION_COLORS = {
  target: '#1f77b4',
  comparator: '#ff7f0e',
  nullEffect: '#999999',
  significant: '#d62728',
  metaAnalysis: '#2ca02c',
} as const;
```

### Typography & Layout

- Use the existing TailwindCSS configuration in the project
- All charts must have clear axis labels, legends, and titles
- Font size: 12px minimum for axis labels, 14px for chart titles
- All visualizations must be responsive (resize on container width changes)
- Implement a print stylesheet that hides interactive controls and renders full data

### Accessibility

- All charts must have `aria-label` descriptions
- Data tables must use proper `<thead>`, `<tbody>`, `<th scope>` semantics
- Color choices must pass WCAG AA contrast ratios
- Provide tabular alternatives for all chart-based views (toggle between chart and table)

---

## Testing Strategy

### Unit Tests
- Every FastAPI endpoint: test response shape, pagination, filtering, error handling
- Every statistical utility function (KM estimation, meta-analysis pooling, SMD calculation)
- Every React hook: mock API responses, test loading/error/data states

### Integration Tests
- Import a standard OHDSI results zip → verify all tables populated → verify API returns correct data → verify React renders correct visualizations
- Use OHDSI's public synthetic results from `ShinyDeploy` repo as test fixtures

### Visual Regression Tests
- Snapshot tests for ForestPlot, LovePlot, KaplanMeierPlot, AttritionDiagram with known data
- Compare output against reference OHDSI Shiny screenshots for visual parity

---

## Performance Requirements

- **Initial page load:** Study catalog renders in < 2 seconds
- **Chart render:** All visualizations render in < 1 second after data receipt
- **Large table:** 50,000-row covariate table scrolls at 60fps with virtual scrolling
- **API response:** All endpoints return in < 5 seconds for typical queries
- **Concurrent users:** FastAPI service handles 50 concurrent result viewers without degradation
- **Export:** CSV export of 100,000 rows completes in < 10 seconds

---

## Docker Compose Integration

Add the Results Explorer configuration to the existing `docker-compose.yml`:

```yaml
# The FastAPI service already exists — extend it:
services:
  fastapi:
    # ... existing config ...
    environment:
      - RESULTS_DB_HOST=${RESULTS_DB_HOST:-postgres}
      - RESULTS_DB_PORT=${RESULTS_DB_PORT:-5432}
      - RESULTS_DB_NAME=${RESULTS_DB_NAME:-ohdsi}
      - RESULTS_DB_SCHEMA=${RESULTS_DB_SCHEMA:-results}
      - RESULTS_DB_USER=${RESULTS_DB_USER:-postgres}
      - RESULTS_DB_PASSWORD_FILE=${RESULTS_DB_PASSWORD_FILE:-./secrets/cdm/RESULTS_PASSWORD}
```

No new containers are needed — the Results Explorer is purely a frontend feature backed by the existing FastAPI service and PostgreSQL database.

---

## Implementation Priority Order

1. **Results database schema migration** — Foundation for everything
2. **FastAPI estimation endpoints + ForestPlot component** — Highest visibility, most complex visualization, proves the architecture
3. **FastAPI cohort diagnostics endpoints + CohortCountsTable + IncidenceRateChart** — Most frequently used OHDSI module
4. **LovePlot + CovariateBalanceTable** — Critical for characterization and estimation
5. **KaplanMeierPlot** — Reused across modules
6. **AttritionDiagram** — Essential for estimation studies
7. **ROC/Calibration/PrecisionRecall curves** — Prediction module core
8. **Study Registry + StudyCatalog** — Navigation and discovery
9. **OHDSI Results Importer** — Backward compatibility
10. **Data Diagnostics module** — Lower priority, Achilles output viewer
11. **PropensityScorePlot, CalibrationPlot, SCCSTimeline** — Estimation extras
12. **NetBenefitCurve, ValidationComparison** — Prediction extras
13. **CrossStudyComparison** — Advanced feature
14. **Print/export optimization** — Polish

---

## Key References

- OHDSI `OhdsiShinyModules` source: https://github.com/OHDSI/OhdsiShinyModules
- OHDSI `ShinyAppBuilder` source: https://github.com/OHDSI/ShinyAppBuilder (now `OhdsiShinyAppBuilder`)
- OHDSI `ResultModelManager` (defines the DB schema): https://github.com/OHDSI/ResultModelManager
- OHDSI `CohortDiagnostics` (defines diagnostic result tables): https://github.com/OHDSI/CohortDiagnostics
- OHDSI `CohortMethod` (defines estimation result tables): https://github.com/OHDSI/CohortMethod
- OHDSI `PatientLevelPrediction` (defines prediction result tables): https://github.com/OHDSI/PatientLevelPrediction
- OHDSI `Achilles` (defines data profile tables): https://github.com/OHDSI/Achilles
- OHDSI `Strategus` (orchestrator that produces results): https://github.com/OHDSI/Strategus
- Live example of OHDSI results viewer: https://results.ohdsi.org/
- The Book of OHDSI, Chapter on Open Science: https://ohdsi.github.io/TheBookOfOhdsi/

---

## Success Criteria

When complete, a researcher should be able to:

1. Open Parthenon's Results Explorer in a browser
2. See a searchable catalog of all completed studies
3. Click into any study and navigate between Cohort Diagnostics, Characterization, Estimation, Prediction, and Data Diagnostics tabs
4. Interact with publication-quality forest plots, Kaplan-Meier curves, Love plots, ROC curves, and attrition diagrams
5. Filter results by database, cohort, analysis type, and outcome
6. Export any view as CSV or publication-ready SVG/PNG
7. Import results from existing OHDSI/HADES/Strategus pipelines via zip upload

All without R, without Shiny, without a separate server process — entirely within Parthenon's unified React + FastAPI stack.
