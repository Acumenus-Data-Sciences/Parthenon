# Patient Similarity UX Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the Patient Similarity feature into full alignment with Parthenon's design system — eliminating the permanent left sidebar layout, consolidating two competing pages into one, adopting standard page headers/tabs/buttons/panels, and collapsing developer diagnostics behind an accordion.

**Architecture:** The current `/patient-similarity` route loads `PatientSimilarityWorkspace` (pipeline-centric). The original `PatientSimilarityPage` (search-centric) is unreachable dead code. We consolidate into one page that uses the standard `space-y-6` vertical layout with a horizontal toolbar, standard tabs, and the existing pipeline system. The `PatientComparisonPage` (/patient-similarity/compare) remains as a detail sub-route with breadcrumb added.

**Tech Stack:** React 19, TypeScript strict, Tailwind 4, lucide-react icons, TanStack Query, Zustand

**Design System Reference:** `frontend/src/styles/components/` defines `.panel`, `.panel-inset`, `.metric-card`, `.data-table`, `.page-title`, `.page-subtitle`, `.badge-*`, `.empty-state`, `.form-input`, `.form-select`, `.btn`, `.btn-primary`, `.btn-secondary`. All card borders use `var(--border-default)` (`#2A2A30`). Focus states use gold (`var(--border-focus)` / `var(--accent-pale)`). Tabs use teal underline indicator.

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| **Rewrite** | `frontend/src/features/patient-similarity/pages/PatientSimilarityWorkspace.tsx` | Single consolidated page with standard layout |
| **Delete** | `frontend/src/features/patient-similarity/pages/PatientSimilarityPage.tsx` | Dead code — all functionality folded into Workspace |
| **Modify** | `frontend/src/features/patient-similarity/pages/PatientComparisonPage.tsx` | Add standard breadcrumb, fix header pattern |
| **Rewrite** | `frontend/src/features/patient-similarity/components/CohortSelectorBar.tsx` | Standard horizontal toolbar with design system inputs |
| **Rewrite** | `frontend/src/features/patient-similarity/components/PipelineStep.tsx` | Use `.panel` classes, design system colors |
| **Modify** | `frontend/src/features/patient-similarity/components/AnalysisPipeline.tsx` | Wrap in `.panel` container |
| **Modify** | `frontend/src/features/patient-similarity/components/SimilarPatientTable.tsx` | Adopt `.data-table` patterns, sticky header |
| **Modify** | `frontend/src/features/patient-similarity/components/SearchDiagnosticsPanel.tsx` | Wrap in collapsible accordion, use `.panel` cards |
| **Modify** | `frontend/src/features/patient-similarity/components/SimilaritySearchForm.tsx` | Gold focus states, `.form-input`/`.form-select` classes |
| **Modify** | `frontend/src/features/patient-similarity/components/SimilarityModeToggle.tsx` | Standard badge-style toggle |
| **Modify** | `frontend/src/features/patient-similarity/components/CohortSeedForm.tsx` | Gold focus states, standard form inputs |
| **Modify** | `frontend/src/features/patient-similarity/components/CohortCompareForm.tsx` | Gold focus states, standard form inputs |
| **Modify** | `frontend/src/features/patient-similarity/components/DimensionScoreBar.tsx` | No change needed (already minimal) |
| **No change** | `frontend/src/features/patient-similarity/hooks/*` | Hooks are clean, no UI drift |
| **No change** | `frontend/src/features/patient-similarity/types/*` | Types are clean |
| **No change** | `frontend/src/features/patient-similarity/api/*` | API layer is clean |
| **No change** | `frontend/src/app/router.tsx` | Routes stay the same (Workspace is already the route target) |

---

## Task 1: Delete Dead `PatientSimilarityPage` and Clean Up Imports

**Files:**
- Delete: `frontend/src/features/patient-similarity/pages/PatientSimilarityPage.tsx`

This file is 718 lines of unreachable code. The router at `frontend/src/app/router.tsx:422-427` maps `/patient-similarity` to `PatientSimilarityWorkspace`, not this file.

- [ ] **Step 1: Verify the file is truly unreachable**

Run:
```bash
cd frontend && grep -rn "PatientSimilarityPage" src/ --include="*.tsx" --include="*.ts"
```
Expected: Only the file itself and possibly some dead imports. The router should NOT reference it.

- [ ] **Step 2: Delete the file**

```bash
rm frontend/src/features/patient-similarity/pages/PatientSimilarityPage.tsx
```

