# Evidence Investigation Phase 2 — Clinical Evidence Domain

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Clinical Evidence domain panel inside the Evidence Board — an analysis gallery with card-based launcher, configuration drawers pre-filled from investigation cohorts, execution dispatch via existing queue infrastructure, 2s polling for status, inline result display with D3/Recharts visualizations, and pin-to-dossier for all result types.

**Architecture:** This is an integration layer — all 7 analysis types (characterization, incidence rate, estimation, prediction, SCCS, evidence synthesis, pathway) are already fully implemented in the backend (services, jobs, R endpoints, controllers, routes). The plan creates a `ClinicalPanel` component that presents these existing capabilities through the Evidence Board's focus+context model. Configuration drawers pre-fill from the investigation's phenotype state (cohort IDs, concept sets). Results display inline with existing result normalization. No new backend services or R endpoints needed.

**Tech Stack:** React 19, TypeScript, TanStack Query (polling), D3 v7 (KM curves, PS distributions), Recharts v3 (forest plots, calibration), existing Laravel analysis API

**Spec:** `docs/superpowers/specs/2026-03-20-finngen-evidence-investigation-design.md` (Phase 2 section)

**Depends on:** Phase 1 complete (1a + 1b-i + 1b-ii)

---

## Key Discovery: Existing Infrastructure

The research revealed that **all backend analysis infrastructure already exists**:

| Analysis Type | Queue | PHP Service | R Endpoint | Laravel API |
|---|---|---|---|---|
| Characterization | `analysis` | `CharacterizationService` | `/analysis/characterization/run` | `POST /characterizations/{id}/execute` |
| Incidence Rate | `analysis` | `IncidenceRateService` | `/analysis/cohort-incidence/calculate` | `POST /incidence-rates/{id}/execute` |
| Estimation (CohortMethod) | `r-analysis` | `EstimationService` | `/analysis/estimation/run` | `POST /estimations/{id}/execute` |
| Prediction (PLP) | `r-analysis` | `PredictionService` | `/analysis/prediction/run` | `POST /predictions/{id}/execute` |
| SCCS | `r-analysis` | `SccsService` | `/analysis/sccs/run` | `POST /sccs/{id}/execute` |
| Evidence Synthesis | `r-analysis` | `EvidenceSynthesisService` | `/analysis/evidence-synthesis/run` | `POST /evidence-synthesis/{id}/execute` |
| Pathway | `analysis` | `PathwayService` | — | `POST /pathways/{id}/execute` |

Frontend polling already works via `useCharacterizationExecution` (2s interval while `running|queued|pending`).

**The plan's job:** Create the Clinical Evidence panel UI that wraps these existing APIs into the Evidence Board context, pre-fills from investigation state, and pins results to the dossier.

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `frontend/src/features/investigation/components/clinical/ClinicalPanel.tsx` | Clinical domain focus panel — sub-tabs: Gallery, Active Runs, Run History |
| `frontend/src/features/investigation/components/clinical/AnalysisGallery.tsx` | Grid of analysis type cards (Characterize/Compare/Predict) |
| `frontend/src/features/investigation/components/clinical/AnalysisCard.tsx` | Individual analysis type card with icon, description, prerequisites |
| `frontend/src/features/investigation/components/clinical/ConfigDrawer.tsx` | Slide-in configuration panel for analysis parameters |
| `frontend/src/features/investigation/components/clinical/ExecutionTracker.tsx` | Polls execution status, shows progress, renders results on completion |
| `frontend/src/features/investigation/components/clinical/ResultCards.tsx` | Renders pinnable result cards per analysis type (HR, KM, PS, etc.) |
| `frontend/src/features/investigation/components/clinical/KaplanMeierChart.tsx` | D3 KM survival curve (dark-themed) |
| `frontend/src/features/investigation/components/clinical/PSDistributionChart.tsx` | D3 mirrored histogram for propensity score distributions |
| `frontend/src/features/investigation/components/clinical/RunHistoryPanel.tsx` | List of all clinical runs for this investigation with compare/replay |
| `frontend/src/features/investigation/hooks/useClinicalAnalysis.ts` | TanStack Query hooks for analysis CRUD + execution + polling |

