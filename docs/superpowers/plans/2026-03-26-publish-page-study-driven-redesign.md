# Publish Page: Study-Driven Manuscript Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Publish page to compose manuscripts organized by research question (not analysis type), with rich data tables + AI narrative + diagrams per section, and study-driven bulk selection.

**Architecture:** Enhance the existing 4-step wizard. Step 1 gets "Select All" per study + `?studyId` URL param auto-selection. Step 2 gets a new `buildManuscriptSections()` that groups analyses by research question. Step 3 gets a new `ResultsTable` component for structured data rendering. No backend changes.

**Tech Stack:** React 19, TypeScript strict, TanStack Query, dnd-kit, Recharts (existing), Lucide icons, Tailwind 4

**Spec:** `docs/superpowers/specs/2026-03-26-publish-page-study-driven-redesign.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `frontend/src/features/publish/types/publish.ts` | Add `TableData` interface, extend `ReportSection` |
| Create | `frontend/src/features/publish/lib/tableBuilders.ts` | Extract `TableData` from `result_json` per analysis type |
| Create | `frontend/src/features/publish/components/ResultsTable.tsx` | Render `TableData` as publication-style HTML table |
| Modify | `frontend/src/features/publish/components/UnifiedAnalysisPicker.tsx` | Add "Select All" / "Deselect All" per study, handle `?studyId` |
| Modify | `frontend/src/features/publish/pages/PublishPage.tsx` | New `buildManuscriptSections()`, `?studyId` param, Introduction section |
| Modify | `frontend/src/features/publish/components/SectionEditor.tsx` | Add table/narrative/diagram toggle controls |
| Modify | `frontend/src/features/publish/components/DocumentConfigurator.tsx` | Pass toggle handlers to SectionEditor |
| Modify | `frontend/src/features/publish/components/DocumentPreview.tsx` | Render `ResultsTable`, auto-number tables + figures |
| Modify | `frontend/src/features/studies/pages/StudyDetailPage.tsx` | Add "Generate Manuscript" button |

---

### Task 1: Extend Types — Add `TableData` and section toggles

**Files:**
- Modify: `frontend/src/features/publish/types/publish.ts`

- [ ] **Step 1: Add `TableData` interface and extend `ReportSection`**

Add the following to the end of `frontend/src/features/publish/types/publish.ts`, before the closing of the file:

```typescript
export interface TableData {
  caption: string;
  headers: string[];
  rows: Array<Record<string, string | number>>;
  footnotes?: string[];
}
```

Then add optional fields to the existing `ReportSection` interface:

```typescript
// Add these fields to the existing ReportSection interface:
tableData?: TableData;
tableIncluded?: boolean;
narrativeIncluded?: boolean;
diagramIncluded?: boolean;
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit`
Expected: No new errors (existing errors may be present)

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/publish/types/publish.ts
git commit -m "feat(publish): add TableData type and section toggle fields to ReportSection"
```

---

### Task 2: Create table builders — extract structured data from result_json

**Files:**
- Create: `frontend/src/features/publish/lib/tableBuilders.ts`

- [ ] **Step 1: Create the table builder module**

Create `frontend/src/features/publish/lib/tableBuilders.ts`:

```typescript
// ---------------------------------------------------------------------------
// Table Builders — extract TableData from result_json per analysis type
// ---------------------------------------------------------------------------

import type { TableData, SelectedExecution } from "../types/publish";

// ── Incidence Rates ─────────────────────────────────────────────────────────
// Consolidates multiple IR executions into one comparison table

function buildIncidenceRateTable(executions: SelectedExecution[]): TableData {
  const rows: Array<Record<string, string | number>> = [];

  for (const exec of executions) {
    const result = exec.resultJson;
    if (!result) continue;

    // Handle both single-result and multi-outcome shapes
    const outcomes = Array.isArray(result.outcomes)
      ? (result.outcomes as Array<Record<string, unknown>>)
      : [result];

    for (const outcome of outcomes) {
      const rates = Array.isArray(outcome.rates)
        ? (outcome.rates as Array<Record<string, unknown>>)
        : [outcome];

      for (const rate of rates) {
        rows.push({
          Cohort: (rate.cohort_name as string) ?? exec.analysisName,
          Outcome: (rate.outcome_name as string) ?? (outcome.outcome_name as string) ?? "—",
          Events: (rate.event_count as number) ?? (rate.outcomes as number) ?? 0,
          "Person-Years": typeof rate.person_years === "number"
            ? Math.round(rate.person_years * 10) / 10
            : 0,
          "Rate/1000PY": typeof rate.incidence_rate === "number"
            ? Math.round(rate.incidence_rate * 100) / 100
            : 0,
        });
      }
    }
  }

  // Fallback: if no structured rates extracted, build from top-level fields
  if (rows.length === 0) {
    for (const exec of executions) {
      const r = exec.resultJson;
      if (!r) continue;
      rows.push({
        Cohort: exec.analysisName,
        Outcome: "—",
        Events: (r.event_count as number) ?? (r.outcomes as number) ?? 0,
        "Person-Years": typeof r.person_years === "number"
          ? Math.round(r.person_years * 10) / 10
          : 0,
        "Rate/1000PY": typeof r.incidence_rate === "number"
          ? Math.round(r.incidence_rate * 100) / 100
          : 0,
      });
    }
  }

  return {
    caption: "Incidence rates by cohort",
    headers: ["Cohort", "Outcome", "Events", "Person-Years", "Rate/1000PY"],
    rows,
  };
}

// ── Estimation ──────────────────────────────────────────────────────────────

function buildEstimationTable(executions: SelectedExecution[]): TableData {
  const rows: Array<Record<string, string | number>> = [];

  for (const exec of executions) {
    const r = exec.resultJson;
    if (!r) continue;

    const estimates = Array.isArray(r.estimates)
      ? (r.estimates as Array<Record<string, unknown>>)
      : [r];

    for (const est of estimates) {
      rows.push({
        Outcome: (est.outcome_name as string) ?? exec.analysisName,
        HR: typeof est.hr === "number" ? Math.round(est.hr * 100) / 100 : "—",
        "95% CI": typeof est.ci_95_lower === "number" && typeof est.ci_95_upper === "number"
          ? `${(est.ci_95_lower as number).toFixed(2)}–${(est.ci_95_upper as number).toFixed(2)}`
          : "—",
        "p-value": typeof est.p_value === "number"
          ? (est.p_value as number) < 0.001 ? "<0.001" : (est.p_value as number).toFixed(4)
          : "—",
        Events: (est.event_count as number) ?? "—",
      });
    }
  }

  return {
    caption: "Comparative effectiveness estimates",
    headers: ["Outcome", "HR", "95% CI", "p-value", "Events"],
    rows,
  };
}

// ── SCCS ────────────────────────────────────────────────────────────────────

function buildSccsTable(executions: SelectedExecution[]): TableData {
  const rows: Array<Record<string, string | number>> = [];

  for (const exec of executions) {
    const r = exec.resultJson;
    if (!r) continue;

    const windows = Array.isArray(r.estimates)
      ? (r.estimates as Array<Record<string, unknown>>)
      : Array.isArray(r.windows)
        ? (r.windows as Array<Record<string, unknown>>)
        : [r];

    for (const w of windows) {
      rows.push({
        "Exposure Window": (w.window_name as string) ?? (w.covariate_name as string) ?? "—",
        IRR: typeof w.irr === "number" ? Math.round(w.irr * 100) / 100 : "—",
        "95% CI": typeof w.ci_95_lower === "number" && typeof w.ci_95_upper === "number"
          ? `${(w.ci_95_lower as number).toFixed(2)}–${(w.ci_95_upper as number).toFixed(2)}`
          : "—",
      });
    }
  }

  return {
    caption: "Self-controlled case series: incidence rate ratios by exposure window",
    headers: ["Exposure Window", "IRR", "95% CI"],
    rows,
  };
}

// ── Pathways ────────────────────────────────────────────────────────────────

function buildPathwaysTable(executions: SelectedExecution[]): TableData {
  const rows: Array<Record<string, string | number>> = [];

  for (const exec of executions) {
    const r = exec.resultJson;
    if (!r) continue;

    const pathways = Array.isArray(r.pathways)
      ? (r.pathways as Array<Record<string, unknown>>)
      : [];

    // Take top 10 pathways
    const top = pathways.slice(0, 10);
    for (const p of top) {
      rows.push({
        Pathway: (p.pathway_name as string) ?? (p.name as string) ?? "—",
        Patients: (p.patient_count as number) ?? 0,
        "%": typeof p.percentage === "number"
          ? Math.round(p.percentage * 100) / 100
          : "—",
      });
    }

    // If no structured pathways, add summary row
    if (top.length === 0) {
      rows.push({
        Pathway: exec.analysisName,
        Patients: (r.patients_with_events as number) ?? (r.total_patients as number) ?? "—",
        "%": "—",
      });
    }
  }

  return {
    caption: "Treatment pathways (top 10)",
    headers: ["Pathway", "Patients", "%"],
    rows,
  };
}

// ── Characterization ────────────────────────────────────────────────────────

function buildCharacterizationTable(executions: SelectedExecution[]): TableData {
  const rows: Array<Record<string, string | number>> = [];

  for (const exec of executions) {
    const r = exec.resultJson;
    if (!r) continue;

    const cohorts = Array.isArray(r.cohorts)
      ? (r.cohorts as Array<Record<string, unknown>>)
      : [];

    for (const c of cohorts) {
      rows.push({
        Cohort: (c.cohort_name as string) ?? exec.analysisName,
        "N": (c.count as number) ?? 0,
        "Mean Age": typeof c.mean_age === "number" ? Math.round(c.mean_age * 10) / 10 : "—",
        "% Female": typeof c.pct_female === "number" ? Math.round(c.pct_female * 10) / 10 : "—",
      });
    }

    // Fallback for flat result shape
    if (cohorts.length === 0) {
      rows.push({
        Cohort: exec.analysisName,
        "N": (r.total_count as number) ?? (r.count as number) ?? "—",
        "Mean Age": "—",
        "% Female": "—",
      });
    }
  }

  return {
    caption: "Population characteristics",
    headers: ["Cohort", "N", "Mean Age", "% Female"],
    rows,
  };
}

// ── Prediction ──────────────────────────────────────────────────────────────

function buildPredictionTable(executions: SelectedExecution[]): TableData {
  const rows: Array<Record<string, string | number>> = [];

  for (const exec of executions) {
    const r = exec.resultJson;
    if (!r) continue;

    rows.push({
      Model: exec.analysisName,
      AUC: typeof r.auc === "number" ? Math.round(r.auc * 1000) / 1000 : "—",
      "Brier Score": typeof r.brier_score === "number" ? Math.round(r.brier_score * 1000) / 1000 : "—",
      AUPRC: typeof r.auprc === "number" ? Math.round(r.auprc * 1000) / 1000 : "—",
      "Target N": (r.target_count as number) ?? "—",
      "Outcome N": (r.outcome_count as number) ?? "—",
    });
  }

  return {
    caption: "Prediction model performance",
    headers: ["Model", "AUC", "Brier Score", "AUPRC", "Target N", "Outcome N"],
    rows,
  };
}

// ── Evidence Synthesis ──────────────────────────────────────────────────────

function buildEvidenceSynthesisTable(executions: SelectedExecution[]): TableData {
  const rows: Array<Record<string, string | number>> = [];

  for (const exec of executions) {
    const r = exec.resultJson;
    if (!r) continue;

    rows.push({
      Analysis: exec.analysisName,
      "Pooled Estimate": typeof r.pooled_estimate === "number"
        ? Math.round(r.pooled_estimate * 100) / 100 : "—",
      "95% CI": typeof r.ci_lower === "number" && typeof r.ci_upper === "number"
        ? `${(r.ci_lower as number).toFixed(2)}–${(r.ci_upper as number).toFixed(2)}`
        : "—",
      "I²": typeof r.i_squared === "number"
        ? `${Math.round(r.i_squared * 10) / 10}%` : "—",
    });
  }

  return {
    caption: "Evidence synthesis: pooled estimates",
    headers: ["Analysis", "Pooled Estimate", "95% CI", "I²"],
    rows,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

const TABLE_BUILDERS: Record<string, (execs: SelectedExecution[]) => TableData> = {
  characterizations: buildCharacterizationTable,
  incidence_rates: buildIncidenceRateTable,
  estimations: buildEstimationTable,
  sccs: buildSccsTable,
  pathways: buildPathwaysTable,
  predictions: buildPredictionTable,
  evidence_synthesis: buildEvidenceSynthesisTable,
};

export function buildTableFromResults(
  analysisType: string,
  executions: SelectedExecution[],
): TableData | undefined {
  const builder = TABLE_BUILDERS[analysisType];
  if (!builder) return undefined;

  const withResults = executions.filter((e) => e.resultJson !== null);
  if (withResults.length === 0) return undefined;

  return builder(withResults);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/publish/lib/tableBuilders.ts
git commit -m "feat(publish): add table builders to extract structured data from result_json"
```