- [ ] **Step 3: Verify no import errors**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```
Expected: No new errors related to PatientSimilarityPage.

- [ ] **Step 4: Commit**

```bash
git add -A frontend/src/features/patient-similarity/pages/PatientSimilarityPage.tsx
git commit -m "chore: remove dead PatientSimilarityPage (unreachable, replaced by Workspace)"
```

---

## Task 2: Rewrite `PipelineStep` to Use Design System

**Files:**
- Modify: `frontend/src/features/patient-similarity/components/PipelineStep.tsx`

The current PipelineStep uses raw hex colors (`#333`, `#444`, `#555`, `#777`, `#888`, `#ddd`) that are completely outside the design system palette. It also uses unicode triangles (`▸`, `▾`) instead of lucide-react chevrons.

- [ ] **Step 1: Rewrite PipelineStep with design system tokens**

Replace the entire file content with:

```tsx
import { type ReactNode } from 'react';
import { ChevronDown, ChevronRight, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { StepStatus } from '../types/pipeline';

interface PipelineStepProps {
  stepNumber: number;
  name: string;
  description: string;
  status: StepStatus;
  isExpanded?: boolean;
  summary?: string;
  executionTimeMs?: number;
  onToggle: () => void;
  onRun?: () => void;
  children: ReactNode;
}

export function PipelineStep({
  stepNumber,
  name,
  description,
  status,
  isExpanded = false,
  summary,
  executionTimeMs,
  onToggle,
  onRun,
  children,
}: PipelineStepProps) {
  if (status === 'future') {
    return (
      <div className="panel mb-3 opacity-50" style={{ borderStyle: 'dashed' }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-6 w-6 items-center justify-center rounded-full border border-[#2A2A30]">
              <span className="text-[10px] text-[#5A5650] tabular-nums">{stepNumber}</span>
            </div>
            <span className="text-sm text-[#8A857D]">{name}</span>
            <span className="text-xs text-[#5A5650]">{description}</span>
          </div>
          {onRun && (
            <button
              onClick={onRun}
              className="btn btn-secondary btn-sm"
              type="button"
            >
              Run
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="panel mb-3">
        <div className="flex items-center gap-2.5">
          <Loader2 size={20} className="animate-spin text-[#2DD4BF]" />
          <span className="text-sm font-medium text-[#F0EDE8]">{name}</span>
          <span className="text-xs text-[#8A857D]">Running...</span>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="panel mb-3" style={{ borderColor: 'var(--critical)' }}>
        <div className="flex items-center gap-2.5">
          <XCircle size={20} className="text-[#E85A6B]" />
          <span className="text-sm font-medium text-[#F0EDE8]">{name}</span>
          <span className="text-xs text-[#E85A6B]">Failed</span>
        </div>
      </div>
    );
  }

  // status === 'completed'
  return (
    <div className={cn('panel mb-3 overflow-hidden', isExpanded && 'border-[#9B1B30]')}>
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
        type="button"
      >
        <div className="flex items-center gap-2.5">
          <CheckCircle2 size={20} className="text-[#2DD4BF]" />
          <span className="text-sm font-medium text-[#F0EDE8]">{name}</span>
          {!isExpanded && summary && (
            <span className="ml-1 text-xs text-[#8A857D]">{summary}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {executionTimeMs !== undefined && (
            <span className="text-xs text-[#5A5650] tabular-nums">
              {(executionTimeMs / 1000).toFixed(1)}s
            </span>
          )}
          {isExpanded ? (
            <ChevronDown size={16} className="text-[#5A5650]" />
          ) : (
            <ChevronRight size={16} className="text-[#5A5650]" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="mt-4 border-t border-[#2A2A30] pt-4">{children}</div>
      )}
    </div>
  );
}
```

Key changes:
- All hex colors now use design system palette (`#2A2A30`, `#5A5650`, `#8A857D`, `#F0EDE8`, etc.)
- Uses `.panel` CSS class for container (gets gradient overlay, shimmer edge, gold hover)
- Uses `.btn .btn-secondary .btn-sm` for Run button
- Uses lucide-react `ChevronDown`/`ChevronRight` instead of unicode triangles
- Uses lucide-react `CheckCircle2`, `XCircle`, `Loader2` for status icons
- Step number uses `tabular-nums` and proper sizing
- `mb-3` spacing matches design system `--space-3` (12px)

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i pipeline
```
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/patient-similarity/components/PipelineStep.tsx
git commit -m "style: align PipelineStep with design system (panel, icons, colors)"
```