### Modified Files

| File | Changes |
|------|---------|
| `frontend/src/features/investigation/components/EvidenceBoard.tsx` | Render `ClinicalPanel` for clinical domain (replace DomainPlaceholder) |
| `frontend/src/features/investigation/types.ts` | Add clinical analysis types, execution types, result types |
| `frontend/src/features/investigation/api.ts` | Add clinical analysis API wrapper functions |
| `frontend/src/features/investigation/components/PhenotypePanel.tsx` | Add "Use in Clinical Analysis" handoff from cohort results |

---

## Task Breakdown

### Task 1: Clinical analysis types and API wrappers

**Files:**
- Modify: `frontend/src/features/investigation/types.ts`
- Modify: `frontend/src/features/investigation/api.ts`
- Create: `frontend/src/features/investigation/hooks/useClinicalAnalysis.ts`

- [ ] **Step 1: Add clinical types**

In `frontend/src/features/investigation/types.ts`, add:

```typescript
export type ClinicalAnalysisType =
  | "characterization"
  | "incidence_rate"
  | "estimation"
  | "prediction"
  | "sccs"
  | "evidence_synthesis"
  | "pathway";

export type ClinicalAnalysisGroup = "characterize" | "compare" | "predict";

export interface AnalysisTypeDescriptor {
  type: ClinicalAnalysisType;
  group: ClinicalAnalysisGroup;
  name: string;
  description: string;
  icon: string;
  prerequisites: string[];
  estimatedTime: string;
  apiPrefix: string;  // e.g., "characterizations", "estimations"
}

export type ExecutionStatus = "queued" | "pending" | "running" | "completed" | "failed" | "cancelled";

// IMPORTANT: Do NOT redefine AnalysisExecution — import from the existing analyses feature:
// import type { AnalysisExecution } from "@/features/analyses/types/analysis";
// Re-export for convenience:
// export type { AnalysisExecution } from "@/features/analyses/types/analysis";
//
// The existing type uses `fail_message` (not `error_message`). Do not create a duplicate.

export interface ClinicalAnalysisConfig {
  type: ClinicalAnalysisType;
  source_id: number | null;  // null for evidence_synthesis (no CDM source needed)
  target_cohort_id: number | null;
  comparator_cohort_id: number | null;
  outcome_cohort_ids: number[];
  parameters: Record<string, unknown>;
}
```

- [ ] **Step 2: Add analysis type registry constant**

In the same file or a new `frontend/src/features/investigation/clinicalRegistry.ts`, add:

```typescript
export const CLINICAL_ANALYSIS_REGISTRY: AnalysisTypeDescriptor[] = [
  // Characterize group
  {
    type: "characterization",
    group: "characterize",
    name: "Cohort Characterization",
    description: "Baseline demographics, comorbidities, drug utilization, and temporal patterns for target and comparator cohorts.",
    icon: "Users",
    prerequisites: ["At least one cohort defined"],
    estimatedTime: "2-5 min",
    apiPrefix: "characterizations",
  },
  {
    type: "incidence_rate",
    group: "characterize",
    name: "Incidence Rate Analysis",
    description: "Calculate incidence rates with exact Poisson confidence intervals, stratified by age, sex, or calendar year.",
    icon: "TrendingUp",
    prerequisites: ["Target cohort", "Outcome cohort"],
    estimatedTime: "1-3 min",
    apiPrefix: "incidence-rates",
  },
  {
    type: "pathway",
    group: "characterize",
    name: "Treatment Pathway",
    description: "Visualize sequential treatment patterns and drug utilization trajectories within a cohort.",
    icon: "GitBranch",
    prerequisites: ["Target cohort"],
    estimatedTime: "2-5 min",
    apiPrefix: "pathways",
  },
  // Compare group
  {
    type: "estimation",
    group: "compare",
    name: "Comparative Effectiveness",
    description: "Population-level effect estimation using CohortMethod — propensity score matching/stratification with Cox models.",
    icon: "Scale",
    prerequisites: ["Target cohort", "Comparator cohort", "Outcome cohort"],
    estimatedTime: "10-45 min",
    apiPrefix: "estimations",
  },
  {
    type: "sccs",
    group: "compare",
    name: "Self-Controlled Case Series",
    description: "Within-person comparison of event rates during exposed vs. unexposed time windows. Controls for time-invariant confounders.",
    icon: "Repeat",
    prerequisites: ["Exposure cohort", "Outcome cohort"],
    estimatedTime: "5-15 min",
    apiPrefix: "sccs",
  },
  {
    type: "evidence_synthesis",
    group: "compare",
    name: "Evidence Synthesis",
    description: "Fixed-effect or Bayesian random-effects meta-analysis pooling estimates from multiple analyses or sites.",
    icon: "Layers",
    prerequisites: ["At least 2 completed estimation results"],
    estimatedTime: "< 1 min",
    apiPrefix: "evidence-synthesis",
  },
  // Predict group
  {
    type: "prediction",
    group: "predict",
    name: "Patient-Level Prediction",
    description: "Train ML models (LASSO, gradient boosting, random forest, deep learning) to predict outcomes in a target cohort.",
    icon: "Brain",
    prerequisites: ["Target cohort", "Outcome cohort"],
    estimatedTime: "15-60 min",
    apiPrefix: "predictions",
  },
];
```

- [ ] **Step 3: Add API wrapper functions**

In `frontend/src/features/investigation/api.ts`, add functions that wrap the existing analysis APIs. These are thin wrappers that call the existing endpoints:

```typescript
// ── Clinical Analysis ─────────────────────────────────────────────────

export async function createAnalysis(
  apiPrefix: string,
  payload: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const { data } = await apiClient.post(`/${apiPrefix}`, payload);
  return data.data ?? data;
}

export async function executeAnalysis(
  apiPrefix: string,
  analysisId: number,
  sourceId?: number,  // optional — evidence_synthesis has no CDM source
): Promise<AnalysisExecution> {
  const payload = sourceId ? { source_id: sourceId } : {};
  const { data } = await apiClient.post(`/${apiPrefix}/${analysisId}/execute`, payload);
  return data.data ?? data;
}

export async function fetchExecution(
  apiPrefix: string,
  analysisId: number,
  executionId: number,
): Promise<AnalysisExecution> {
  const { data } = await apiClient.get(
    `/${apiPrefix}/${analysisId}/executions/${executionId}`,
  );
  return data.data ?? data;
}

export async function fetchExecutions(
  apiPrefix: string,
  analysisId: number,
): Promise<AnalysisExecution[]> {
  const { data } = await apiClient.get(`/${apiPrefix}/${analysisId}/executions`);
  return data.data ?? data;
}
```

Import `AnalysisExecution` from `./types`.

- [ ] **Step 4: Create useClinicalAnalysis hooks**

Create `frontend/src/features/investigation/hooks/useClinicalAnalysis.ts`:

```typescript
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createAnalysis, executeAnalysis, fetchExecution, fetchExecutions } from "../api";
import type { AnalysisExecution } from "@/features/analyses/types/analysis";

export function useCreateAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ apiPrefix, payload }: { apiPrefix: string; payload: Record<string, unknown> }) =>
      createAnalysis(apiPrefix, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["investigation"] }),
  });
}

export function useExecuteAnalysis() {
  return useMutation({
    mutationFn: ({ apiPrefix, analysisId, sourceId }: { apiPrefix: string; analysisId: number; sourceId: number }) =>
      executeAnalysis(apiPrefix, analysisId, sourceId),
  });
}

export function useExecution(
  apiPrefix: string,
  analysisId: number,
  executionId: number | null,
) {
  return useQuery({
    queryKey: ["execution", apiPrefix, analysisId, executionId],
    queryFn: () => fetchExecution(apiPrefix, analysisId, executionId!),
    enabled: !!executionId && !!analysisId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (!status) return 2000;
      const isTerminal = ["completed", "failed", "cancelled"].includes(status);
      return isTerminal ? false : 2000;  // poll every 2s while running
    },
  });
}

export function useExecutions(apiPrefix: string, analysisId: number) {
  return useQuery({
    queryKey: ["executions", apiPrefix, analysisId],
    queryFn: () => fetchExecutions(apiPrefix, analysisId),
    enabled: !!analysisId,
  });
}
```

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/investigation/types.ts frontend/src/features/investigation/api.ts frontend/src/features/investigation/hooks/useClinicalAnalysis.ts
git commit -m "feat(investigation): add clinical analysis types, registry, API wrappers, and polling hooks"
```

---

### Task 2: Analysis Gallery and Card components

**Files:**
- Create: `frontend/src/features/investigation/components/clinical/AnalysisCard.tsx`
- Create: `frontend/src/features/investigation/components/clinical/AnalysisGallery.tsx`

- [ ] **Step 1: Create directory**

```bash
mkdir -p frontend/src/features/investigation/components/clinical
```

- [ ] **Step 2: Create AnalysisCard**

Create `frontend/src/features/investigation/components/clinical/AnalysisCard.tsx`:

A card for a single analysis type. Similar to `ToolsetCard` in the workbench launcher but adapted for analyses.

Props:
```typescript
interface AnalysisCardProps {
  descriptor: AnalysisTypeDescriptor;
  onSelect: (type: ClinicalAnalysisType) => void;
  disabled?: boolean;
  disabledReason?: string;
}
```

Layout: icon (from Lucide, dynamic lookup same as ToolsetCard), name, description (2 lines truncated), prerequisites as small badges, estimated time badge, click handler. Disabled state: opacity-60, cursor-default, tooltip showing reason.

Group color coding: characterize=teal `#2DD4BF`, compare=crimson `#9B1B30`, predict=gold `#C9A227`.

- [ ] **Step 3: Create AnalysisGallery**

Create `frontend/src/features/investigation/components/clinical/AnalysisGallery.tsx`:

Grid of `AnalysisCard` components grouped by `ClinicalAnalysisGroup`.

Props:
```typescript
interface AnalysisGalleryProps {
  investigation: Investigation;
  onSelectAnalysis: (type: ClinicalAnalysisType) => void;
}
```

Layout:
- Three sections with headers: "Characterize", "Compare", "Predict"
- Each section: cards from `CLINICAL_ANALYSIS_REGISTRY` filtered by group
- Cards disabled if prerequisites not met (check investigation.phenotype_state for cohort IDs)
- `sm:grid-cols-2 lg:grid-cols-3` grid per section

