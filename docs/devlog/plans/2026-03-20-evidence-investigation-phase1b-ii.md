# Evidence Investigation Phase 1b-ii — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the heavy visualizations to the Phenotype domain: D3 Venn diagram for cohort set operations, proper D3 forest plot for CodeWAS results (reusing existing `ForestPlot.tsx`), Recharts bar chart for top signals, attrition waterfall using the existing `AttritionDiagram.tsx` pattern, and cohort operation execution against the FinnGen backend.

**Architecture:** Reuse existing D3/Recharts visualization components from `publish/` and `data-explorer/` features where possible. New D3 Venn diagram component built from scratch for set operations. The CohortBuilder gains an "Execute" flow that calls the existing `finngenCohortOperations` endpoint and displays an attrition funnel. CodeWAS results upgrade from CSS tables to proper D3 forest plot + Recharts bar chart. Volcano plot is deferred (CO2 backend doesn't return per-signal p-values).

**Tech Stack:** D3.js v7 (Venn diagram, forest plot), Recharts v3 (bar charts), React 19, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-20-finngen-evidence-investigation-design.md`

**Depends on:** Phase 1b-i complete

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `frontend/src/features/investigation/components/phenotype/VennDiagram.tsx` | D3-based Venn diagram for 2-3 cohort set operations |
| `frontend/src/features/investigation/components/phenotype/CohortOperationPanel.tsx` | Set operation controls (union/intersect/subtract) + execute button + results |
| `frontend/src/features/investigation/components/phenotype/AttritionFunnel.tsx` | Attrition waterfall visualization using D3 |
| `frontend/src/features/investigation/components/phenotype/SignalsBarChart.tsx` | Recharts horizontal bar chart for CodeWAS top signals |
| `frontend/src/features/investigation/components/phenotype/ForestPlotWrapper.tsx` | Thin wrapper around existing `publish/ForestPlot.tsx` adapted for CodeWAS data |
| `frontend/src/features/investigation/components/phenotype/CohortSizeComparison.tsx` | Recharts bar chart comparing selected cohort sizes |

### Modified Files

| File | Changes |
|------|---------|
| `frontend/src/features/investigation/components/phenotype/CohortBuilder.tsx` | Add CohortOperationPanel + VennDiagram + AttritionFunnel below cohort picker |
| `frontend/src/features/investigation/components/phenotype/CodeWASResults.tsx` | Replace CSS tables with ForestPlotWrapper + SignalsBarChart |
| `frontend/src/features/investigation/types.ts` | Add CohortOperationResult, AttritionStep types |
| `frontend/src/features/investigation/api.ts` | Add executeCohortOperation function |

### Reused Files (read-only reference, import from)

| File | What we reuse |
|------|---------------|
| `frontend/src/features/publish/components/diagrams/ForestPlot.tsx` | D3 forest plot component |
| `frontend/src/features/publish/components/diagrams/AttritionDiagram.tsx` | D3 attrition pattern |
| `frontend/src/features/finngen/api.ts` | `previewFinnGenCohortOperations` function |

---

## Task Breakdown

### Task 1: Add cohort operation types and API function

**Files:**
- Modify: `frontend/src/features/investigation/types.ts`
- Modify: `frontend/src/features/investigation/api.ts`

- [ ] **Step 1: Add cohort operation types**

In `frontend/src/features/investigation/types.ts`, add:

```typescript
export type SetOperationType = "union" | "intersect" | "subtract";

export interface AttritionStep {
  label: string;
  count: number;
  percent: number;
}

export interface CohortOperationResult {
  compile_summary: Record<string, unknown>;
  attrition: AttritionStep[];
  result_count: number;
  operation_type: SetOperationType;
  export_summary: Record<string, unknown>;
  matching_summary?: Record<string, unknown>;
  handoff_ready: boolean;
}
```

- [ ] **Step 2: Add cohort operation API function**

In `frontend/src/features/investigation/api.ts`, add:

```typescript
import { previewFinnGenCohortOperations } from "@/features/finngen/api";
import type { FinnGenSource } from "@/features/finngen/types";

export async function executeCohortOperation(
  source: FinnGenSource,
  selectedCohortIds: number[],
  selectedCohortLabels: string[],
  primaryCohortId: number | null,
  operationType: SetOperationType,
): Promise<CohortOperationResult> {
  // NOTE: previewFinnGenCohortOperations requires a full FinnGenSource object (not just {id})
  // and requires cohort_definition (pass empty object for parthenon import mode)
  const result = await previewFinnGenCohortOperations({
    source,
    cohort_definition: {},
    import_mode: "parthenon",
    operation_type: operationType,
    selected_cohort_ids: selectedCohortIds,
    selected_cohort_labels: selectedCohortLabels,
    primary_cohort_id: primaryCohortId,
    matching_enabled: false,
  });

  const data = result as Record<string, unknown>;
  const attritionRaw = (data.attrition_funnel ?? data.attrition ?? []) as Array<Record<string, unknown>>;
  const resultCount = (data.compile_summary as Record<string, unknown>)?.result_rows as number ?? 0;

  return {
    compile_summary: (data.compile_summary ?? {}) as Record<string, unknown>,
    attrition: attritionRaw.map((step, i) => ({
      label: String(step.label ?? step.step ?? `Step ${i + 1}`),
      count: Number(step.count ?? step.persons ?? 0),
      percent: Number(step.percent ?? step.retention ?? 100),
    })),
    result_count: resultCount,
    operation_type: operationType as SetOperationType,
    export_summary: (data.export_summary ?? {}) as Record<string, unknown>,
    matching_summary: data.matching_summary as Record<string, unknown> | undefined,
    handoff_ready: Boolean(data.handoff_ready ?? false),
  };
}
```

Note: Read `frontend/src/features/finngen/api.ts` to find the exact function name and signature for `previewFinnGenCohortOperations`. It may be named differently — search for `cohort_operations` or `cohortOperations` in that file.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/investigation/types.ts frontend/src/features/investigation/api.ts
git commit -m "feat(investigation): add cohort operation types and API function"
```

---

### Task 2: D3 Venn Diagram component

**Files:**
- Create: `frontend/src/features/investigation/components/phenotype/VennDiagram.tsx`

- [ ] **Step 1: Create VennDiagram component**

Create `frontend/src/features/investigation/components/phenotype/VennDiagram.tsx`:

A D3-based SVG Venn diagram for 2-3 cohorts. Uses the imperative D3 pattern from the existing codebase (see `publish/ForestPlot.tsx` for the `useRef + useEffect + d3.select` pattern).

Props:
```typescript
interface VennCircle {
  id: number;
  label: string;
  count: number;
  color: string;
}

interface VennDiagramProps {
  circles: VennCircle[];          // 2 or 3 cohorts
  operation: SetOperationType;    // highlights the operation region
  resultCount?: number;           // shown in the overlap region
  width?: number;                 // default 400
  height?: number;                // default 300
}
```

Implementation:
- 2 circles: positioned with ~40% overlap, each as a `<circle>` with `fill-opacity: 0.3`
- 3 circles: positioned in a triangle arrangement with pairwise overlaps
- The operation region (union = all, intersect = center overlap, subtract = left minus overlap) is highlighted with a brighter fill
- Labels show cohort name + count below each circle
- Result count shown in the highlighted operation region
- Colors: use the cohort's color prop (default: first=teal `#2DD4BF`, second=crimson `#9B1B30`, third=gold `#C9A227`)
- SVG with `viewBox` for responsive scaling
- Dark theme: background transparent, text `#d4d4d8` (zinc-300), circle strokes `#52525b` (zinc-600)

Use `d3.select(svgRef.current)` to imperatively draw/update on props change. Clean up on unmount.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/investigation/components/phenotype/VennDiagram.tsx
git commit -m "feat(investigation): add D3 Venn diagram for cohort set operations"
```

---

### Task 3: Attrition Funnel component

**Files:**
- Create: `frontend/src/features/investigation/components/phenotype/AttritionFunnel.tsx`

- [ ] **Step 1: Read the existing AttritionDiagram pattern**

Read `frontend/src/features/publish/components/diagrams/AttritionDiagram.tsx` to understand the existing D3 attrition pattern. Adapt it for the investigation context.

- [ ] **Step 2: Create AttritionFunnel component**

Create `frontend/src/features/investigation/components/phenotype/AttritionFunnel.tsx`:

A vertical waterfall/funnel showing how each inclusion/exclusion criterion narrows the population.

Props:
```typescript
interface AttritionFunnelProps {
  steps: AttritionStep[];    // { label, count, percent }
  totalLabel?: string;       // label for the initial population bar (default "Total Population")
}
```

Implementation:
- Vertical stack of horizontal bars, each proportional to `count` relative to the first step's count
- Each bar: colored fill (teal gradient), label on the left, count on the right, percent badge
- Connector lines between bars showing the drop (with delta count in red)
- If only 1 step, show a single full-width bar
- Use D3 `scaleLinear` for bar width scaling
- Dark theme: bars on `#0E0E11` background, teal `#2DD4BF` for included bars, crimson `#9B1B30` for the delta/drop indicators
- SVG with responsive `viewBox`

Alternatively, if the existing `AttritionDiagram.tsx` is a good fit, create a thin wrapper. **IMPORTANT:** The existing `AttritionDiagram` uses `{ label, count, excluded?: number }` where `excluded` is the absolute drop count per step. The investigation's `AttritionStep` uses `{ label, count, percent }`. The wrapper must compute `excluded = steps[i].count - steps[i+1].count` for each step when calling the existing component. Do NOT assume the field shapes are compatible — they are different.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/investigation/components/phenotype/AttritionFunnel.tsx
git commit -m "feat(investigation): add attrition funnel D3 visualization"
```

---

### Task 4: Cohort Operation Panel (integrates Venn + Attrition + execute)

**Files:**
- Create: `frontend/src/features/investigation/components/phenotype/CohortOperationPanel.tsx`
- Create: `frontend/src/features/investigation/components/phenotype/CohortSizeComparison.tsx`
- Modify: `frontend/src/features/investigation/components/phenotype/CohortBuilder.tsx`

- [ ] **Step 1: Create CohortSizeComparison**

Create `frontend/src/features/investigation/components/phenotype/CohortSizeComparison.tsx`:

A simple Recharts horizontal bar chart showing the size of each selected cohort.

Props:
```typescript
interface CohortSizeComparisonProps {
  cohorts: Array<{ id: number; name: string; count: number }>;
  primaryId: number | null;
}
```

Use Recharts `BarChart` with `ResponsiveContainer` (follow the pattern from `data-explorer/TopConceptsBar.tsx`). Primary cohort bar gets gold color, others get teal. Dark theme bar fill.

- [ ] **Step 2: Create CohortOperationPanel**

Create `frontend/src/features/investigation/components/phenotype/CohortOperationPanel.tsx`:

The set operation controls + visualization section. Only renders when 2+ cohorts are selected.

Props:
```typescript
interface CohortOperationPanelProps {
  selectedCohorts: Array<{ id: number; name: string; count: number }>;
  primaryId: number | null;
  onOperationComplete: (result: CohortOperationResult) => void;
}
```

Layout:
1. **Cohort size comparison** — `CohortSizeComparison` bar chart at top
2. **Operation selector** — 3 radio buttons: Union, Intersect, Subtract. Each with a one-line description.
3. **Venn diagram** — `VennDiagram` with circles derived from selected cohorts, operation highlighted
4. **Source selector** — dropdown for CDM source (same `fetchSources` pattern as CodeWASRunner)
5. **Execute button** — "Run Cohort Operation" (crimson). Calls `executeCohortOperation` from `api.ts`
6. **Results section** (shown after execution):
   - Result count badge (large, teal)
   - `AttritionFunnel` visualization
   - Compile summary as key-value grid
   - "Pin to Dossier" button

Uses `useMutation` for the execute call. Loading state with spinner.

- [ ] **Step 3: Integrate CohortOperationPanel into CohortBuilder**

In `frontend/src/features/investigation/components/phenotype/CohortBuilder.tsx`:

After the selected cohorts chips section, add:

```typescript
{selectedCohorts.length >= 2 && (
  <CohortOperationPanel
    selectedCohorts={selectedCohorts}
    primaryId={primaryId}
    onOperationComplete={handleOperationComplete}
  />
)}
```

To get `selectedCohorts` with names and counts, use the data from `useCohortDefinitions` to resolve the names/counts for the selected IDs. Either pass the full cohort list down from CohortPicker or look them up in CohortBuilder.

Wire `handleOperationComplete` to call `onPinFinding` (add this prop to CohortBuilder) with `finding_type: "cohort_summary"`, including the result count and operation details in the payload.

Also add `onPinFinding` prop to CohortBuilder, wired from PhenotypePanel (same pattern as CodeWASRunner).

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/investigation/components/phenotype/CohortSizeComparison.tsx frontend/src/features/investigation/components/phenotype/CohortOperationPanel.tsx frontend/src/features/investigation/components/phenotype/CohortBuilder.tsx
git commit -m "feat(investigation): add cohort set operations with Venn diagram and attrition funnel"
```

---

### Task 5: Upgrade CodeWAS results with proper charts

**Files:**
- Create: `frontend/src/features/investigation/components/phenotype/SignalsBarChart.tsx`
- Create: `frontend/src/features/investigation/components/phenotype/ForestPlotWrapper.tsx`
- Modify: `frontend/src/features/investigation/components/phenotype/CodeWASResults.tsx`

- [ ] **Step 1: Create SignalsBarChart**

Create `frontend/src/features/investigation/components/phenotype/SignalsBarChart.tsx`:

A Recharts horizontal bar chart for CodeWAS top signals.

Props:
```typescript
interface SignalsBarChartProps {
  signals: Array<{ label: string; count: number }>;
  maxSignals?: number;    // default 20
  onSignalClick?: (label: string) => void;
}
```

Use Recharts `BarChart` with `layout="vertical"`, `ResponsiveContainer`, custom teal fill. Follow the `TopConceptsBar.tsx` pattern. Truncate labels to 40 chars. Sort by count descending.

- [ ] **Step 2: Create ForestPlotWrapper**

Create `frontend/src/features/investigation/components/phenotype/ForestPlotWrapper.tsx`:

**IMPORTANT:** The existing `publish/ForestPlot.tsx` has a **hardcoded white background** (`#ffffff` rect) and dark text colors (`#333`, `#555`) — it is designed for a light-background context and is incompatible with the investigation's dark clinical theme without modification.

**Recommended approach:** Create a standalone dark-themed D3 forest plot in `ForestPlotWrapper.tsx` rather than wrapping the publish component. Use the same imperative `useRef + useEffect + d3.select` pattern from the publish ForestPlot as a reference, but with dark theme colors:
- Background: transparent (inherits dark parent)
- Text: `#d4d4d8` (zinc-300)
- Axis lines: `#52525b` (zinc-600)
- CI bars: `#9B1B30` (crimson)
- Point estimates: `#2DD4BF` (teal)
- Null line: `#C9A227` (gold, dashed)

```typescript
interface ForestPlotWrapperProps {
  data: Array<{ label: string; hr: number; lower: number; upper: number }>;
  title?: string;
  width?: number;
  height?: number;
}
```

Use `d3.scaleLog` for the HR axis (centered on 1.0), `d3.scaleBand` for the label axis. Each row: label text on the left, CI bar with point estimate dot, HR text on the right.

- [ ] **Step 3: Replace CSS tables in CodeWASResults with proper charts**

In `frontend/src/features/investigation/components/phenotype/CodeWASResults.tsx`:

Replace the existing rendering:
1. **Top signals section**: Replace the CSS progress bar table with `<SignalsBarChart signals={result.top_signals} />`. Keep the "Pin" buttons in a separate table below the chart (or as a click handler on the chart bars via `onSignalClick`).
2. **Forest plot section**: Replace the CSS-based inline bars with `<ForestPlotWrapper data={result.forest_plot} />` when `result.forest_plot` has data.
3. Keep the summary bar and volcano placeholder as-is.
4. Keep the Pin button per signal in the table — the chart is for visual, the table with Pin buttons stays below it.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/investigation/components/phenotype/SignalsBarChart.tsx frontend/src/features/investigation/components/phenotype/ForestPlotWrapper.tsx frontend/src/features/investigation/components/phenotype/CodeWASResults.tsx
git commit -m "feat(investigation): upgrade CodeWAS results with D3 forest plot and Recharts signal bar chart"
```

---

### Task 6: Wire pin-to-dossier from CohortBuilder

**Files:**
- Modify: `frontend/src/features/investigation/components/PhenotypePanel.tsx`
- Modify: `frontend/src/features/investigation/components/phenotype/CohortBuilder.tsx`

- [ ] **Step 1: Add onPinFinding prop to CohortBuilder**

In `CohortBuilder.tsx`, add `onPinFinding` to the props interface (same shape as CodeWASRunner's). Thread it down to `CohortOperationPanel`.

In `PhenotypePanel.tsx`, pass `onPinFinding={handlePinFinding}` to `CohortBuilder` (reuse the same pin creation handler already wired for CodeWASRunner).

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/investigation/components/PhenotypePanel.tsx frontend/src/features/investigation/components/phenotype/CohortBuilder.tsx
git commit -m "feat(investigation): wire cohort operation results to pin-to-dossier"
```

---

### Task 7: Full verification

- [ ] **Step 1: Run frontend TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Run frontend ESLint on investigation feature**

Run: `cd frontend && npx eslint src/features/investigation/`
Expected: PASS (or only pre-existing warnings)

- [ ] **Step 3: Run backend tests (regression check)**

Run: `cd backend && vendor/bin/pest tests/Feature/Api/V1/InvestigationCrudTest.php tests/Feature/Api/V1/EvidencePinTest.php`
Expected: All 15 tests still pass

- [ ] **Step 4: Final commit if any lint fixes needed**

```bash
git add -A
git commit -m "chore: lint fixes after Evidence Investigation Phase 1b-ii"
```

---

## Deferred to Phase 2+

- **Volcano plot** — CO2 backend `codewas_preview` module returns `{label, count}` signals, not statistical fields (p-value, odds ratio). A true volcano plot (x=log2OR, y=-log10p) requires either extending the R-runtime CodeWAS module to return per-signal statistics, or creating a new backend service. Deferred until the CodeWAS response contract is expanded.
- **TimeCodeWAS temporal heatmap** — Similar dependency: the `timecodewas_preview` module returns display data, not the raw temporal association matrix needed for a D3 heatmap. Deferred to Phase 2 alongside the full Clinical Evidence domain.
- **Matching panel with live love plot** — Matching configuration UI exists in CohortBuilder but matching execution with balance diagnostics is deferred. The `matching_enabled: false` flag is hardcoded in `executeCohortOperation`. Phase 2 will add matching parameter controls and a D3 love plot for covariate balance.