---

## Task 3: Wrap `AnalysisPipeline` in Panel Container

**Files:**
- Modify: `frontend/src/features/patient-similarity/components/AnalysisPipeline.tsx`

Currently the pipeline container uses raw padding (`px-5 py-4`). Wrap it in the standard content spacing.

- [ ] **Step 1: Update the container class**

In `AnalysisPipeline.tsx`, change:
```tsx
<div className="px-5 py-4">
```
to:
```tsx
<div className="space-y-0">
```

The PipelineStep components already have `mb-3` spacing from Task 2, so we don't need `space-y` here — just remove the arbitrary padding since the parent page will provide proper spacing.

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i pipeline
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/patient-similarity/components/AnalysisPipeline.tsx
git commit -m "style: remove arbitrary padding from AnalysisPipeline container"
```

---

## Task 4: Rewrite `CohortSelectorBar` with Design System

**Files:**
- Modify: `frontend/src/features/patient-similarity/components/CohortSelectorBar.tsx`

The current toolbar uses off-palette colors (`#1A1815`, `#2A2520`) and non-standard input styling. Align with design system form inputs and buttons.

- [ ] **Step 1: Rewrite CohortSelectorBar**

Replace the entire file content with:

```tsx
import { Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useCohortDefinitions } from '@/features/cohort-definitions/hooks/useCohortDefinitions';
import { useSources } from '@/features/data-sources/hooks/useSources';
import { useCohortProfile } from '../hooks/usePatientSimilarity';
import { GenerationStatusBanner } from './GenerationStatusBanner';
import type { PipelineMode } from '../types/pipeline';

export interface CohortSelectorBarProps {
  mode: PipelineMode;
  sourceId: number | null;
  targetCohortId: number | null;
  comparatorCohortId: number | null;
  onModeChange: (mode: PipelineMode) => void;
  onSourceChange: (sourceId: number) => void;
  onTargetChange: (cohortId: number | null) => void;
  onComparatorChange: (cohortId: number | null) => void;
  onCompare: () => void;
  onOpenSettings: () => void;
  isRunning?: boolean;
}

export function CohortSelectorBar({
  mode,
  sourceId,
  targetCohortId,
  comparatorCohortId,
  onModeChange,
  onSourceChange,
  onTargetChange,
  onComparatorChange,
  onCompare,
  onOpenSettings,
  isRunning = false,
}: CohortSelectorBarProps) {
  const { data: sourcesData } = useSources();
  const sources = sourcesData ?? [];

  const { data: cohortsData } = useCohortDefinitions({ limit: 500 });
  const cohorts = cohortsData?.items ?? [];

  const { data: targetProfile, isLoading: targetProfileLoading } =
    useCohortProfile(
      targetCohortId != null && targetCohortId > 0 ? targetCohortId : undefined,
      sourceId ?? 0,
    );

  const { data: comparatorProfile, isLoading: comparatorProfileLoading } =
    useCohortProfile(
      comparatorCohortId != null && comparatorCohortId > 0 ? comparatorCohortId : undefined,
      sourceId ?? 0,
    );

  const isCompareMode = mode === 'compare';
  const actionDisabled =
    isRunning ||
    sourceId == null ||
    targetCohortId == null ||
    (isCompareMode && comparatorCohortId == null);

  const handleTargetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onTargetChange(val ? Number(val) : null);
  };

  const handleComparatorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    onComparatorChange(val ? Number(val) : null);
  };

  const handleSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val) onSourceChange(Number(val));
  };

  const showTargetBanner =
    sourceId != null && targetCohortId != null && targetCohortId > 0;
  const showComparatorBanner =
    isCompareMode &&
    sourceId != null &&
    comparatorCohortId != null &&
    comparatorCohortId > 0;

  return (
    <div className="panel space-y-3">
      {/* Row 1 - controls */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Data source */}
        <select
          value={sourceId ?? ''}
          onChange={handleSourceChange}
          className="form-select min-w-[140px]"
          aria-label="Data source"
        >
          <option value="">Source...</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.source_name}
            </option>
          ))}
        </select>

        {/* Mode toggle */}
        <div className="flex rounded-md overflow-hidden border border-[#2A2A30]">
          <button
            type="button"
            onClick={() => onModeChange('compare')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors',
              isCompareMode
                ? 'bg-[#9B1B30] text-white'
                : 'bg-[#151518] text-[#8A857D] hover:text-[#C5C0B8]',
            )}
          >
            Compare Cohorts
          </button>
          <button
            type="button"
            onClick={() => onModeChange('expand')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium transition-colors',
              !isCompareMode
                ? 'bg-[#2DD4BF] text-[#0E0E11]'
                : 'bg-[#151518] text-[#8A857D] hover:text-[#C5C0B8]',
            )}
          >
            Expand Cohort
          </button>
        </div>

        {/* Target cohort */}
        <div className="flex-1 min-w-[160px]">
          <select
            value={targetCohortId ?? ''}
            onChange={handleTargetChange}
            className="form-select w-full"
            style={{ borderColor: 'var(--primary)' }}
            aria-label="Target cohort"
          >
            <option value="">
              {isCompareMode ? 'Target cohort...' : 'Seed cohort...'}
            </option>
            {cohorts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Comparator cohort - compare mode only */}
        {isCompareMode && (
          <div className="flex-1 min-w-[160px]">
            <select
              value={comparatorCohortId ?? ''}
              onChange={handleComparatorChange}
              className="form-select w-full"
              style={{ borderColor: 'var(--success)' }}
              aria-label="Comparator cohort"
            >
              <option value="">Comparator cohort...</option>
              {cohorts.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Action button */}
        <button
          type="button"
          onClick={onCompare}
          disabled={actionDisabled}
          className={cn(
            'btn shrink-0',
            isCompareMode ? 'btn-primary' : 'btn bg-[#2DD4BF] text-[#0E0E11] hover:bg-[#26B8A5]',
            'disabled:opacity-40 disabled:cursor-not-allowed',
          )}
        >
          {isCompareMode ? 'Compare' : 'Find Similar'}
        </button>

        {/* Settings */}
        <button
          type="button"
          onClick={onOpenSettings}
          title="Analysis settings"
          className="btn-icon text-[#8A857D] hover:text-[#C5C0B8] hover:bg-[#1C1C20] transition-colors"
        >
          <Settings size={16} />
        </button>
      </div>

      {/* Row 2 - generation status */}
      {(showTargetBanner || showComparatorBanner) && (
        <div className="flex gap-6 flex-wrap">
          {showTargetBanner && (
            <div className="flex-1 min-w-[200px]">
              <span className="text-xs font-medium text-[#9B1B30] mr-2">
                {isCompareMode ? 'Target:' : 'Seed:'}
              </span>
              <GenerationStatusBanner
                cohortDefinitionId={targetCohortId!}
                sourceId={sourceId!}
                profile={targetProfile}
                isLoading={targetProfileLoading}
              />
            </div>
          )}
          {showComparatorBanner && (
            <div className="flex-1 min-w-[200px]">
              <span className="text-xs font-medium text-[#2DD4BF] mr-2">
                Comparator:
              </span>
              <GenerationStatusBanner
                cohortDefinitionId={comparatorCohortId!}
                sourceId={sourceId!}
                profile={comparatorProfile}
                isLoading={comparatorProfileLoading}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

Key changes:
- Container uses `.panel` instead of raw bg/border
- Dropdowns use `.form-select` class (gets gold focus ring, proper sizing)
- Action button uses `.btn .btn-primary` classes
- Settings button uses `.btn-icon`
- All background colors switched from `#1A1815` to `#151518` (design system `--surface-raised`)
- All borders switched from `#2A2520` to `#2A2A30` (design system `--border-default`)

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i selector
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/patient-similarity/components/CohortSelectorBar.tsx
git commit -m "style: align CohortSelectorBar with design system (panel, form-select, btn)"
```

---

## Task 5: Rewrite `PatientSimilarityWorkspace` with Standard Page Layout

**Files:**
- Modify: `frontend/src/features/patient-similarity/pages/PatientSimilarityWorkspace.tsx`

The current page bypasses the content shell with `flex h-full flex-col overflow-hidden bg-[#0E0E11]`. Replace with the standard `space-y-6` vertical layout using `page-title`/`page-subtitle` header.

- [ ] **Step 1: Rewrite the page layout**

Replace the render section (from `return (` to the end of the component) with:

```tsx
  // ── Render ────────────────────────────────────────────────────────

  const steps = (pipeline as unknown as { steps: import('../types/pipeline').StepDefinition[] }).steps;

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="page-title">Patient Similarity</h1>
          <p className="page-subtitle">
            Compare cohort profiles, find similar patients, and run propensity score matching across OMOP CDM sources
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SimilarityModeToggle
            mode={similarityMode}
            onChange={setSimilarityMode}
          />
        </div>
      </div>

      {/* Toolbar */}
      <CohortSelectorBar
        mode={pipeline.mode}
        sourceId={sourceId}
        targetCohortId={targetCohortId}
        comparatorCohortId={comparatorCohortId}
        onModeChange={handleModeChange}
        onSourceChange={handleSourceChange}
        onTargetChange={handleTargetChange}
        onComparatorChange={handleComparatorChange}
        onCompare={handleCompare}
        onOpenSettings={() => setSettingsOpen(!settingsOpen)}
        isRunning={compareMutation.isPending || cohortSimilarityMutation.isPending}
      />

      {/* Analysis pipeline */}
      <AnalysisPipeline
        steps={steps}
        expandedSteps={pipeline.expandedSteps}
        getStepStatus={pipeline.getStepStatus}
        getStepResult={pipeline.getStepResult}
        onToggleStep={pipeline.toggleStep}
        onRunStep={handleRunStep}
        renderStepContent={renderStepContent}
      />

      {/* Drawers */}
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        weights={weights}
        onWeightsChange={setWeights}
        ageMin={ageMin}
        ageMax={ageMax}
        onAgeMinChange={setAgeMin}
        onAgeMaxChange={setAgeMax}
        gender={gender}
        onGenderChange={setGender}
        onApply={handleCompare}
      />

      <HeadToHeadDrawer
        open={h2hOpen}
        onClose={() => setH2hOpen(false)}
        personAId={h2hPersonA}
        personBId={h2hPersonB}
        sourceId={sourceId ?? 0}
      />
    </div>
  );
```

Also add the `SimilarityModeToggle` import and state at the top of the component:

```tsx
import { SimilarityModeToggle } from '../components/SimilarityModeToggle';
```

And add state:
```tsx
const [similarityMode, setSimilarityMode] = useState<'auto' | 'interpretable' | 'embedding'>('auto');
```

- [ ] **Step 2: Remove the `flex h-full` wrapper and overflow-hidden**

The old layout:
```tsx
<div className="flex h-full flex-col overflow-hidden bg-[#0E0E11]">
```
is now replaced by:
```tsx
<div className="space-y-6">
```

This lets the standard `.content-main` wrapper (90% width, max 1600px, proper padding) do its job.

- [ ] **Step 3: Remove the inner `<div className="flex-1 overflow-y-auto">` wrapper**

The AnalysisPipeline no longer needs a scrollable container wrapper — the page itself scrolls naturally within `.content-main`.

- [ ] **Step 4: Verify TypeScript compiles**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/patient-similarity/pages/PatientSimilarityWorkspace.tsx
git commit -m "style: adopt standard page layout for Patient Similarity (page-title, space-y-6)"
```

---

## Task 6: Align `SimilarPatientTable` with `.data-table` Patterns

**Files:**
- Modify: `frontend/src/features/patient-similarity/components/SimilarPatientTable.tsx`

The table header uses `bg-[#151518]` (should be `bg-[#1C1C20]` per `.data-table th`), lacks sticky positioning, and the header text uses `text-[10px]` (should be `text-[11px]` per `var(--text-xs)`).

- [ ] **Step 1: Update the thead row**

In `SimilarPatientTable.tsx`, change:
```tsx
<tr className="bg-[#151518] border-b border-[#232328]">
```
to:
```tsx
<tr className="bg-[#1C1C20] border-b border-[#2A2A30]">
```

- [ ] **Step 2: Add sticky header to thead**

Change:
```tsx
<thead>
```
to:
```tsx
<thead className="sticky top-0 z-20">
```

- [ ] **Step 3: Update header cell styling from text-[10px] to text-[11px]**

Find all `th` class strings and change `text-[10px]` to `text-[11px]`. There are 11 `<th>` elements. Each one currently has:
```
text-[10px] font-semibold text-[#5A5650] uppercase tracking-wider
```
Change to:
```
text-[11px] font-semibold text-[#5A5650] uppercase tracking-[0.5px]
```

- [ ] **Step 4: Update border colors in tbody rows**

Change:
```tsx
"border-b border-[#1C1C20] transition-colors",
```
to:
```tsx
"border-b border-[#2A2A30]/50 transition-colors",
```

- [ ] **Step 5: Update expanded row background**

Change the expanded detail row:
```tsx
<tr className="border-b border-[#1C1C20] bg-[#131316]">
```
to:
```tsx
<tr className="border-b border-[#2A2A30]/50 bg-[#0E0E11]">
```

- [ ] **Step 6: Use `.panel-inset` for detail metric cards**

Change the 4-card grid items from:
```tsx
className="rounded-md border border-[#232328] bg-[#151518] px-3 py-2"
```
to:
```tsx
className="panel-inset rounded-md px-3 py-2"
```

- [ ] **Step 7: Update empty state**

Change:
```tsx
<div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
  <p className="text-sm text-[#8A857D]">No similar patients found.</p>
</div>
```
to:
```tsx
<div className="empty-state">
  <p className="empty-message">No similar patients found for the given criteria.</p>
</div>
```

- [ ] **Step 8: Verify TypeScript compiles**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i similar
```

- [ ] **Step 9: Commit**

```bash
git add frontend/src/features/patient-similarity/components/SimilarPatientTable.tsx
git commit -m "style: align SimilarPatientTable with data-table design system"
```

---

## Task 7: Collapse `SearchDiagnosticsPanel` Behind Accordion

**Files:**
- Modify: `frontend/src/features/patient-similarity/components/SearchDiagnosticsPanel.tsx`

The diagnostics panel shows developer-grade telemetry (candidate pool, query contract, provenance, source readiness) permanently visible. Wrap in a collapsible disclosure.

- [ ] **Step 1: Add collapsible wrapper**

Add `useState` and `ChevronDown`/`ChevronRight` imports:

```tsx
import { useState } from "react";
import { Activity, ChevronDown, ChevronRight, Database, Filter, GitBranch, Timer } from "lucide-react";
```

- [ ] **Step 2: Wrap the grid in a disclosure**

Replace the component's return JSX. The outer container becomes:

```tsx
export function SearchDiagnosticsPanel({
  metadata,
  seed,
  computeStatus,
}: SearchDiagnosticsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const filters = metadata.filters_applied as SimilarityFilters | undefined;

  return (
    <div className="panel">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[11px] font-semibold text-[#5A5650] uppercase tracking-[0.5px]">
          Search Diagnostics
        </span>
        {isOpen ? (
          <ChevronDown size={14} className="text-[#5A5650]" />
        ) : (
          <ChevronRight size={14} className="text-[#5A5650]" />
        )}
      </button>

      {isOpen && (
        <div className="mt-4 grid grid-cols-1 xl:grid-cols-4 gap-3">
          <div className="panel-inset rounded-lg p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.5px] text-[#5A5650]">
              <Database size={12} className="text-[#2DD4BF]" />
              Candidate Pool
            </div>
            <div className="mt-2 space-y-1.5 text-xs text-[#C5C0B8]">
              <div>Total candidates: {metadata.total_candidates ?? metadata.candidates_evaluated ?? "\u2014"}</div>
              <div>Loaded: {metadata.candidates_loaded ?? metadata.candidates_evaluated ?? "\u2014"}</div>
              <div>Returned: {metadata.returned_count ?? "\u2014"}</div>
              <div className="text-[#8A857D]">
                {metadata.sql_prescored ? "SQL pre-screened before full scoring" : "Full scoring over candidate set"}
              </div>
            </div>
          </div>

          <div className="panel-inset rounded-lg p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.5px] text-[#5A5650]">
              <Filter size={12} className="text-[#C9A227]" />
              Query Contract
            </div>
            <div className="mt-2 space-y-1.5 text-xs text-[#C5C0B8]">
              <div>Filters: {formatFilters(filters)}</div>
              <div>Min score: {metadata.min_score ?? "\u2014"}</div>
              <div>Limit: {metadata.limit ?? "\u2014"}</div>
              <div>Temporal window: {metadata.temporal_window_days ? `${metadata.temporal_window_days} days` : "\u2014"}</div>
            </div>
          </div>

          <div className="panel-inset rounded-lg p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.5px] text-[#5A5650]">
              <GitBranch size={12} className="text-[#9B1B30]" />
              Provenance
            </div>
            <div className="mt-2 space-y-1.5 text-xs text-[#C5C0B8]">
              <div>Vector version: {seed.feature_vector_version ?? metadata.feature_vector_version ?? "\u2014"}</div>
              <div>Seed anchor: {formatDate(seed.anchor_date ?? metadata.seed_anchor_date)}</div>
              <div>Computed: {formatDate(metadata.computed_at)}</div>
              <div className="text-[#8A857D]">Query hash: {typeof metadata.query_hash === "string" ? metadata.query_hash.slice(0, 12) : "\u2014"}</div>
            </div>
          </div>

          <div className="panel-inset rounded-lg p-3">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.5px] text-[#5A5650]">
              <Timer size={12} className="text-[#2DD4BF]" />
              Source Readiness
            </div>
            <div className="mt-2 space-y-1.5 text-xs text-[#C5C0B8]">
              <div>Latest vectors: {formatDate(computeStatus?.latest_computed_at)}</div>
              <div>Embeddings ready: {computeStatus ? (computeStatus.embeddings_ready ? "Yes" : "No") : "\u2014"}</div>
              <div>Recommended mode: {computeStatus?.recommended_mode ?? "\u2014"}</div>
              <div className={computeStatus?.staleness_warning ? "text-[#E85A6B]" : "text-[#8A857D]"}>
                {computeStatus?.staleness_warning ? "Vectors may be stale" : "No staleness warning"}
              </div>
            </div>
          </div>

          {metadata.weights && (
            <div className="xl:col-span-4 panel-inset rounded-lg p-3">
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.5px] text-[#5A5650]">
                <Activity size={12} className="text-[#2DD4BF]" />
                Dimension Weights
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.entries(metadata.weights).map(([key, value]) => (
                  <span
                    key={key}
                    className="badge badge-default"
                  >
                    {key}: {value.toFixed(1)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

Key changes:
- Collapsed by default (`useState(false)`)
- Outer container uses `.panel`
- Inner cards use `.panel-inset`
- Header text uses `text-[11px]` with `tracking-[0.5px]`
- Weight badges use `.badge .badge-default`
- Chevron icons from lucide-react

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i diagnostic
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/patient-similarity/components/SearchDiagnosticsPanel.tsx
git commit -m "style: collapse SearchDiagnosticsPanel behind accordion, use panel/panel-inset"
```

---

## Task 8: Fix Focus States Across All Form Components (Teal -> Gold)

**Files:**
- Modify: `frontend/src/features/patient-similarity/components/SimilaritySearchForm.tsx`
- Modify: `frontend/src/features/patient-similarity/components/CohortSeedForm.tsx`
- Modify: `frontend/src/features/patient-similarity/components/CohortCompareForm.tsx`

The design system uses gold focus rings (`var(--border-focus)` / `var(--accent-pale)`). These forms all use teal focus: `focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40`.

- [ ] **Step 1: Fix SimilaritySearchForm focus states**

In `SimilaritySearchForm.tsx`, find-and-replace all occurrences:
```
focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40
```
with:
```
focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/15
```

There are 5 occurrences in this file:
1. Source selector (line ~117)
2. Person ID input (line ~164)
3. Age min input (line ~310)
4. Age max input (line ~323)
5. Gender select (line ~337)

- [ ] **Step 2: Fix CohortSeedForm focus states**

In `CohortSeedForm.tsx`, do the same find-and-replace:
```
focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40
```
with:
```
focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/15
```

- [ ] **Step 3: Fix CohortCompareForm focus states**

In `CohortCompareForm.tsx`, do the same find-and-replace.

- [ ] **Step 4: Verify TypeScript compiles**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | head -10
```

- [ ] **Step 5: Verify no remaining teal focus in the feature**

Run:
```bash
grep -rn "focus:border-\[#2DD4BF\]" frontend/src/features/patient-similarity/
```
Expected: No matches.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/patient-similarity/components/SimilaritySearchForm.tsx \
       frontend/src/features/patient-similarity/components/CohortSeedForm.tsx \
       frontend/src/features/patient-similarity/components/CohortCompareForm.tsx
git commit -m "style: switch Patient Similarity form focus states from teal to gold"
```

---

## Task 9: Add Breadcrumb to `PatientComparisonPage`

**Files:**
- Modify: `frontend/src/features/patient-similarity/pages/PatientComparisonPage.tsx`

The comparison sub-page uses a small inline "Back to results" link. Replace with the standard breadcrumb pattern used by all detail pages.

- [ ] **Step 1: Update the header section**

In `PatientComparisonPage.tsx`, find the header block (around line 520-534):

```tsx
<div className="flex items-center gap-4">
  <Link
    to={backUrl}
    className="flex items-center gap-1.5 text-xs text-[#5A5650] hover:text-[#C5C0B8] transition-colors"
  >
    <ArrowLeft size={14} />
    Back to results
  </Link>
  <h1 className="page-title">Patient Comparison</h1>
  <span className="text-xs text-[#5A5650] tabular-nums">
    #{personA} vs #{personB}
  </span>
</div>
```

Replace with:

```tsx
<div>
  <Link
    to={backUrl}
    className="inline-flex items-center gap-1 text-sm text-[#8A857D] hover:text-[#F0EDE8] transition-colors mb-3"
  >
    <ArrowLeft size={14} />
    Patient Similarity
  </Link>
  <div className="flex items-center gap-3">
    <h1 className="page-title">Patient Comparison</h1>
    <span className="text-sm text-[#8A857D] tabular-nums font-['IBM_Plex_Mono',monospace]">
      #{personA} vs #{personB}
    </span>
  </div>
  <p className="page-subtitle">
    Head-to-head similarity analysis across all clinical dimensions
  </p>
</div>
```

Key changes:
- Breadcrumb uses standard pattern: `text-sm text-[#8A857D] hover:text-[#F0EDE8] mb-3`
- Breadcrumb text says "Patient Similarity" (parent section name), not "Back to results"
- Title and patient IDs on separate line
- Added `.page-subtitle` description

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i comparison
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/patient-similarity/pages/PatientComparisonPage.tsx
git commit -m "style: add standard breadcrumb and page subtitle to PatientComparisonPage"
```

---

## Task 10: Align `SimilarityModeToggle` with Badge Pattern

**Files:**
- Modify: `frontend/src/features/patient-similarity/components/SimilarityModeToggle.tsx`

The toggle uses raw inline styles. Align with the design system's segmented control / filter chip pattern.

- [ ] **Step 1: Rewrite SimilarityModeToggle**

Replace the entire file:

```tsx
import { cn } from '@/lib/utils';

type SimilarityMode = 'auto' | 'interpretable' | 'embedding';

interface SimilarityModeToggleProps {
  mode: SimilarityMode;
  onChange: (mode: SimilarityMode) => void;
  recommendedMode?: string;
}

const modes: { value: SimilarityMode; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'interpretable', label: 'Interpretable' },
  { value: 'embedding', label: 'Embedding' },
];

export function SimilarityModeToggle({ mode, onChange, recommendedMode }: SimilarityModeToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center rounded-full border border-[#2A2A30] bg-[#151518] p-0.5">
        {modes.map((m) => (
          <button
            key={m.value}
            type="button"
            onClick={() => onChange(m.value)}
            className={cn(
              'px-3 py-1 text-xs font-medium rounded-full transition-colors',
              mode === m.value
                ? 'bg-[#C9A227]/15 text-[#C9A227] border border-[#C9A227]/30'
                : 'text-[#5A5650] hover:text-[#C5C0B8] border border-transparent',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      {mode === 'auto' && recommendedMode && (
        <span className="text-[11px] text-[#5A5650]">
          will use {recommendedMode}
        </span>
      )}
    </div>
  );
}
```

Key changes:
- Outer container uses pill shape (`rounded-full`) with design system border/bg
- Active state uses gold accent (matching filter chip `.active` pattern)
- Buttons are pill-shaped
- No more raw `border-r` dividers between buttons
- Hint text uses `text-[11px]` instead of `text-[10px]`

- [ ] **Step 2: Verify TypeScript compiles**

Run:
```bash
cd frontend && npx tsc --noEmit 2>&1 | grep -i mode
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/patient-similarity/components/SimilarityModeToggle.tsx
git commit -m "style: align SimilarityModeToggle with filter chip pattern (gold accent, pill shape)"
```

---

## Task 11: Run Full Build Verification

**Files:**
- None (verification only)

- [ ] **Step 1: Run TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```
Expected: Clean (0 errors).

- [ ] **Step 2: Run Vite build (stricter than tsc)**

```bash
cd frontend && npx vite build 2>&1 | tail -10
```
Expected: Build succeeds.

- [ ] **Step 3: Run ESLint on changed files**

```bash
cd frontend && npx eslint src/features/patient-similarity/ --max-warnings=0
```
Expected: Clean or only pre-existing warnings.

- [ ] **Step 4: Run Pint (in case any PHP was touched)**

```bash
docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint --test" 2>&1 | tail -5
```
Expected: Clean.

- [ ] **Step 5: Final commit if any formatting fixes needed**

If ESLint auto-fixes anything:
```bash
git add -A frontend/src/features/patient-similarity/
git commit -m "style: auto-fix lint issues in patient-similarity feature"
```