Import `CLINICAL_ANALYSIS_REGISTRY` from types or the registry file.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/investigation/components/clinical/
git commit -m "feat(investigation): add AnalysisGallery and AnalysisCard components"
```

---

### Task 3: Configuration Drawer

**Files:**
- Create: `frontend/src/features/investigation/components/clinical/ConfigDrawer.tsx`

- [ ] **Step 1: Create ConfigDrawer**

Create `frontend/src/features/investigation/components/clinical/ConfigDrawer.tsx`:

A slide-in panel from the right (similar to a modal but keeps the gallery visible behind it). This is the most complex component — it renders different configuration forms based on the analysis type.

Props:
```typescript
interface ConfigDrawerProps {
  analysisType: ClinicalAnalysisType | null;  // null = closed
  investigation: Investigation;
  onClose: () => void;
  onExecute: (config: ClinicalAnalysisConfig) => void;
}
```

Layout:
- Slide-in from right, w-96 (or w-[480px]), full height, bg-zinc-950 border-l border-zinc-800
- Header: analysis type name + close button
- Body (scrollable):
  - **Source selector** — dropdown of CDM sources (reuse `fetchSources` pattern)
  - **Common fields** (all types):
    - Target cohort selector — dropdown pre-filled from `investigation.phenotype_state.selected_cohort_ids`
  - **Type-specific fields:**
    - `characterization`: min cell count (default 5), time windows
    - `incidence_rate`: outcome cohort selector, time-at-risk settings, stratification
    - `estimation`: comparator cohort, outcome cohorts (multi-select), PS method (matching/stratification/weighting), model type (Cox)
    - `prediction`: outcome cohort, model type dropdown (lasso_logistic_regression, gradient_boosting, random_forest), time-at-risk, split ratio
    - `sccs`: exposure cohort, outcome cohort, risk windows, naive period
    - `evidence_synthesis`: select 2+ completed estimation executions, method (fixed/bayesian)
    - `pathway`: target cohort only
  - **Advanced options** (collapsible): covariate settings, negative controls
- Footer: "Run Analysis" button (crimson), estimated time badge

For the cohort selectors, use the existing `useCohortDefinitions` hook to list available cohorts, but highlight cohorts from `investigation.phenotype_state.selected_cohort_ids` as "From this investigation".

The drawer does NOT create the analysis design record — it collects config and calls `onExecute`. The parent component handles the create + execute API calls.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/investigation/components/clinical/ConfigDrawer.tsx
git commit -m "feat(investigation): add analysis ConfigDrawer with type-specific parameter forms"
```

---

### Task 4: Execution Tracker with polling

**Files:**
- Create: `frontend/src/features/investigation/components/clinical/ExecutionTracker.tsx`

- [ ] **Step 1: Create ExecutionTracker**

Create `frontend/src/features/investigation/components/clinical/ExecutionTracker.tsx`:

Tracks execution status via polling and renders results when complete.

Props:
```typescript
interface ExecutionTrackerProps {
  apiPrefix: string;
  analysisId: number;
  executionId: number;
  analysisType: ClinicalAnalysisType;
  onComplete: (execution: AnalysisExecution) => void;
  onPinFinding: (finding: { domain: string; section: string; finding_type: string; finding_payload: Record<string, unknown> }) => void;
}
```

Uses `useExecution(apiPrefix, analysisId, executionId)` which polls every 2s.

States:
- **Queued/Pending**: "Waiting in queue..." with a pulsing indicator and queue position if available
- **Running**: Progress card with analysis type icon, "Running... Step N" if available, elapsed time counter (derived from `created_at`), "Cancel" button (calls `DELETE /api/v1/{prefix}/{id}/executions/{execId}` if endpoint exists, otherwise disabled)
- **Completed**: renders `ResultCards` component with the `result_json`
- **Failed**: error message display with "Retry" button