---

### Task 3: Create `ResultsTable` component

**Files:**
- Create: `frontend/src/features/publish/components/ResultsTable.tsx`

- [ ] **Step 1: Create the ResultsTable component**

Create `frontend/src/features/publish/components/ResultsTable.tsx`:

```tsx
// ---------------------------------------------------------------------------
// ResultsTable — publication-style HTML table for manuscript preview
// ---------------------------------------------------------------------------

import type { TableData } from "../types/publish";

interface ResultsTableProps {
  data: TableData;
  tableNumber: number;
}

export default function ResultsTable({ data, tableNumber }: ResultsTableProps) {
  if (data.rows.length === 0) {
    return (
      <div className="my-4 text-sm italic text-gray-400">
        No structured data available for this table.
      </div>
    );
  }

  return (
    <div className="my-6">
      {/* Caption */}
      <p
        className="mb-2 text-sm font-semibold text-gray-700"
        style={{ fontSize: "10pt" }}
      >
        Table {tableNumber}. {data.caption}
      </p>

      {/* Table */}
      <table
        className="w-full border-collapse text-sm text-gray-800"
        style={{ fontSize: "10pt", lineHeight: 1.5 }}
      >
        <thead>
          <tr
            className="border-t-2 border-b border-gray-900"
            style={{ borderBottomWidth: "1px", borderBottomColor: "#999" }}
          >
            {data.headers.map((header) => (
              <th
                key={header}
                className="px-2 py-1.5 text-left font-semibold"
                style={{
                  textAlign: header === data.headers[0] ? "left" : "right",
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, rowIdx) => (
            <tr
              key={rowIdx}
              className={rowIdx === data.rows.length - 1 ? "border-b-2 border-gray-900" : "border-b border-gray-200"}
            >
              {data.headers.map((header, colIdx) => (
                <td
                  key={header}
                  className="px-2 py-1"
                  style={{ textAlign: colIdx === 0 ? "left" : "right" }}
                >
                  {row[header] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footnotes */}
      {data.footnotes && data.footnotes.length > 0 && (
        <div className="mt-1 space-y-0.5">
          {data.footnotes.map((note, i) => (
            <p key={i} className="text-xs text-gray-500" style={{ fontSize: "8pt" }}>
              {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/publish/components/ResultsTable.tsx
git commit -m "feat(publish): add ResultsTable component for publication-style data tables"
```