The elapsed time counter uses `useState` + `setInterval` (1s) comparing `Date.now()` to `created_at`. Stops when terminal.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/investigation/components/clinical/ExecutionTracker.tsx
git commit -m "feat(investigation): add ExecutionTracker with 2s polling and elapsed time counter"
```

---

### Task 5: Result Cards (pinnable results per analysis type)

**Files:**
- Create: `frontend/src/features/investigation/components/clinical/ResultCards.tsx`

- [ ] **Step 1: Create ResultCards**

Create `frontend/src/features/investigation/components/clinical/ResultCards.tsx`:

Renders analysis results as a set of pinnable cards. Different cards based on analysis type.

Props:
```typescript
interface ResultCardsProps {
  analysisType: ClinicalAnalysisType;
  result: Record<string, unknown>;
  onPinFinding: (finding: { domain: string; section: string; finding_type: string; finding_payload: Record<string, unknown> }) => void;
}
```

For each analysis type, extract and display key results:

**Characterization**: Cohort counts table, top features by SMD, demographics summary. Pin type: `cohort_summary`.

**Incidence Rate**: Rate table (rate, CI, person-years), stratified rates if available. Pin type: `incidence_rate`.

**Estimation**: Hazard ratio card (HR, 95% CI, p-value), summary table. Uses `ForestPlotWrapper` from Phase 1b-ii for the forest plot. Pin type: `hazard_ratio`.

**Prediction**: AUC/AUROC card, summary metrics (sensitivity, specificity, PPV, NPV). Pin type: `prediction_model`.

**SCCS**: IRR estimate card with CI. Pin type: `hazard_ratio` (reuse).

**Evidence Synthesis**: Pooled estimate card, heterogeneity (tau, I²). Pin type: `hazard_ratio`.

**Pathway**: Treatment sequence summary (top N pathways). Pin type: `cohort_summary`.

Each result card has a "Pin to Dossier" button that calls `onPinFinding` with `domain: "clinical"`, `section: "clinical_evidence"`.

Use the existing `ForestPlotWrapper` from `../phenotype/ForestPlotWrapper` for any HR/estimate displays. Use `KeyValueGrid`-style cards for summary metrics (recreate the pattern from `workbenchShared.tsx` or import if exportable).

The result extraction is defensive — use `data_get`-style optional chaining since `result_json` shapes vary by analysis type.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/investigation/components/clinical/ResultCards.tsx
git commit -m "feat(investigation): add pinnable ResultCards for all 7 analysis types"
```

---

### Task 6: KM Curve and PS Distribution charts

**Files:**
- Create: `frontend/src/features/investigation/components/clinical/KaplanMeierChart.tsx`
- Create: `frontend/src/features/investigation/components/clinical/PSDistributionChart.tsx`

- [ ] **Step 1: Read existing KM and PS patterns**

Read `frontend/src/features/publish/components/diagrams/KaplanMeierCurve.tsx` to understand the existing D3 KM implementation. Check if it has hardcoded white/light background (like ForestPlot did). If so, create standalone dark-themed versions.

- [ ] **Step 2: Create KaplanMeierChart**

Create `frontend/src/features/investigation/components/clinical/KaplanMeierChart.tsx`:

D3 survival curve component.

Props:
```typescript
interface KaplanMeierChartProps {
  curves: Array<{
    label: string;
    color: string;
    points: Array<{ time: number; survival: number; censored?: boolean }>;
  }>;
  xLabel?: string;    // default "Time (days)"
  yLabel?: string;    // default "Survival Probability"
  width?: number;
  height?: number;
}
```

Step-function line chart with:
- D3 `scaleLinear` for both axes
- Step-function interpolation (`d3.curveStepAfter`)
- Censoring marks (small vertical ticks at censored time points)
- Legend showing curve labels with colors
- Hover tooltip showing time + survival probability
- Dark theme: transparent bg, zinc-300 text/axes, zinc-600 grid, curve colors from props (default: teal for target, crimson for comparator)

Use `useRef + useEffect + d3.select` pattern.

- [ ] **Step 3: Create PSDistributionChart**

Create `frontend/src/features/investigation/components/clinical/PSDistributionChart.tsx`:

D3 mirrored histogram (propensity score distribution).

Props:
```typescript
interface PSDistributionChartProps {
  target: Array<{ bin: number; count: number }>;
  comparator: Array<{ bin: number; count: number }>;
  targetLabel?: string;       // default "Target"
  comparatorLabel?: string;   // default "Comparator"
  width?: number;
  height?: number;
}
```

Mirrored histogram:
- Top half: target distribution (teal bars going up)
- Bottom half: comparator distribution (crimson bars going down)
- X axis: propensity score (0 to 1)
- Y axis: count (symmetric, mirrored)
- Dark theme colors

- [ ] **Step 4: Wire charts into ResultCards**

In `ResultCards.tsx`, import both chart components. For estimation results that contain `kaplan_meier` or `propensity_score` data in `result_json`, render the appropriate chart below the HR card.

Extract KM data: `result.kaplan_meier?.target_curve` and `result.kaplan_meier?.comparator_curve` (defensive chaining).
Extract PS data: `result.propensity_score?.target_distribution` and `result.propensity_score?.comparator_distribution`.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/investigation/components/clinical/KaplanMeierChart.tsx frontend/src/features/investigation/components/clinical/PSDistributionChart.tsx frontend/src/features/investigation/components/clinical/ResultCards.tsx
git commit -m "feat(investigation): add dark-themed D3 Kaplan-Meier curve and PS distribution charts"
```

---

### Task 7: Run History Panel

**Files:**
- Create: `frontend/src/features/investigation/components/clinical/RunHistoryPanel.tsx`

- [ ] **Step 1: Create RunHistoryPanel**

Create `frontend/src/features/investigation/components/clinical/RunHistoryPanel.tsx`:

Lists all clinical analysis executions associated with this investigation's cohorts.

Props:
```typescript
interface RunHistoryPanelProps {
  investigation: Investigation;
  onSelectExecution: (apiPrefix: string, analysisId: number, executionId: number, type: ClinicalAnalysisType) => void;
}
```

Implementation:
- Fetches executions for each analysis type that has been run (tracks analysis IDs in `ClinicalState.queued_analyses`)
- Renders as a table/list: analysis type badge, status badge (teal=completed, amber=running, crimson=failed), created timestamp, elapsed time
- Click a row to view its results (calls `onSelectExecution`)
- "Compare" button appears when 2+ completed executions of the same type exist (shows side-by-side results — deferred to Phase 4, just show the button as disabled with "Coming soon")
- "Replay" button on completed executions (re-executes with same parameters)

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/investigation/components/clinical/RunHistoryPanel.tsx
git commit -m "feat(investigation): add Run History panel for clinical analysis executions"
```

---

### Task 8: ClinicalPanel + EvidenceBoard integration

**Files:**
- Create: `frontend/src/features/investigation/components/clinical/ClinicalPanel.tsx`
- Modify: `frontend/src/features/investigation/components/EvidenceBoard.tsx`
- Modify: `frontend/src/features/investigation/types.ts` (update ClinicalState usage)

- [ ] **Step 1: Create ClinicalPanel**

Create `frontend/src/features/investigation/components/clinical/ClinicalPanel.tsx`:

The clinical domain focus panel. Manages the flow: gallery → config → execution → results.

Props:
```typescript
interface ClinicalPanelProps {
  investigation: Investigation;
}
```

State:
```typescript
const [selectedType, setSelectedType] = useState<ClinicalAnalysisType | null>(null);  // config drawer open
const [activeExecution, setActiveExecution] = useState<{
  apiPrefix: string;
  analysisId: number;
  executionId: number;
  type: ClinicalAnalysisType;
} | null>(null);  // tracking an execution
const [view, setView] = useState<"gallery" | "tracking" | "history">("gallery");
```

Sub-tabs at top: "Gallery" (default), "Active Run" (shown when tracking), "History".

Flow:
1. Gallery view → user clicks analysis card → ConfigDrawer opens as a slide-in
2. User fills config → clicks "Run Analysis" → `onExecute` callback:
   a. Calls `createAnalysis(apiPrefix, designPayload)` to create the analysis design record
   b. Calls `executeAnalysis(apiPrefix, analysisId, sourceId)` to dispatch the queue job
   c. Sets `activeExecution` and switches to "Active Run" view
3. Active Run view → `ExecutionTracker` polls status
4. On completion → results display inline with pin-to-dossier buttons
5. History view → `RunHistoryPanel` shows all past runs

Wire `onPinFinding` through to `ExecutionTracker` → `ResultCards` using `useCreatePin` (same pattern as PhenotypePanel).

Auto-save: update `investigation.clinical_state.queued_analyses` via `useAutoSave` when executions are tracked.