---

### Task 4: Enhance `UnifiedAnalysisPicker` — Select All per study + `?studyId` auto-select

**Files:**
- Modify: `frontend/src/features/publish/components/UnifiedAnalysisPicker.tsx`

- [ ] **Step 1: Add `studyId` prop and "Select All" functionality**

In `frontend/src/features/publish/components/UnifiedAnalysisPicker.tsx`:

First, add `useSearchParams` import and the `initialStudyId` prop:

```typescript
// Replace the existing import line:
import { useState, useMemo } from "react";
// With:
import { useState, useMemo, useEffect } from "react";
```

Add `useSearchParams` to react-router-dom import (add a new import):

```typescript
import { useSearchParams } from "react-router-dom";
```

Update the `UnifiedAnalysisPickerProps` interface to add `initialStudyId`:

```typescript
interface UnifiedAnalysisPickerProps {
  selections: SelectedExecution[];
  onSelectionsChange: (selections: SelectedExecution[]) => void;
  onNext: () => void;
  initialStudyId?: number;
}
```

Update the component signature to accept `initialStudyId`:

```typescript
export default function UnifiedAnalysisPicker({
  selections,
  onSelectionsChange,
  onNext,
  initialStudyId,
}: UnifiedAnalysisPickerProps) {
```

Change the initial `activeTab` state to switch to studies when `initialStudyId` is present:

```typescript
const [activeTab, setActiveTab] = useState<"all" | "studies">(
  initialStudyId ? "studies" : "all"
);
```

- [ ] **Step 2: Add auto-select effect for `initialStudyId`**

Add the following `useEffect` after the `filteredAnalyses` useMemo block (around line 94), before `handleToggle`:

```typescript
// Auto-select all completed analyses from initialStudyId
useEffect(() => {
  if (!initialStudyId || studies.length === 0 || selections.length > 0) return;

  const study = studies.find((s) => s.id === initialStudyId);
  if (!study) return;

  // Expand the study
  setExpandedStudies(new Set([initialStudyId]));

  // Build selections from completed analyses
  const studyAnalyses = (study.analyses ?? []).filter(
    (sa) => sa.analysis?.latest_execution?.status === "completed"
  );

  const autoSelections: SelectedExecution[] = studyAnalyses.map((sa) => ({
    executionId: sa.analysis!.latest_execution!.id,
    analysisId: sa.analysis!.id,
    analysisType: sa.analysis_type,
    analysisName: sa.analysis!.name,
    studyId: study.id,
    studyTitle: study.title,
    resultJson: sa.analysis!.latest_execution!.result_json,
    designJson: {},
  }));

  if (autoSelections.length > 0) {
    onSelectionsChange(autoSelections);
  }
}, [initialStudyId, studies, selections.length, onSelectionsChange]);
```

- [ ] **Step 3: Add "Select All" / "Deselect All" button per study**

In the studies tab rendering (the `studies.map((study) => { ... })` block, around line 250), add a helper function before the return statement of the component:

```typescript
const handleSelectAllFromStudy = (study: { id: number; title: string; analyses?: Array<{ id: number; analysis_type: string; analysis?: { id: number; name: string; latest_execution?: { id: number; status: string; result_json: Record<string, unknown> | null; completed_at: string | null } | null } }> }) => {
  const studyAnalyses = (study.analyses ?? []).filter(
    (sa) => sa.analysis?.latest_execution?.status === "completed"
  );

  const studyExecIds = new Set(
    studyAnalyses.map((sa) => sa.analysis!.latest_execution!.id)
  );

  // Check if all are already selected
  const allSelected = studyAnalyses.every((sa) =>
    isSelected(selections, sa.analysis!.latest_execution!.id)
  );

  if (allSelected) {
    // Deselect all from this study
    onSelectionsChange(
      selections.filter((s) => !studyExecIds.has(s.executionId))
    );
  } else {
    // Select all from this study (add ones not already selected)
    const existingIds = new Set(selections.map((s) => s.executionId));
    const newSelections = studyAnalyses
      .filter((sa) => !existingIds.has(sa.analysis!.latest_execution!.id))
      .map((sa) => ({
        executionId: sa.analysis!.latest_execution!.id,
        analysisId: sa.analysis!.id,
        analysisType: sa.analysis_type,
        analysisName: sa.analysis!.name,
        studyId: study.id,
        studyTitle: study.title,
        resultJson: sa.analysis!.latest_execution!.result_json,
        designJson: {},
      }));
    onSelectionsChange([...selections, ...newSelections]);
  }
};
```

Then, inside the study card's header button area (after the `<p>` showing "{studyAnalyses.length} completed..."), add the Select All button. Replace the existing study card rendering block (the `studies.map` callback) with the updated version that includes the button between the study header and the expandable analysis list:

Find the `<p className="text-xs text-[#5A5650]">` line showing completion count and add a "Select All" button after the study header button, before the expanded section:

```tsx
{/* Add this right after the study header <button> closing tag, before the {expanded && ...} block */}
{studyAnalyses.length > 0 && (
  <div className="flex items-center justify-between px-3 py-1.5 border-t border-[#232328]">
    <span className="text-xs text-[#5A5650]">
      {studyAnalyses.length} completed{" "}
      {studyAnalyses.length === 1 ? "analysis" : "analyses"}
    </span>
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        handleSelectAllFromStudy(study);
      }}
      className="text-xs font-medium text-[#C9A227] hover:text-[#d4ad2f] transition-colors"
    >
      {studyAnalyses.every((sa) =>
        isSelected(selections, sa.analysis!.latest_execution!.id)
      )
        ? "Deselect All"
        : "Select All"}
    </button>
  </div>
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 5: Run Pint (no PHP changes but good habit)**

N/A — frontend only task

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/publish/components/UnifiedAnalysisPicker.tsx
git commit -m "feat(publish): add Select All per study and studyId auto-selection in analysis picker"
```

---

### Task 5: Rewrite `PublishPage` — manuscript section builder + `?studyId` param

**Files:**
- Modify: `frontend/src/features/publish/pages/PublishPage.tsx`

- [ ] **Step 1: Add `useSearchParams` and pass `initialStudyId` to picker**

In `frontend/src/features/publish/pages/PublishPage.tsx`, add the import:

```typescript
import { useSearchParams } from "react-router-dom";
```

Inside the `PublishPage` component, add before the `useReducer` call:

```typescript
const [searchParams] = useSearchParams();
const initialStudyId = searchParams.get("studyId")
  ? Number(searchParams.get("studyId"))
  : undefined;
```

Update the `UnifiedAnalysisPicker` JSX to pass `initialStudyId`:

```tsx
<UnifiedAnalysisPicker
  selections={state.selectedExecutions}
  onSelectionsChange={handleSelectionsChange}
  onNext={handleStep1Next}
  initialStudyId={initialStudyId}
/>
```

- [ ] **Step 2: Add the import for `buildTableFromResults`**

```typescript
import { buildTableFromResults } from "../lib/tableBuilders";
```

- [ ] **Step 3: Replace `buildSectionsFromExecutions` with `buildManuscriptSections`**

Replace the entire `buildSectionsFromExecutions` function and `diagramTypeForAnalysis` function with:

```typescript
// ── Research-question section config ────────────────────────────────────────

const SECTION_CONFIG: Record<string, { title: string; diagramType: DiagramType | null }> = {
  characterizations: { title: "Population Characteristics", diagramType: "attrition" },
  incidence_rates: { title: "Incidence Rates", diagramType: null },
  estimations: { title: "Comparative Effectiveness", diagramType: "forest_plot" },
  pathways: { title: "Treatment Patterns", diagramType: null },
  sccs: { title: "Safety Analysis", diagramType: null },
  predictions: { title: "Predictive Modeling", diagramType: "kaplan_meier" },
  evidence_synthesis: { title: "Evidence Synthesis", diagramType: "forest_plot" },
};

function buildManuscriptSections(
  executions: SelectedExecution[],
): ReportSection[] {
  const sections: ReportSection[] = [];

  // 1. Introduction
  sections.push({
    id: "introduction",
    title: "Introduction",
    type: "methods",
    included: true,
    content: "",
    narrativeState: "idle",
    tableIncluded: false,
    narrativeIncluded: true,
    diagramIncluded: false,
  });

  // 2. Methods (unified across all analysis types)
  sections.push({
    id: "methods",
    title: "Methods",
    type: "methods",
    included: true,
    content: "",
    narrativeState: "idle",
    tableIncluded: false,
    narrativeIncluded: true,
    diagramIncluded: false,
  });

  // 3. Results subsections — grouped by analysis type
  const groupedByType = new Map<string, SelectedExecution[]>();
  for (const exec of executions) {
    const group = groupedByType.get(exec.analysisType) ?? [];
    group.push(exec);
    groupedByType.set(exec.analysisType, group);
  }

  // Order: characterizations, incidence_rates, pathways, estimations, sccs, predictions, evidence_synthesis
  const typeOrder = [
    "characterizations",
    "incidence_rates",
    "pathways",
    "estimations",
    "sccs",
    "predictions",
    "evidence_synthesis",
  ];

  for (const analysisType of typeOrder) {
    const groupExecs = groupedByType.get(analysisType);
    if (!groupExecs || groupExecs.length === 0) continue;

    const config = SECTION_CONFIG[analysisType] ?? {
      title: analysisType.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      diagramType: null,
    };

    const tableData = buildTableFromResults(analysisType, groupExecs);

    // Results subsection with table + narrative + optional diagram
    sections.push({
      id: `results-${analysisType}`,
      title: config.title,
      type: "results",
      analysisType,
      included: true,
      content: "",
      narrativeState: "idle",
      tableData,
      tableIncluded: tableData !== undefined,
      narrativeIncluded: true,
      diagramIncluded: config.diagramType !== null,
      diagramType: config.diagramType ?? undefined,
      diagramData: config.diagramType
        ? (groupExecs[0].resultJson as Record<string, unknown>) ?? undefined
        : undefined,
    });
  }

  // 4. Discussion
  sections.push({
    id: "discussion",
    title: "Discussion",
    type: "discussion",
    included: true,
    content: "",
    narrativeState: "idle",
    tableIncluded: false,
    narrativeIncluded: true,
    diagramIncluded: false,
  });

  return sections;
}
```

- [ ] **Step 4: Update `handleStep1Next` to use `buildManuscriptSections`**

The existing `handleStep1Next` already calls `buildSectionsFromExecutions` — just change the function name:

```typescript
const handleStep1Next = useCallback(() => {
  const sections = buildManuscriptSections(state.selectedExecutions);
  const defaultTitle =
    state.selectedExecutions.length > 0
      ? state.selectedExecutions[0].studyTitle ?? state.selectedExecutions[0].analysisName
      : "Untitled Document";

  dispatch({ type: "SET_SECTIONS", sections });
  dispatch({ type: "SET_TITLE", title: state.title || defaultTitle });
  dispatch({ type: "SET_STEP", step: 2 });
}, [state.selectedExecutions, state.title]);
```

Note: Changed `defaultTitle` to prefer `studyTitle` when available.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 6: Verify production build**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vite build`
Expected: Build succeeds

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/publish/pages/PublishPage.tsx
git commit -m "feat(publish): replace analysis-type sections with research-question manuscript structure"
```

---

### Task 6: Update `SectionEditor` — add table/narrative/diagram toggles

**Files:**
- Modify: `frontend/src/features/publish/components/SectionEditor.tsx`

- [ ] **Step 1: Add toggle callback props**

Add a new prop to `SectionEditorProps`:

```typescript
interface SectionEditorProps {
  section: ReportSection;
  index: number;
  totalSections: number;
  onToggle: (id: string) => void;
  onMove: (id: string, direction: "up" | "down") => void;
  onContentChange: (id: string, content: string) => void;
  onNarrativeStateChange: (id: string, state: NarrativeState) => void;
  onGenerateNarrative: (section: ReportSection) => void;
  isGenerating: boolean;
  onToggleElement?: (id: string, element: "tableIncluded" | "narrativeIncluded" | "diagramIncluded") => void;
}
```

Update the component signature to destructure it:

```typescript
export default function SectionEditor({
  section,
  index,
  totalSections,
  onToggle,
  onMove,
  onContentChange,
  onNarrativeStateChange,
  onGenerateNarrative,
  isGenerating,
  onToggleElement,
}: SectionEditorProps) {
```

- [ ] **Step 2: Add element toggle buttons in the header**

Add these toggle buttons in the header bar, after the existing AI/Structured toggle and before the Include/Exclude toggle. Find the `{/* Include/Exclude toggle */}` comment and add this block before it:

```tsx
{/* Element toggles (table / narrative / diagram) */}
{onToggleElement && section.type === "results" && (
  <div className="flex items-center gap-0.5 border border-[#232328] rounded-lg overflow-hidden">
    {section.tableData && (
      <button
        type="button"
        onClick={() => onToggleElement(section.id, "tableIncluded")}
        className={`p-1.5 transition-colors ${
          section.tableIncluded !== false
            ? "bg-[#2DD4BF]/20 text-[#2DD4BF]"
            : "text-[#5A5650] hover:text-[#F0EDE8]"
        }`}
        title={section.tableIncluded !== false ? "Hide table" : "Show table"}
      >
        <Table className="w-3.5 h-3.5" />
      </button>
    )}
    <button
      type="button"
      onClick={() => onToggleElement(section.id, "narrativeIncluded")}
      className={`p-1.5 transition-colors ${
        section.narrativeIncluded !== false
          ? "bg-[#2DD4BF]/20 text-[#2DD4BF]"
          : "text-[#5A5650] hover:text-[#F0EDE8]"
      }`}
      title={section.narrativeIncluded !== false ? "Hide narrative" : "Show narrative"}
    >
      <BrainCircuit className="w-3.5 h-3.5" />
    </button>
    {section.diagramType && (
      <button
        type="button"
        onClick={() => onToggleElement(section.id, "diagramIncluded")}
        className={`p-1.5 transition-colors ${
          section.diagramIncluded !== false
            ? "bg-[#2DD4BF]/20 text-[#2DD4BF]"
            : "text-[#5A5650] hover:text-[#F0EDE8]"
        }`}
        title={section.diagramIncluded !== false ? "Hide diagram" : "Show diagram"}
      >
        <BarChart3 className="w-3.5 h-3.5" />
      </button>
    )}
  </div>
)}
```

Also add the `BarChart3` import at the top:

```typescript
import {
  GripVertical,
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  BrainCircuit,
  Table,
  BarChart3,
} from "lucide-react";
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/publish/components/SectionEditor.tsx
git commit -m "feat(publish): add table/narrative/diagram element toggles to SectionEditor"
```

---

### Task 7: Update `DocumentConfigurator` — wire element toggle handlers

**Files:**
- Modify: `frontend/src/features/publish/components/DocumentConfigurator.tsx`

- [ ] **Step 1: Add `onToggleElement` handler and pass to `SectionEditor`**

Add a new callback in `DocumentConfigurator`, after the existing `handleNarrativeStateChange`:

```typescript
const handleToggleElement = useCallback(
  (id: string, element: "tableIncluded" | "narrativeIncluded" | "diagramIncluded") => {
    onSectionsChange(
      sections.map((s) =>
        s.id === id ? { ...s, [element]: !(s[element] !== false) } : s
      )
    );
  },
  [sections, onSectionsChange]
);
```

Then pass it to `SectionEditor` in the JSX. Update the `<SectionEditor>` element:

```tsx
<SectionEditor
  key={section.id}
  section={section}
  index={idx}
  totalSections={sections.length}
  onToggle={handleToggle}
  onMove={handleMove}
  onContentChange={handleContentChange}
  onNarrativeStateChange={handleNarrativeStateChange}
  onGenerateNarrative={handleGenerateNarrative}
  isGenerating={false}
  onToggleElement={handleToggleElement}
/>
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/publish/components/DocumentConfigurator.tsx
git commit -m "feat(publish): wire element toggle handlers from DocumentConfigurator to SectionEditor"
```

---

### Task 8: Update `DocumentPreview` — render tables + auto-number

**Files:**
- Modify: `frontend/src/features/publish/components/DocumentPreview.tsx`

- [ ] **Step 1: Import `ResultsTable` and add table numbering**

Add import at the top of the file:

```typescript
import ResultsTable from "./ResultsTable";
```

- [ ] **Step 2: Update section rendering to include tables**

In the `DocumentPreview` component, the existing code tracks `figureCounter`. Add a `tableCounter` alongside it. Replace the `let figureCounter = 0;` line with:

```typescript
let figureCounter = 0;
let tableCounter = 0;
```

Then update the section rendering in the `includedSections.map()` callback. Replace the existing callback with:

```tsx
{includedSections.map((section) => {
  if (section.type === "diagram" && section.diagramType) {
    figureCounter += 1;
    const figNum = figureCounter;

    return (
      <div key={section.id} className="mb-8">
        <DiagramWrapper
          title={section.title}
          caption={section.caption}
          figureNumber={figNum}
        >
          {renderDiagram(section.diagramType, section.diagramData)}
        </DiagramWrapper>
      </div>
    );
  }

  // Results sections with table + narrative + diagram
  if (section.type === "results") {
    const hasTable = section.tableData && section.tableIncluded !== false;
    const hasNarrative = section.narrativeIncluded !== false && section.content;
    const hasDiagram = section.diagramIncluded !== false && section.diagramType;

    if (hasTable) tableCounter += 1;
    if (hasDiagram) figureCounter += 1;

    const currentTableNum = hasTable ? tableCounter : 0;
    const currentFigNum = hasDiagram ? figureCounter : 0;

    return (
      <div key={section.id} className="mb-8">
        <h2
          className="mb-3 font-bold text-gray-900"
          style={{ fontSize: "14pt" }}
        >
          {section.title}
        </h2>

        {/* Table */}
        {hasTable && section.tableData && (
          <ResultsTable data={section.tableData} tableNumber={currentTableNum} />
        )}

        {/* Narrative */}
        {hasNarrative && (
          <div
            className="text-sm leading-relaxed text-gray-800"
            style={{ fontSize: "11pt", lineHeight: 1.7 }}
          >
            {(typeof section.content === "string"
              ? section.content
              : JSON.stringify(section.content)
            )
              .split("\n")
              .map((paragraph: string, i: number) => (
                <p key={i} className={i > 0 ? "mt-3" : ""}>
                  {paragraph}
                </p>
              ))}
          </div>
        )}

        {/* Diagram */}
        {hasDiagram && section.diagramType && (
          <div className="mt-4">
            <DiagramWrapper
              title={section.title}
              caption={section.caption}
              figureNumber={currentFigNum}
            >
              {renderDiagram(section.diagramType, section.diagramData)}
            </DiagramWrapper>
          </div>
        )}

        {/* Empty state */}
        {!hasTable && !hasNarrative && !hasDiagram && (
          <p className="text-sm italic text-gray-400">
            No content available for this section.
          </p>
        )}
      </div>
    );
  }

  // Text sections: methods, discussion, introduction
  return (
    <div key={section.id} className="mb-8">
      <h2
        className="mb-3 font-bold text-gray-900"
        style={{ fontSize: "14pt" }}
      >
        {section.title}
      </h2>
      {section.content ? (
        <div
          className="text-sm leading-relaxed text-gray-800"
          style={{ fontSize: "11pt", lineHeight: 1.7 }}
        >
          {(typeof section.content === "string"
            ? section.content
            : JSON.stringify(section.content)
          )
            .split("\n")
            .map((paragraph: string, i: number) => (
              <p key={i} className={i > 0 ? "mt-3" : ""}>
                {paragraph}
              </p>
            ))}
        </div>
      ) : (
        <p className="text-sm italic text-gray-400">
          No content available for this section.
        </p>
      )}
    </div>
  );
})}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 4: Verify production build**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vite build`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/publish/components/DocumentPreview.tsx
git commit -m "feat(publish): render ResultsTable and auto-number tables/figures in preview"
```

---

### Task 9: Add "Generate Manuscript" button to Study detail page

**Files:**
- Modify: `frontend/src/features/studies/pages/StudyDetailPage.tsx`

- [ ] **Step 1: Add FileOutput import and navigate hook**

Add `FileOutput` to the existing lucide-react import list in `StudyDetailPage.tsx`:

```typescript
// Add FileOutput to the existing import
import {
  ArrowLeft,
  Loader2,
  Trash2,
  Play,
  Settings,
  BarChart3,
  MapPin,
  Users,
  Target,
  Milestone,
  FileText,
  Activity,
  ChevronRight,
  Calendar,
  User,
  ExternalLink,
  Edit3,
  Save,
  X,
  Layers,
  Copy,
  Download,
  Archive,
  FileOutput,
} from "lucide-react";
```

- [ ] **Step 2: Add the "Generate Manuscript" button in the action buttons area**

Find the action buttons div (around line 329: `{/* Action buttons */}`). Add the new button before the Duplicate button:

```tsx
{/* Generate Manuscript — only show if study has completed analyses */}
{(analyses ?? []).some(
  (sa) => sa.analysis?.latest_execution?.status === "completed"
) && (
  <button
    type="button"
    onClick={() => navigate(`/publish?studyId=${study.id}`)}
    className="btn btn-ghost btn-sm flex items-center gap-1"
    title="Generate manuscript from completed analyses"
  >
    <FileOutput size={14} />
    <span className="text-xs">Manuscript</span>
  </button>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/studies/pages/StudyDetailPage.tsx
git commit -m "feat(studies): add Generate Manuscript button linking to publish page with studyId"
```

---

### Task 10: Final integration build + deploy

**Files:**
- All modified files

- [ ] **Step 1: Full TypeScript check**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 2: Production build**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vite build`
Expected: Build succeeds with no errors

- [ ] **Step 3: Run Pint (in case any PHP was touched)**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"`
Expected: No changes (frontend-only work)

- [ ] **Step 4: Deploy frontend**

Run: `cd /home/smudoshi/Github/Parthenon && ./deploy.sh --frontend`
Expected: Frontend build deployed to production