- [ ] **Step 2: Replace DomainPlaceholder in EvidenceBoard**

In `frontend/src/features/investigation/components/EvidenceBoard.tsx`, find the clinical domain case:

```typescript
// BEFORE:
case "clinical":
  return <DomainPlaceholder domain="clinical" phase="Phase 2" />;

// AFTER:
case "clinical":
  return <ClinicalPanel investigation={investigation} />;
```

Import `ClinicalPanel` from `./clinical/ClinicalPanel`.

- [ ] **Step 3: Update ClinicalState type if needed**

In `types.ts`, update the `ClinicalState.queued_analyses` shape. The existing type stores `run_id: number | null` which is insufficient — the panel needs `api_prefix`, `analysis_id`, and `execution_id` to reconstruct polling context. Update to:

```typescript
export interface ClinicalState {
  queued_analyses: Array<{
    analysis_type: ClinicalAnalysisType;
    api_prefix: string;
    analysis_id: number;
    execution_id: number | null;
    config: Record<string, unknown>;
    status: "configured" | "queued" | "running" | "complete" | "failed";
  }>;
  selected_source_id: number | null;
  comparison_run_ids: [number, number] | null;
}
```

This replaces the old `run_id` field with the three fields needed for `useExecution(apiPrefix, analysisId, executionId)` polling. Existing saved state with the old shape will harmlessly deserialize (old `run_id` field ignored, new fields absent → treated as empty).

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/investigation/components/clinical/ frontend/src/features/investigation/components/EvidenceBoard.tsx frontend/src/features/investigation/types.ts
git commit -m "feat(investigation): add ClinicalPanel with gallery → config → execute → results flow"
```

---

### Task 9: Context bar summary for Clinical domain

**Files:**
- Modify: `frontend/src/features/investigation/components/ContextBar.tsx`

- [ ] **Step 1: Update Clinical context card summary**

Read `frontend/src/features/investigation/components/ContextBar.tsx`.

The Clinical domain context card currently shows "—" as a static placeholder. Update it to derive a meaningful summary from `investigation.clinical_state`:

- If `queued_analyses` is empty: "No analyses"
- If any are running: "1 running" (amber text)
- If any completed: "3 analyses · HR 0.72" (show the most recent HR if an estimation completed)
- Count of completed + running + failed

This gives the user a live summary in the context bar without switching to the Clinical domain.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/investigation/components/ContextBar.tsx
git commit -m "feat(investigation): add live Clinical domain summary to context bar"
```

---

### Task 10: Full verification

- [ ] **Step 1: Run frontend TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Run frontend ESLint**

Run: `cd frontend && npx eslint src/features/investigation/`
Expected: PASS (or only pre-existing warnings)

- [ ] **Step 3: Run backend tests (regression)**

Run: `cd backend && vendor/bin/pest tests/Feature/Api/V1/InvestigationCrudTest.php tests/Feature/Api/V1/EvidencePinTest.php`
Expected: 15/15 passing

- [ ] **Step 4: Final commit if lint fixes needed**

```bash
git add -A
git commit -m "chore: lint fixes after Evidence Investigation Phase 2"
```

---

## What Phase 2 Does NOT Include (Deferred)

- **New backend analysis services** — all 7 types are already implemented; this phase only creates the frontend integration layer
- **WebSocket live updates** — Reverb broadcasting event exists but is not wired; polling (2s) is the mechanism. WebSocket upgrade deferred.
- **Run comparison (side-by-side diff)** — button exists in RunHistoryPanel but disabled; full implementation in Phase 4
- **Love plot for covariate balance** — deferred to Phase 4 (requires D3 component + balance data extraction)
- **Negative control calibration plot** — deferred to Phase 4 (requires D3 calibration component)
- **Analysis design persistence to investigation** — currently, analyses are created as standalone records (existing `characterizations`, `estimations` tables). Linking them to investigations via `investigation_id` FK is a future enhancement.
