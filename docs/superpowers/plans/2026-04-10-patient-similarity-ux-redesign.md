# Patient Similarity UX Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 5-tab Patient Similarity page with a cohort-centric research workspace using a persistent top bar and progressive pipeline of expandable analysis panels.

**Architecture:** Top-level `PatientSimilarityWorkspace` renders a `CohortSelectorBar` (sticky top) and an `AnalysisPipeline` (scrollable body). The pipeline renders `PipelineStep` wrappers around domain-specific panel components. Two slide-over drawers (`SettingsDrawer`, `HeadToHeadDrawer`) overlay from the right. Existing visualization components (radar, Love plot, landscape, etc.) are preserved and wrapped in new panel containers.

**Tech Stack:** React 19, TypeScript strict, TanStack Query, Zustand (sourceStore), Recharts, React Three Fiber, Tailwind 4.

**Design Spec:** `docs/superpowers/specs/2026-04-10-patient-similarity-ux-redesign.md`

---

## File Structure

### New Files

| File | Responsibility | Est. Lines |
|------|---------------|-----------|
| `features/patient-similarity/pages/PatientSimilarityWorkspace.tsx` | Top-level page: CohortSelectorBar + AnalysisPipeline + drawers | ~300 |
| `features/patient-similarity/components/CohortSelectorBar.tsx` | Persistent top bar: source, mode toggle, cohort dropdowns, action button, gear | ~200 |
| `features/patient-similarity/components/AnalysisPipeline.tsx` | Manages step ordering, state, renders PipelineStep instances | ~200 |
| `features/patient-similarity/components/PipelineStep.tsx` | Generic collapsible panel wrapper (future/loading/completed/expanded states) | ~120 |
| `features/patient-similarity/components/ProfileComparisonPanel.tsx` | Step 1: overall divergence + radar + dimension bars + demographics table | ~200 |
| `features/patient-similarity/components/CovariateBalancePanel.tsx` | Step 2: summary metrics + Love plot + distributional divergence table | ~200 |
| `features/patient-similarity/components/PsmPanel.tsx` | Step 3: PSM metrics + preference score + before/after Love plot + cross-search | ~200 |
| `features/patient-similarity/components/LandscapePanel.tsx` | Step 4: controls bar + PatientLandscape wrapper | ~120 |
| `features/patient-similarity/components/SettingsDrawer.tsx` | Right drawer: weights, filters, PSM config, UMAP params, similarity mode | ~250 |
| `features/patient-similarity/components/HeadToHeadDrawer.tsx` | Right drawer: patient cards, scores, shared features, trajectory | ~350 |
| `features/patient-similarity/components/CentroidProfilePanel.tsx` | Expand mode Step 1: centroid radar + dimension coverage | ~120 |
| `features/patient-similarity/components/SimilarPatientsPanel.tsx` | Expand mode Step 2: SimilarPatientTable wrapper + export/expand actions | ~150 |
| `features/patient-similarity/types/pipeline.ts` | Pipeline state types, step definitions, panel props interfaces | ~80 |
| `features/patient-similarity/hooks/usePipeline.ts` | Pipeline state management hook (steps, collapse/expand, completion tracking) | ~120 |
| `features/patient-similarity/pages/__tests__/PatientSimilarityWorkspace.test.tsx` | Tests for the new workspace page | ~200 |
| `features/patient-similarity/components/__tests__/PipelineStep.test.tsx` | Tests for collapsible step wrapper | ~100 |
| `features/patient-similarity/components/__tests__/CohortSelectorBar.test.tsx` | Tests for the top bar | ~120 |

### Modified Files

| File | Changes |
|------|---------|
| `app/router.tsx:414-420` | Update patient-similarity route to load PatientSimilarityWorkspace |
| `features/patient-similarity/hooks/usePatientSimilarity.ts` | Add pipeline-specific query key patterns |
| `features/patient-similarity/components/PatientLandscape.tsx` | No changes — wrapped by LandscapePanel |
| `features/patient-similarity/components/LovePlot.tsx` | No changes — used by CovariateBalancePanel and PsmPanel |
| `features/patient-similarity/components/SimilarPatientTable.tsx` | Add optional checkbox column + "Compare Selected" button for H2H trigger |
| `features/patient-similarity/components/GenerationStatusBanner.tsx` | Adapt for inline use in CohortSelectorBar (smaller, horizontal layout variant) |

### Preserved Unchanged

All visualization components (CohortComparisonRadar, DivergenceScores, PreferenceScoreDistribution, PropensityMatchResults, TrajectoryComparison, CohortCentroidRadar, NetworkFusionResults, LovePlot, DimensionScoreBar, CohortExportDialog, CohortExpandDialog, DistributionalDivergence, CohortComparisonRadar.model.ts) are used as-is by the new panel wrappers.

### Deprecated (kept but no longer imported by new page)

PatientSimilarityPage.tsx, SimilaritySearchForm.tsx, CohortCompareForm.tsx, CohortSeedForm.tsx, SimilarityModeToggle.tsx, StalenessIndicator.tsx, SearchDiagnosticsPanel.tsx, ResultCohortDiagnosticsPanel.tsx.

---

## Implementation Order

Tasks are ordered for incremental functionality. Each task produces a working, testable increment.

1. Pipeline types and state hook (foundation)
2. PipelineStep component (generic wrapper)
3. CohortSelectorBar (input UI)
4. ProfileComparisonPanel (Step 1 content)
5. CovariateBalancePanel (Step 2 content)
6. AnalysisPipeline (orchestrates steps)
7. PatientSimilarityWorkspace (top-level page + route swap)
8. PsmPanel (Step 3 content)
9. LandscapePanel (Step 4 content)
10. SettingsDrawer (configuration)
11. HeadToHeadDrawer (patient comparison)
12. Expand mode panels (CentroidProfilePanel + SimilarPatientsPanel)
13. SimilarPatientTable checkbox enhancement
14. Final integration, test cleanup, TypeScript/build verification

---

## Task 1: Pipeline Types and State Hook

**Files:**
- Create: `frontend/src/features/patient-similarity/types/pipeline.ts`
- Create: `frontend/src/features/patient-similarity/hooks/usePipeline.ts`

- [ ] **Step 1: Create pipeline types**

```typescript
// frontend/src/features/patient-similarity/types/pipeline.ts

export type PipelineMode = 'compare' | 'expand';

export type StepStatus = 'future' | 'loading' | 'completed' | 'error';

export interface StepResult {
  data: unknown;
  summary: string;
  executionTimeMs: number;
  completedAt: Date;
}

export interface StepDefinition {
  id: string;
  name: string;
  description: string;
  autoTrigger: boolean;
  /** Step number displayed in the UI */
  stepNumber: number;
}

export const COMPARE_STEPS: StepDefinition[] = [
  { id: 'profile', name: 'Profile Comparison', description: 'Divergence radar across 6 clinical dimensions', autoTrigger: true, stepNumber: 1 },
  { id: 'balance', name: 'Covariate Balance', description: 'SMD analysis with Love plot', autoTrigger: true, stepNumber: 2 },
  { id: 'psm', name: 'Propensity Score Matching', description: 'Create balanced comparison groups', autoTrigger: false, stepNumber: 3 },
  { id: 'landscape', name: 'UMAP Landscape', description: 'Project both cohorts into 2D/3D patient space', autoTrigger: false, stepNumber: 4 },
  { id: 'phenotypes', name: 'Phenotype Discovery', description: 'Find latent subgroups via consensus clustering', autoTrigger: false, stepNumber: 5 },
  { id: 'snf', name: 'Network Fusion', description: 'Multi-modal SNF with community detection', autoTrigger: false, stepNumber: 6 },
];

export const EXPAND_STEPS: StepDefinition[] = [
  { id: 'centroid', name: 'Centroid Profile', description: 'Cohort centroid radar with dimension coverage', autoTrigger: true, stepNumber: 1 },
  { id: 'similar', name: 'Similar Patients', description: 'Find patients matching cohort profile', autoTrigger: true, stepNumber: 2 },
  { id: 'landscape', name: 'UMAP Landscape', description: 'Project seed cohort and similar patients', autoTrigger: false, stepNumber: 3 },
  { id: 'phenotypes', name: 'Phenotype Discovery', description: 'Discover subgroups in combined population', autoTrigger: false, stepNumber: 4 },
];

export interface PipelineState {
  mode: PipelineMode;
  expandedSteps: Set<string>;
  completedSteps: Map<string, StepResult>;
  stepStatuses: Map<string, StepStatus>;
}

export interface PipelineActions {
  setMode: (mode: PipelineMode) => void;
  toggleStep: (stepId: string) => void;
  expandStep: (stepId: string) => void;
  collapseStep: (stepId: string) => void;
  markCompleted: (stepId: string, result: StepResult) => void;
  markLoading: (stepId: string) => void;
  markError: (stepId: string) => void;
  resetPipeline: () => void;
  getStepStatus: (stepId: string) => StepStatus;
  getStepResult: (stepId: string) => StepResult | undefined;
}
```

- [ ] **Step 2: Create pipeline state hook**

```typescript
// frontend/src/features/patient-similarity/hooks/usePipeline.ts

import { useCallback, useState } from 'react';
import {
  COMPARE_STEPS,
  EXPAND_STEPS,
  type PipelineActions,
  type PipelineMode,
  type PipelineState,
  type StepResult,
  type StepStatus,
} from '../types/pipeline';

const initialState = (): PipelineState => ({
  mode: 'compare',
  expandedSteps: new Set<string>(),
  completedSteps: new Map<string, StepResult>(),
  stepStatuses: new Map<string, StepStatus>(),
});

export function usePipeline(): PipelineState & PipelineActions {
  const [state, setState] = useState<PipelineState>(initialState);

  const setMode = useCallback((mode: PipelineMode) => {
    setState({
      ...initialState(),
      mode,
    });
  }, []);

  const toggleStep = useCallback((stepId: string) => {
    setState((prev) => {
      const next = new Set(prev.expandedSteps);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return { ...prev, expandedSteps: next };
    });
  }, []);

  const expandStep = useCallback((stepId: string) => {
    setState((prev) => {
      const next = new Set(prev.expandedSteps);
      next.add(stepId);
      return { ...prev, expandedSteps: next };
    });
  }, []);

  const collapseStep = useCallback((stepId: string) => {
    setState((prev) => {
      const next = new Set(prev.expandedSteps);
      next.delete(stepId);
      return { ...prev, expandedSteps: next };
    });
  }, []);

  const markCompleted = useCallback((stepId: string, result: StepResult) => {
    setState((prev) => {
      const completedSteps = new Map(prev.completedSteps);
      completedSteps.set(stepId, result);
      const stepStatuses = new Map(prev.stepStatuses);
      stepStatuses.set(stepId, 'completed');
      const expandedSteps = new Set(prev.expandedSteps);
      expandedSteps.add(stepId);
      return { ...prev, completedSteps, stepStatuses, expandedSteps };
    });
  }, []);

  const markLoading = useCallback((stepId: string) => {
    setState((prev) => {
      const stepStatuses = new Map(prev.stepStatuses);
      stepStatuses.set(stepId, 'loading');
      return { ...prev, stepStatuses };
    });
  }, []);

  const markError = useCallback((stepId: string) => {
    setState((prev) => {
      const stepStatuses = new Map(prev.stepStatuses);
      stepStatuses.set(stepId, 'error');
      return { ...prev, stepStatuses };
    });
  }, []);

  const resetPipeline = useCallback(() => {
    setState((prev) => ({
      ...initialState(),
      mode: prev.mode,
    }));
  }, []);

  const getStepStatus = useCallback(
    (stepId: string): StepStatus => state.stepStatuses.get(stepId) ?? 'future',
    [state.stepStatuses],
  );

  const getStepResult = useCallback(
    (stepId: string): StepResult | undefined => state.completedSteps.get(stepId),
    [state.completedSteps],
  );

  const steps = state.mode === 'compare' ? COMPARE_STEPS : EXPAND_STEPS;

  return {
    ...state,
    steps,
    setMode,
    toggleStep,
    expandStep,
    collapseStep,
    markCompleted,
    markLoading,
    markError,
    resetPipeline,
    getStepStatus,
    getStepResult,
  } as PipelineState & PipelineActions & { steps: typeof steps };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit"`
Expected: PASS (no errors from new files)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/patient-similarity/types/pipeline.ts frontend/src/features/patient-similarity/hooks/usePipeline.ts
git commit -m "feat: add pipeline types and state management hook for patient similarity workspace"
```

---

## Task 2: PipelineStep Component

**Files:**
- Create: `frontend/src/features/patient-similarity/components/PipelineStep.tsx`
- Create: `frontend/src/features/patient-similarity/components/__tests__/PipelineStep.test.tsx`

- [ ] **Step 1: Write PipelineStep tests**

```typescript
// frontend/src/features/patient-similarity/components/__tests__/PipelineStep.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PipelineStep } from '../PipelineStep';

describe('PipelineStep', () => {
  it('renders future state with step number and Run button', () => {
    render(
      <PipelineStep
        stepNumber={3}
        name="Propensity Score Matching"
        description="Create balanced comparison groups"
        status="future"
        onToggle={vi.fn()}
        onRun={vi.fn()}
      >
        <div>Panel content</div>
      </PipelineStep>,
    );
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Propensity Score Matching')).toBeInTheDocument();
    expect(screen.getByText('Run ▸')).toBeInTheDocument();
    expect(screen.queryByText('Panel content')).not.toBeInTheDocument();
  });

  it('renders loading state with spinner', () => {
    render(
      <PipelineStep
        stepNumber={1}
        name="Profile Comparison"
        description=""
        status="loading"
        onToggle={vi.fn()}
      >
        <div>Content</div>
      </PipelineStep>,
    );
    expect(screen.getByText('Profile Comparison')).toBeInTheDocument();
    expect(screen.queryByText('Run ▸')).not.toBeInTheDocument();
  });

  it('renders completed collapsed state with summary', () => {
    render(
      <PipelineStep
        stepNumber={1}
        name="Profile Comparison"
        description=""
        status="completed"
        isExpanded={false}
        summary="Overall divergence 42% · 6 dimensions analyzed"
        executionTimeMs={800}
        onToggle={vi.fn()}
      >
        <div>Panel content</div>
      </PipelineStep>,
    );
    expect(screen.getByText(/Overall divergence 42%/)).toBeInTheDocument();
    expect(screen.getByText('0.8s')).toBeInTheDocument();
    expect(screen.queryByText('Panel content')).not.toBeInTheDocument();
  });

  it('renders completed expanded state with children', () => {
    render(
      <PipelineStep
        stepNumber={1}
        name="Profile Comparison"
        description=""
        status="completed"
        isExpanded={true}
        summary="Overall divergence 42%"
        onToggle={vi.fn()}
      >
        <div>Panel content</div>
      </PipelineStep>,
    );
    expect(screen.getByText('Panel content')).toBeInTheDocument();
  });

  it('calls onToggle when header clicked on completed step', () => {
    const onToggle = vi.fn();
    render(
      <PipelineStep
        stepNumber={1}
        name="Profile Comparison"
        description=""
        status="completed"
        isExpanded={false}
        summary="42%"
        onToggle={onToggle}
      >
        <div>Content</div>
      </PipelineStep>,
    );
    fireEvent.click(screen.getByText('Profile Comparison'));
    expect(onToggle).toHaveBeenCalledOnce();
  });

  it('calls onRun when Run button clicked on future step', () => {
    const onRun = vi.fn();
    render(
      <PipelineStep
        stepNumber={3}
        name="PSM"
        description="desc"
        status="future"
        onToggle={vi.fn()}
        onRun={onRun}
      >
        <div>Content</div>
      </PipelineStep>,
    );
    fireEvent.click(screen.getByText('Run ▸'));
    expect(onRun).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run src/features/patient-similarity/components/__tests__/PipelineStep.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PipelineStep**

```typescript
// frontend/src/features/patient-similarity/components/PipelineStep.tsx

import { type ReactNode } from 'react';
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
      <div className="mb-2 rounded-lg border border-dashed border-[#333] bg-[#131316] px-4 py-3 opacity-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full border border-[#444]">
              <span className="text-[8px] text-[#555]">{stepNumber}</span>
            </div>
            <span className="text-xs text-[#777]">{name}</span>
            <span className="text-[10px] text-[#555]">— {description}</span>
          </div>
          {onRun && (
            <button
              onClick={onRun}
              className="rounded border border-[#444] bg-transparent px-2.5 py-1 text-[10px] text-[#555] transition-colors hover:border-[#666] hover:text-[#888]"
            >
              Run ▸
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="mb-2 rounded-lg border border-[#333] bg-[#131316] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#333] border-t-[#2DD4BF]" />
          <span className="text-xs text-[#ddd]">{name}</span>
          <span className="text-[10px] text-[#555]">Running...</span>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mb-2 rounded-lg border border-[#9B1B30] bg-[#131316] px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#9B1B3020]">
            <span className="text-[11px] text-[#9B1B30]">✕</span>
          </div>
          <span className="text-xs text-[#ddd]">{name}</span>
          <span className="text-[10px] text-[#9B1B30]">Failed</span>
        </div>
      </div>
    );
  }

  // status === 'completed'
  const borderColor = isExpanded ? 'border-[#9B1B30]' : 'border-[#2DD4BF40]';

  return (
    <div className={`mb-2 overflow-hidden rounded-lg border ${borderColor} bg-[#131316]`}>
      {/* Clickable header */}
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
        type="button"
      >
        <div className="flex items-center gap-2.5">
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2DD4BF20]">
            <span className="text-[11px] text-[#2DD4BF]">✓</span>
          </div>
          <span className="text-xs font-medium text-[#ddd]">{name}</span>
          {!isExpanded && summary && (
            <span className="ml-2 text-[11px] text-[#555]">{summary}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {executionTimeMs !== undefined && (
            <span className="text-[10px] text-[#555]">
              {(executionTimeMs / 1000).toFixed(1)}s
            </span>
          )}
          <span className="text-xs text-[#555]">{isExpanded ? '▾' : '▸'}</span>
        </div>
      </button>

      {/* Expanded content */}
      {isExpanded && (
        <div className="border-t border-[#222] p-4">{children}</div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run src/features/patient-similarity/components/__tests__/PipelineStep.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: Verify TypeScript compiles**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/patient-similarity/components/PipelineStep.tsx frontend/src/features/patient-similarity/components/__tests__/PipelineStep.test.tsx
git commit -m "feat: add PipelineStep collapsible panel component with 4 states"
```

---

## Task 3: CohortSelectorBar

**Files:**
- Create: `frontend/src/features/patient-similarity/components/CohortSelectorBar.tsx`
- Create: `frontend/src/features/patient-similarity/components/__tests__/CohortSelectorBar.test.tsx`
- Reference: `frontend/src/features/cohort-definitions/hooks/useCohortDefinitions.ts`
- Reference: `frontend/src/stores/sourceStore.ts`
- Reference: `frontend/src/features/data-sources/hooks/useSources.ts`

- [ ] **Step 1: Write CohortSelectorBar tests**

```typescript
// frontend/src/features/patient-similarity/components/__tests__/CohortSelectorBar.test.tsx

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CohortSelectorBar } from '../CohortSelectorBar';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

describe('CohortSelectorBar', () => {
  it('renders mode toggle with Compare Cohorts active by default', () => {
    renderWithProviders(
      <CohortSelectorBar
        mode="compare"
        sourceId={1}
        targetCohortId={null}
        comparatorCohortId={null}
        onModeChange={vi.fn()}
        onSourceChange={vi.fn()}
        onTargetChange={vi.fn()}
        onComparatorChange={vi.fn()}
        onCompare={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );
    expect(screen.getByText('Compare Cohorts')).toBeInTheDocument();
    expect(screen.getByText('Expand Cohort')).toBeInTheDocument();
  });

  it('renders Compare button in compare mode', () => {
    renderWithProviders(
      <CohortSelectorBar
        mode="compare"
        sourceId={1}
        targetCohortId={10}
        comparatorCohortId={20}
        onModeChange={vi.fn()}
        onSourceChange={vi.fn()}
        onTargetChange={vi.fn()}
        onComparatorChange={vi.fn()}
        onCompare={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );
    expect(screen.getByText('Compare')).toBeInTheDocument();
  });

  it('renders Find Similar button in expand mode', () => {
    renderWithProviders(
      <CohortSelectorBar
        mode="expand"
        sourceId={1}
        targetCohortId={10}
        comparatorCohortId={null}
        onModeChange={vi.fn()}
        onSourceChange={vi.fn()}
        onTargetChange={vi.fn()}
        onComparatorChange={vi.fn()}
        onCompare={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );
    expect(screen.getByText('Find Similar')).toBeInTheDocument();
  });

  it('calls onModeChange when Expand Cohort clicked', () => {
    const onModeChange = vi.fn();
    renderWithProviders(
      <CohortSelectorBar
        mode="compare"
        sourceId={1}
        targetCohortId={null}
        comparatorCohortId={null}
        onModeChange={onModeChange}
        onSourceChange={vi.fn()}
        onTargetChange={vi.fn()}
        onComparatorChange={vi.fn()}
        onCompare={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText('Expand Cohort'));
    expect(onModeChange).toHaveBeenCalledWith('expand');
  });

  it('calls onOpenSettings when gear button clicked', () => {
    const onOpenSettings = vi.fn();
    renderWithProviders(
      <CohortSelectorBar
        mode="compare"
        sourceId={1}
        targetCohortId={null}
        comparatorCohortId={null}
        onModeChange={vi.fn()}
        onSourceChange={vi.fn()}
        onTargetChange={vi.fn()}
        onComparatorChange={vi.fn()}
        onCompare={vi.fn()}
        onOpenSettings={onOpenSettings}
      />,
    );
    fireEvent.click(screen.getByTitle('Analysis settings'));
    expect(onOpenSettings).toHaveBeenCalledOnce();
  });

  it('disables Compare when cohorts not selected', () => {
    renderWithProviders(
      <CohortSelectorBar
        mode="compare"
        sourceId={1}
        targetCohortId={null}
        comparatorCohortId={null}
        onModeChange={vi.fn()}
        onSourceChange={vi.fn()}
        onTargetChange={vi.fn()}
        onComparatorChange={vi.fn()}
        onCompare={vi.fn()}
        onOpenSettings={vi.fn()}
      />,
    );
    expect(screen.getByText('Compare')).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run src/features/patient-similarity/components/__tests__/CohortSelectorBar.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement CohortSelectorBar**

```typescript
// frontend/src/features/patient-similarity/components/CohortSelectorBar.tsx

import { useCohortDefinitions } from '@/features/cohort-definitions/hooks/useCohortDefinitions';
import { useSources } from '@/features/data-sources/hooks/useSources';
import type { PipelineMode } from '../types/pipeline';
import { useCohortProfile } from '../hooks/usePatientSimilarity';
import { GenerationStatusBanner } from './GenerationStatusBanner';

interface CohortSelectorBarProps {
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
  const { data: sources } = useSources();
  const { data: cohorts } = useCohortDefinitions();

  const canRun =
    mode === 'compare'
      ? targetCohortId !== null && comparatorCohortId !== null && sourceId !== null
      : targetCohortId !== null && sourceId !== null;

  const actionLabel = mode === 'compare' ? 'Compare' : 'Find Similar';
  const actionColor = mode === 'compare' ? 'bg-[#9B1B30]' : 'bg-[#2DD4BF] text-[#0E0E11]';

  return (
    <div className="sticky top-0 z-10 border-b border-[#2DD4BF20] bg-[#131316]">
      <div className="flex items-end gap-3 px-5 py-3">
        {/* Data Source */}
        <div className="min-w-[140px]">
          <div className="mb-1 text-[9px] uppercase tracking-[1.5px] text-[#777]">
            Data Source
          </div>
          <select
            value={sourceId ?? ''}
            onChange={(e) => onSourceChange(Number(e.target.value))}
            className="w-full rounded-md border border-[#333] bg-[#1a1a1f] px-2.5 py-1.5 text-xs text-[#ccc]"
          >
            <option value="">Select source</option>
            {sources?.map((s) => (
              <option key={s.source_id} value={s.source_id}>
                {s.source_name}
              </option>
            ))}
          </select>
        </div>

        {/* Mode Toggle */}
        <div className="pb-0.5">
          <div className="flex gap-0.5 rounded-md bg-[#1a1a1f] p-0.5">
            <button
              onClick={() => onModeChange('compare')}
              className={`rounded px-3 py-1.5 text-[11px] font-medium ${
                mode === 'compare'
                  ? 'bg-[#9B1B3030] text-[#9B1B30]'
                  : 'text-[#777]'
              }`}
              type="button"
            >
              Compare Cohorts
            </button>
            <button
              onClick={() => onModeChange('expand')}
              className={`rounded px-3 py-1.5 text-[11px] font-medium ${
                mode === 'expand'
                  ? 'bg-[#2DD4BF30] text-[#2DD4BF]'
                  : 'text-[#777]'
              }`}
              type="button"
            >
              Expand Cohort
            </button>
          </div>
        </div>

        {/* Target Cohort */}
        <div className="min-w-[180px] flex-1">
          <div className="mb-1 flex items-center gap-1 text-[9px] uppercase tracking-[1.5px] text-[#9B1B30]">
            <span className="inline-block h-2 w-2 rounded-full bg-[#9B1B30]" />
            {mode === 'compare' ? 'Target Cohort' : 'Seed Cohort'}
          </div>
          <select
            value={targetCohortId ?? ''}
            onChange={(e) => onTargetChange(e.target.value ? Number(e.target.value) : null)}
            className="w-full rounded-md border border-[#9B1B3050] bg-[#1a1a1f] px-2.5 py-1.5 text-xs text-[#ccc]"
          >
            <option value="">Select cohort</option>
            {cohorts?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Comparator Cohort (compare mode only) */}
        {mode === 'compare' && (
          <div className="min-w-[180px] flex-1">
            <div className="mb-1 flex items-center gap-1 text-[9px] uppercase tracking-[1.5px] text-[#2DD4BF]">
              <span className="inline-block h-2 w-2 rounded-full bg-[#2DD4BF]" />
              Comparator Cohort
            </div>
            <select
              value={comparatorCohortId ?? ''}
              onChange={(e) =>
                onComparatorChange(e.target.value ? Number(e.target.value) : null)
              }
              className="w-full rounded-md border border-[#2DD4BF50] bg-[#1a1a1f] px-2.5 py-1.5 text-xs text-[#ccc]"
            >
              <option value="">Select cohort</option>
              {cohorts?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-1.5 pb-0.5">
          <button
            onClick={onCompare}
            disabled={!canRun || isRunning}
            className={`rounded-md ${actionColor} px-4 py-1.5 text-[11px] font-semibold text-white transition-colors disabled:opacity-40`}
            type="button"
          >
            {isRunning ? 'Running...' : actionLabel}
          </button>
          <button
            onClick={onOpenSettings}
            title="Analysis settings"
            className="rounded-md border border-[#333] bg-transparent px-2.5 py-1.5 text-[11px] text-[#777] transition-colors hover:border-[#555]"
            type="button"
          >
            ⚙
          </button>
        </div>
      </div>

      {/* Row 2: Generation status (conditional) */}
      {sourceId && (targetCohortId || comparatorCohortId) && (
        <div className="flex gap-4 border-t border-[#1a1a1f] px-5 py-1.5">
          {targetCohortId && (
            <GenerationStatusBanner
              cohortDefinitionId={targetCohortId}
              sourceId={sourceId}
              isLoading={false}
            />
          )}
          {mode === 'compare' && comparatorCohortId && (
            <GenerationStatusBanner
              cohortDefinitionId={comparatorCohortId}
              sourceId={sourceId}
              isLoading={false}
            />
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run src/features/patient-similarity/components/__tests__/CohortSelectorBar.test.tsx`
Expected: PASS (6 tests)

- [ ] **Step 5: TypeScript check**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/patient-similarity/components/CohortSelectorBar.tsx frontend/src/features/patient-similarity/components/__tests__/CohortSelectorBar.test.tsx
git commit -m "feat: add CohortSelectorBar with mode toggle, cohort dropdowns, and generation status"
```

---

## Task 4: ProfileComparisonPanel (Step 1)

**Files:**
- Create: `frontend/src/features/patient-similarity/components/ProfileComparisonPanel.tsx`
- Reference: `frontend/src/features/patient-similarity/components/CohortComparisonRadar.tsx`
- Reference: `frontend/src/features/patient-similarity/components/DivergenceScores.tsx`
- Reference: `frontend/src/features/patient-similarity/types/patientSimilarity.ts` — `CohortComparisonResult`

- [ ] **Step 1: Implement ProfileComparisonPanel**

This panel wraps existing `CohortComparisonRadar` and `DivergenceScores` components, adding the overall divergence banner and demographics comparison table.

```typescript
// frontend/src/features/patient-similarity/components/ProfileComparisonPanel.tsx

import type { CohortComparisonResult } from '../types/patientSimilarity';
import { CohortComparisonRadar } from './CohortComparisonRadar';
import { DivergenceScores } from './DivergenceScores';

interface ProfileComparisonPanelProps {
  result: CohortComparisonResult;
  sourceName: string;
  targetName: string;
  onContinue: () => void;
}

function getDivergenceLabel(value: number): { label: string; color: string } {
  if (value >= 0.5) return { label: 'High divergence', color: 'text-[#9B1B30]' };
  if (value >= 0.3) return { label: 'Moderate divergence', color: 'text-[#C9A227]' };
  return { label: 'Low divergence', color: 'text-[#2DD4BF]' };
}

function getDivergenceBarColor(value: number): string {
  if (value >= 0.5) return 'bg-[#9B1B30]';
  if (value >= 0.3) return 'bg-[#C9A227]';
  return 'bg-[#2DD4BF]';
}

export function ProfileComparisonPanel({
  result,
  sourceName,
  targetName,
  onContinue,
}: ProfileComparisonPanelProps) {
  const overallPct = Math.round(result.overall_divergence * 100);
  const { label, color } = getDivergenceLabel(result.overall_divergence);

  const dimensions = Object.entries(result.divergence)
    .filter(([, v]) => v.available)
    .sort(([, a], [, b]) => (b.score ?? 0) - (a.score ?? 0));

  return (
    <div>
      {/* Overall divergence banner */}
      <div className="mb-4 flex items-center gap-4 rounded-lg bg-[#131316] px-4 py-3">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-[#555]">Overall Divergence</div>
          <div className="text-[28px] font-bold text-[#C9A227]">{overallPct}%</div>
        </div>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#222]">
          <div
            className="h-full rounded-full bg-gradient-to-r from-[#2DD4BF] to-[#C9A227]"
            style={{ width: `${overallPct}%` }}
          />
        </div>
        <div className="text-right">
          <div className="text-[10px] text-[#888]">Interpretation</div>
          <div className={`text-xs font-medium ${color}`}>{label}</div>
        </div>
      </div>

      {/* Two-column: Radar + Dimension bars */}
      <div className="mb-3 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-[#131316] p-4">
          <div className="mb-3 text-[10px] uppercase tracking-wider text-[#777]">
            Divergence Radar
          </div>
          <CohortComparisonRadar
            divergence={result.divergence}
            sourceName={sourceName}
            targetName={targetName}
          />
        </div>

        <div className="rounded-lg bg-[#131316] p-4">
          <div className="mb-3 text-[10px] uppercase tracking-wider text-[#777]">
            Per-Dimension Divergence
          </div>
          {dimensions.map(([key, dim]) => {
            const pct = Math.round((dim.score ?? 0) * 100);
            return (
              <div key={key} className="mb-2.5">
                <div className="mb-1 flex justify-between">
                  <span className="text-[11px] text-[#ccc]">{key}</span>
                  <span className={`text-[11px] font-semibold ${getDivergenceLabel(dim.score ?? 0).color}`}>
                    {pct}%
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-[#222]">
                  <div
                    className={`h-full rounded-full ${getDivergenceBarColor(dim.score ?? 0)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-end border-t border-[#222] pt-3">
        <button
          onClick={onContinue}
          className="rounded-md border border-[#C9A22740] bg-[#C9A22720] px-3 py-1.5 text-[10px] text-[#C9A227] transition-colors hover:bg-[#C9A22730]"
          type="button"
        >
          View Covariate Balance →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit"`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/patient-similarity/components/ProfileComparisonPanel.tsx
git commit -m "feat: add ProfileComparisonPanel wrapping radar and dimension divergence bars"
```

---

## Task 5: CovariateBalancePanel (Step 2)

**Files:**
- Create: `frontend/src/features/patient-similarity/components/CovariateBalancePanel.tsx`
- Reference: `frontend/src/features/patient-similarity/components/LovePlot.tsx`
- Reference: `frontend/src/features/patient-similarity/components/DistributionalDivergence.tsx`

- [ ] **Step 1: Implement CovariateBalancePanel**

```typescript
// frontend/src/features/patient-similarity/components/CovariateBalancePanel.tsx

import type { CohortComparisonResult } from '../types/patientSimilarity';
import { LovePlot } from './LovePlot';
import { DistributionalDivergence } from './DistributionalDivergence';

interface CovariateBalancePanelProps {
  result: CohortComparisonResult;
  onRunPsm: () => void;
  onContinue: () => void;
}

export function CovariateBalancePanel({
  result,
  onRunPsm,
  onContinue,
}: CovariateBalancePanelProps) {
  const covariates = result.covariates ?? [];
  const totalCovariates = covariates.length;
  const imbalanced = covariates.filter((c) => Math.abs(c.smd) >= 0.1);
  const balanced = totalCovariates - imbalanced.length;
  const meanSmd =
    totalCovariates > 0
      ? covariates.reduce((sum, c) => sum + Math.abs(c.smd), 0) / totalCovariates
      : 0;
  const worstCovariate = imbalanced.length > 0
    ? imbalanced.reduce((a, b) => (Math.abs(b.smd) > Math.abs(a.smd) ? b : a))
    : null;

  const psmRecommended = imbalanced.length > 0;

  return (
    <div>
      {/* Summary metrics */}
      <div className="mb-4 flex items-center gap-5 rounded-lg bg-[#131316] px-4 py-3">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-[#555]">Total Covariates</div>
          <div className="text-[22px] font-semibold text-[#ccc]">{totalCovariates}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-[#555]">
            Balanced (|SMD| &lt; 0.1)
          </div>
          <div className="text-[22px] font-semibold text-[#2DD4BF]">{balanced}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-[#555]">Imbalanced</div>
          <div className="text-[22px] font-semibold text-[#9B1B30]">{imbalanced.length}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-[#555]">Mean |SMD|</div>
          <div className="text-[22px] font-semibold text-[#C9A227]">{meanSmd.toFixed(2)}</div>
        </div>
        <div className="flex-1" />
        {psmRecommended && (
          <div className="rounded-md bg-[#9B1B3020] px-3.5 py-1.5 text-[11px] font-medium text-[#9B1B30]">
            ⚠ PSM recommended
          </div>
        )}
      </div>

      {/* Two-column: Love Plot + Distributional Divergence */}
      <div className="mb-3 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-[#131316] p-4">
          <div className="mb-3 text-[10px] uppercase tracking-wider text-[#777]">
            Love Plot — Pre-Matching SMD
          </div>
          {covariates.length > 0 ? (
            <LovePlot covariates={covariates} />
          ) : (
            <div className="flex h-40 items-center justify-center text-xs text-[#555]">
              No covariate data available
            </div>
          )}
        </div>

        <div className="rounded-lg bg-[#131316] p-4">
          <div className="mb-3 text-[10px] uppercase tracking-wider text-[#777]">
            Distributional Divergence (JSD / Wasserstein)
          </div>
          {result.distributional_divergence ? (
            <DistributionalDivergence divergence={result.distributional_divergence} />
          ) : (
            <div className="flex h-40 items-center justify-center text-xs text-[#555]">
              No distributional data available
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between border-t border-[#222] pt-3">
        <span className="text-[11px] text-[#9B1B30]">
          {imbalanced.length > 0
            ? `${imbalanced.length} covariates above threshold${
                worstCovariate ? ` — worst: ${worstCovariate.name} (SMD ${Math.abs(worstCovariate.smd).toFixed(2)})` : ''
              }`
            : 'All covariates balanced'}
        </span>
        <div className="flex gap-2">
          {psmRecommended && (
            <button
              onClick={onRunPsm}
              className="rounded-md border border-[#9B1B3040] bg-[#9B1B3020] px-3 py-1.5 text-[10px] font-medium text-[#9B1B30] transition-colors hover:bg-[#9B1B3030]"
              type="button"
            >
              Run Propensity Score Matching →
            </button>
          )}
          <button
            onClick={onContinue}
            className="rounded-md border border-[#2DD4BF40] bg-[#2DD4BF20] px-3 py-1.5 text-[10px] text-[#2DD4BF] transition-colors hover:bg-[#2DD4BF30]"
            type="button"
          >
            Continue to Landscape →
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeScript check**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit"`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/patient-similarity/components/CovariateBalancePanel.tsx
git commit -m "feat: add CovariateBalancePanel with summary metrics, Love plot, and PSM recommendation"
```

---

## Task 6: AnalysisPipeline + PatientSimilarityWorkspace + Route Swap

This is the integration task that wires everything together and replaces the old page.

**Files:**
- Create: `frontend/src/features/patient-similarity/components/AnalysisPipeline.tsx`
- Create: `frontend/src/features/patient-similarity/pages/PatientSimilarityWorkspace.tsx`
- Modify: `frontend/src/app/router.tsx:414-420`
- Create: `frontend/src/features/patient-similarity/pages/__tests__/PatientSimilarityWorkspace.test.tsx`

- [ ] **Step 1: Implement AnalysisPipeline**

```typescript
// frontend/src/features/patient-similarity/components/AnalysisPipeline.tsx

import type { ReactNode } from 'react';
import type { StepDefinition, StepStatus, StepResult } from '../types/pipeline';
import { PipelineStep } from './PipelineStep';

interface AnalysisPipelineProps {
  steps: StepDefinition[];
  expandedSteps: Set<string>;
  getStepStatus: (stepId: string) => StepStatus;
  getStepResult: (stepId: string) => StepResult | undefined;
  onToggleStep: (stepId: string) => void;
  onRunStep: (stepId: string) => void;
  renderStepContent: (stepId: string) => ReactNode;
}

export function AnalysisPipeline({
  steps,
  expandedSteps,
  getStepStatus,
  getStepResult,
  onToggleStep,
  onRunStep,
  renderStepContent,
}: AnalysisPipelineProps) {
  return (
    <div className="px-5 py-4">
      {steps.map((step) => {
        const status = getStepStatus(step.id);
        const result = getStepResult(step.id);
        const isExpanded = expandedSteps.has(step.id);

        return (
          <PipelineStep
            key={step.id}
            stepNumber={step.stepNumber}
            name={step.name}
            description={step.description}
            status={status}
            isExpanded={isExpanded}
            summary={result?.summary}
            executionTimeMs={result?.executionTimeMs}
            onToggle={() => onToggleStep(step.id)}
            onRun={status === 'future' ? () => onRunStep(step.id) : undefined}
          >
            {renderStepContent(step.id)}
          </PipelineStep>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Implement PatientSimilarityWorkspace**

```typescript
// frontend/src/features/patient-similarity/pages/PatientSimilarityWorkspace.tsx

import { useCallback, useState } from 'react';
import { useSourceStore } from '@/stores/sourceStore';
import { CohortSelectorBar } from '../components/CohortSelectorBar';
import { AnalysisPipeline } from '../components/AnalysisPipeline';
import { ProfileComparisonPanel } from '../components/ProfileComparisonPanel';
import { CovariateBalancePanel } from '../components/CovariateBalancePanel';
import { usePipeline } from '../hooks/usePipeline';
import { useCompareCohorts } from '../hooks/usePatientSimilarity';
import { COMPARE_STEPS, EXPAND_STEPS, type PipelineMode, type StepResult } from '../types/pipeline';
import type { CohortComparisonResult } from '../types/patientSimilarity';

export default function PatientSimilarityWorkspace() {
  const { activeSourceId, setActiveSource } = useSourceStore();
  const [sourceId, setSourceId] = useState<number | null>(activeSourceId ?? null);
  const [targetCohortId, setTargetCohortId] = useState<number | null>(null);
  const [comparatorCohortId, setComparatorCohortId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const pipeline = usePipeline();
  const compareMutation = useCompareCohorts();

  const steps = pipeline.mode === 'compare' ? COMPARE_STEPS : EXPAND_STEPS;

  const handleSourceChange = useCallback(
    (id: number) => {
      setSourceId(id);
      setActiveSource(id);
      setTargetCohortId(null);
      setComparatorCohortId(null);
      pipeline.resetPipeline();
    },
    [setActiveSource, pipeline],
  );

  const handleTargetChange = useCallback(
    (id: number | null) => {
      setTargetCohortId(id);
      pipeline.resetPipeline();
    },
    [pipeline],
  );

  const handleComparatorChange = useCallback(
    (id: number | null) => {
      setComparatorCohortId(id);
      pipeline.resetPipeline();
    },
    [pipeline],
  );

  const handleModeChange = useCallback(
    (mode: PipelineMode) => {
      pipeline.setMode(mode);
      setComparatorCohortId(null);
    },
    [pipeline],
  );

  const handleCompare = useCallback(() => {
    if (!sourceId || !targetCohortId) return;

    if (pipeline.mode === 'compare' && comparatorCohortId) {
      pipeline.resetPipeline();

      // Step 1: Profile Comparison
      pipeline.markLoading('profile');
      const startProfile = Date.now();
      compareMutation.mutate(
        {
          source_cohort_definition_id: targetCohortId,
          target_cohort_definition_id: comparatorCohortId,
          source_id: sourceId,
        },
        {
          onSuccess: (data: CohortComparisonResult) => {
            pipeline.markCompleted('profile', {
              data,
              summary: `Overall divergence ${Math.round(data.overall_divergence * 100)}% · ${
                Object.values(data.divergence).filter((d) => d.available).length
              } dimensions analyzed`,
              executionTimeMs: Date.now() - startProfile,
              completedAt: new Date(),
            });

            // Step 2: Covariate Balance (auto-trigger)
            // Covariate data is part of the same comparison result
            pipeline.markCompleted('balance', {
              data,
              summary: buildBalanceSummary(data),
              executionTimeMs: Date.now() - startProfile,
              completedAt: new Date(),
            });
            pipeline.expandStep('profile');
          },
          onError: () => {
            pipeline.markError('profile');
          },
        },
      );
    }
    // Expand mode handled in Task 12
  }, [sourceId, targetCohortId, comparatorCohortId, pipeline, compareMutation]);

  const handleRunStep = useCallback(
    (stepId: string) => {
      // Steps 3-6 dispatch their respective mutations
      // Implemented in Tasks 8-9 (PSM, Landscape) and Phase 3 (Phenotypes, SNF)
      console.log('Run step:', stepId);
    },
    [],
  );

  const renderStepContent = useCallback(
    (stepId: string) => {
      const result = pipeline.getStepResult(stepId);
      if (!result) return null;

      switch (stepId) {
        case 'profile':
          return (
            <ProfileComparisonPanel
              result={result.data as CohortComparisonResult}
              sourceName="Target"
              targetName="Comparator"
              onContinue={() => pipeline.expandStep('balance')}
            />
          );
        case 'balance':
          return (
            <CovariateBalancePanel
              result={result.data as CohortComparisonResult}
              onRunPsm={() => handleRunStep('psm')}
              onContinue={() => handleRunStep('landscape')}
            />
          );
        default:
          return (
            <div className="flex h-32 items-center justify-center text-xs text-[#555]">
              Panel implementation pending
            </div>
          );
      }
    },
    [pipeline, handleRunStep],
  );

  return (
    <div className="flex min-h-screen flex-col bg-[#0E0E11]">
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
        onOpenSettings={() => setSettingsOpen(true)}
        isRunning={compareMutation.isPending}
      />

      <AnalysisPipeline
        steps={steps}
        expandedSteps={pipeline.expandedSteps}
        getStepStatus={pipeline.getStepStatus}
        getStepResult={pipeline.getStepResult}
        onToggleStep={pipeline.toggleStep}
        onRunStep={handleRunStep}
        renderStepContent={renderStepContent}
      />
    </div>
  );
}

function buildBalanceSummary(result: CohortComparisonResult): string {
  const covariates = result.covariates ?? [];
  const total = covariates.length;
  const imbalanced = covariates.filter((c) => Math.abs(c.smd) >= 0.1);
  if (total === 0) return 'No covariate data';
  const worst = imbalanced.length > 0
    ? imbalanced.reduce((a, b) => (Math.abs(b.smd) > Math.abs(a.smd) ? b : a))
    : null;
  return `${imbalanced.length}/${total} covariates imbalanced${
    worst ? ` · worst: ${worst.name} (SMD ${Math.abs(worst.smd).toFixed(2)})` : ''
  }`;
}
```

- [ ] **Step 3: Write basic workspace test**

```typescript
// frontend/src/features/patient-similarity/pages/__tests__/PatientSimilarityWorkspace.test.tsx

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import PatientSimilarityWorkspace from '../PatientSimilarityWorkspace';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

function renderPage() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <PatientSimilarityWorkspace />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('PatientSimilarityWorkspace', () => {
  it('renders CohortSelectorBar with mode toggle', () => {
    renderPage();
    expect(screen.getByText('Compare Cohorts')).toBeInTheDocument();
    expect(screen.getByText('Expand Cohort')).toBeInTheDocument();
  });

  it('renders pipeline steps in compare mode', () => {
    renderPage();
    expect(screen.getByText('Profile Comparison')).toBeInTheDocument();
    expect(screen.getByText('Covariate Balance')).toBeInTheDocument();
    expect(screen.getByText('Propensity Score Matching')).toBeInTheDocument();
    expect(screen.getByText('UMAP Landscape')).toBeInTheDocument();
  });

  it('renders Compare button disabled when no cohorts selected', () => {
    renderPage();
    expect(screen.getByText('Compare')).toBeDisabled();
  });
});
```

- [ ] **Step 4: Update router to load new workspace**

In `frontend/src/app/router.tsx`, find the patient-similarity route (lines ~414-420) and change the lazy import:

```typescript
// Change from:
{
  path: "patient-similarity",
  lazy: () => import("@/features/patient-similarity/pages/PatientSimilarityPage"),
}
// To:
{
  path: "patient-similarity",
  lazy: () => import("@/features/patient-similarity/pages/PatientSimilarityWorkspace"),
}
```

- [ ] **Step 5: Run tests**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run src/features/patient-similarity/`
Expected: New workspace tests PASS. Old PatientSimilarityPage tests may fail (expected — old page is no longer routed).

- [ ] **Step 6: TypeScript check**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit"`
Expected: PASS

- [ ] **Step 7: Build check**

Run: `docker compose exec node sh -c "cd /app && npx vite build"`
Expected: PASS (vite build is stricter than tsc)

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/patient-similarity/components/AnalysisPipeline.tsx frontend/src/features/patient-similarity/pages/PatientSimilarityWorkspace.tsx frontend/src/features/patient-similarity/pages/__tests__/PatientSimilarityWorkspace.test.tsx frontend/src/app/router.tsx
git commit -m "feat: wire PatientSimilarityWorkspace with pipeline, swap route from old page"
```

---

## Task 7: PsmPanel (Step 3)

**Files:**
- Create: `frontend/src/features/patient-similarity/components/PsmPanel.tsx`
- Reference: `frontend/src/features/patient-similarity/components/PropensityMatchResults.tsx`
- Reference: `frontend/src/features/patient-similarity/components/PreferenceScoreDistribution.tsx`
- Reference: `frontend/src/features/patient-similarity/components/LovePlot.tsx`

- [ ] **Step 1: Implement PsmPanel**

This panel wraps existing PropensityMatchResults components and adds the pipeline action bar with cross-cohort search and export actions.

```typescript
// frontend/src/features/patient-similarity/components/PsmPanel.tsx

import type { PropensityMatchResult } from '../types/patientSimilarity';
import { PreferenceScoreDistribution } from './PreferenceScoreDistribution';
import { LovePlot } from './LovePlot';

interface PsmPanelProps {
  result: PropensityMatchResult;
  onExportMatched: () => void;
  onContinue: () => void;
}

export function PsmPanel({ result, onExportMatched, onContinue }: PsmPanelProps) {
  const metrics = result.model_metrics;
  const balance = result.balance;
  const smdReduction =
    balance?.before_covariates && balance?.after_covariates
      ? computeSmdReduction(balance.before_covariates, balance.after_covariates)
      : null;

  return (
    <div>
      {/* Metrics row */}
      <div className="mb-4 flex gap-5">
        <div>
          <div className="text-[9px] uppercase tracking-wider text-[#555]">AUC</div>
          <div className="text-lg font-semibold text-[#2DD4BF]">{metrics.auc.toFixed(2)}</div>
        </div>
        <div>
          <div className="text-[9px] uppercase tracking-wider text-[#555]">Matched Pairs</div>
          <div className="text-lg font-semibold text-[#C9A227]">{result.matched_pairs.length}</div>
        </div>
        {smdReduction !== null && (
          <div>
            <div className="text-[9px] uppercase tracking-wider text-[#555]">SMD Reduction</div>
            <div className="text-lg font-semibold text-[#2DD4BF]">{smdReduction}%</div>
          </div>
        )}
        <div>
          <div className="text-[9px] uppercase tracking-wider text-[#555]">Caliper</div>
          <div className="text-lg font-semibold text-[#ccc]">{metrics.caliper.toFixed(2)}σ</div>
        </div>
      </div>

      {/* Two-column: Preference Score + Love Plot */}
      <div className="mb-3 grid grid-cols-2 gap-4">
        <div className="rounded-lg bg-[#0E0E11] p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-[#777]">
            Preference Score Distribution
          </div>
          {result.preference_distribution && (
            <PreferenceScoreDistribution distribution={result.preference_distribution} />
          )}
        </div>
        <div className="rounded-lg bg-[#0E0E11] p-3">
          <div className="mb-2 text-[10px] uppercase tracking-wider text-[#777]">
            Love Plot — Before / After Matching
          </div>
          {balance?.after_covariates ? (
            <LovePlot
              covariates={balance.after_covariates}
              beforeCovariates={balance.before_covariates}
            />
          ) : balance?.before_covariates ? (
            <LovePlot covariates={balance.before_covariates} />
          ) : (
            <div className="flex h-40 items-center justify-center text-xs text-[#555]">
              No balance data
            </div>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between border-t border-[#222] pt-3">
        <div className="flex gap-2">
          <button
            onClick={onExportMatched}
            className="rounded border border-[#333] px-3 py-1.5 text-[10px] text-[#777] transition-colors hover:border-[#555]"
            type="button"
          >
            Export Matched Cohort
          </button>
        </div>
        <button
          onClick={onContinue}
          className="rounded-md border border-[#2DD4BF40] bg-[#2DD4BF20] px-3 py-1.5 text-[10px] text-[#2DD4BF] transition-colors hover:bg-[#2DD4BF30]"
          type="button"
        >
          Continue to Landscape →
        </button>
      </div>
    </div>
  );
}

function computeSmdReduction(
  before: Array<{ smd: number }>,
  after: Array<{ smd: number }>,
): number {
  const meanBefore =
    before.length > 0
      ? before.reduce((s, c) => s + Math.abs(c.smd), 0) / before.length
      : 0;
  const meanAfter =
    after.length > 0
      ? after.reduce((s, c) => s + Math.abs(c.smd), 0) / after.length
      : 0;
  if (meanBefore === 0) return 0;
  return Math.round(((meanBefore - meanAfter) / meanBefore) * 100);
}
```

- [ ] **Step 2: Wire PSM into workspace handleRunStep**

In `PatientSimilarityWorkspace.tsx`, update `handleRunStep` to handle the 'psm' step:

```typescript
// Add import at top:
import { usePropensityMatch } from '../hooks/usePatientSimilarity';
import type { PropensityMatchResult } from '../types/patientSimilarity';

// Add mutation in component:
const psmMutation = usePropensityMatch();

// Update handleRunStep for 'psm':
const handleRunStep = useCallback(
  (stepId: string) => {
    if (stepId === 'psm' && sourceId && targetCohortId && comparatorCohortId) {
      pipeline.markLoading('psm');
      const start = Date.now();
      psmMutation.mutate(
        {
          source_cohort_definition_id: targetCohortId,
          target_cohort_definition_id: comparatorCohortId,
          source_id: sourceId,
        },
        {
          onSuccess: (data: PropensityMatchResult) => {
            pipeline.markCompleted('psm', {
              data,
              summary: `AUC ${data.model_metrics.auc.toFixed(2)} · ${data.matched_pairs.length} matched pairs`,
              executionTimeMs: Date.now() - start,
              completedAt: new Date(),
            });
          },
          onError: () => pipeline.markError('psm'),
        },
      );
    }
  },
  [sourceId, targetCohortId, comparatorCohortId, pipeline, psmMutation],
);

// Add to renderStepContent switch:
case 'psm':
  return (
    <PsmPanel
      result={result.data as PropensityMatchResult}
      onExportMatched={() => { /* TODO: open CohortExportDialog */ }}
      onContinue={() => handleRunStep('landscape')}
    />
  );
```

- [ ] **Step 3: TypeScript + build check**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx vite build"`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/patient-similarity/components/PsmPanel.tsx frontend/src/features/patient-similarity/pages/PatientSimilarityWorkspace.tsx
git commit -m "feat: add PsmPanel with metrics, preference score, Love plot, and wire into pipeline"
```

---

## Task 8: LandscapePanel (Step 4)

**Files:**
- Create: `frontend/src/features/patient-similarity/components/LandscapePanel.tsx`
- Reference: `frontend/src/features/patient-similarity/components/PatientLandscape.tsx`

- [ ] **Step 1: Implement LandscapePanel**

```typescript
// frontend/src/features/patient-similarity/components/LandscapePanel.tsx

import type { LandscapeResult } from '../types/patientSimilarity';
import { PatientLandscape } from './PatientLandscape';

interface LandscapePanelProps {
  result: LandscapeResult;
  onContinue: () => void;
}

export function LandscapePanel({ result, onContinue }: LandscapePanelProps) {
  return (
    <div>
      <PatientLandscape
        points={result.points}
        clusters={result.clusters}
        stats={result.stats}
      />

      {/* Action bar */}
      <div className="mt-3 flex items-center justify-between border-t border-[#222] pt-3">
        <div className="flex gap-2">
          <button
            className="rounded border border-[#333] px-3 py-1.5 text-[10px] text-[#777] transition-colors hover:border-[#555]"
            type="button"
          >
            Export Screenshot
          </button>
          <button
            className="rounded border border-[#333] px-3 py-1.5 text-[10px] text-[#777] transition-colors hover:border-[#555]"
            type="button"
          >
            Select Cluster → New Cohort
          </button>
        </div>
        <button
          onClick={onContinue}
          className="rounded-md border border-[#2DD4BF40] bg-[#2DD4BF20] px-3 py-1.5 text-[10px] text-[#2DD4BF] transition-colors hover:bg-[#2DD4BF30]"
          type="button"
        >
          Continue to Phenotype Discovery →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire landscape into workspace handleRunStep**

In `PatientSimilarityWorkspace.tsx`, add the landscape mutation and step handling — similar to PSM wiring. Import `projectPatientLandscape` from the API and add the mutation call in `handleRunStep` for `stepId === 'landscape'`.

- [ ] **Step 3: TypeScript + build check**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx vite build"`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/patient-similarity/components/LandscapePanel.tsx frontend/src/features/patient-similarity/pages/PatientSimilarityWorkspace.tsx
git commit -m "feat: add LandscapePanel wrapping PatientLandscape 3D viewer, wire into pipeline"
```

---

## Task 9: SettingsDrawer

**Files:**
- Create: `frontend/src/features/patient-similarity/components/SettingsDrawer.tsx`
- Reference: `frontend/src/components/ui/Drawer.tsx` — existing drawer component

- [ ] **Step 1: Implement SettingsDrawer**

```typescript
// frontend/src/features/patient-similarity/components/SettingsDrawer.tsx

import { useState, useEffect } from 'react';
import { Drawer } from '@/components/ui/Drawer';
import { useSimilarityDimensions } from '../hooks/usePatientSimilarity';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  weights: Record<string, number>;
  onWeightsChange: (weights: Record<string, number>) => void;
  ageMin: number;
  ageMax: number;
  onAgeMinChange: (v: number) => void;
  onAgeMaxChange: (v: number) => void;
  gender: string;
  onGenderChange: (v: string) => void;
  onApply: () => void;
}

function getSliderColor(value: number): string {
  if (value === 0) return 'bg-[#555]';
  if (value > 2.5) return 'bg-[#C9A227]';
  return 'bg-[#2DD4BF]';
}

export function SettingsDrawer({
  open,
  onClose,
  weights,
  onWeightsChange,
  ageMin,
  ageMax,
  onAgeMinChange,
  onAgeMaxChange,
  gender,
  onGenderChange,
  onApply,
}: SettingsDrawerProps) {
  const { data: dimensions } = useSimilarityDimensions();
  const [localWeights, setLocalWeights] = useState(weights);

  useEffect(() => {
    setLocalWeights(weights);
  }, [weights]);

  const handleWeightChange = (key: string, value: number) => {
    setLocalWeights((prev) => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    onWeightsChange(localWeights);
    onApply();
    onClose();
  };

  const handleReset = () => {
    if (dimensions) {
      const defaults: Record<string, number> = {};
      dimensions.forEach((d) => {
        defaults[d.key] = d.default_weight;
      });
      setLocalWeights(defaults);
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title="Analysis Settings" size="md">
      <div className="space-y-6">
        {/* Dimension Weights */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-[1.5px] text-[#C9A227]">
              Dimension Weights
            </div>
            <button
              onClick={handleReset}
              className="rounded border border-[#333] px-2 py-0.5 text-[9px] text-[#555] hover:text-[#888]"
              type="button"
            >
              Reset defaults
            </button>
          </div>
          <p className="mb-3 text-[10px] text-[#666]">
            Control how much each clinical dimension contributes to similarity scoring.
            Set to 0 to exclude a dimension entirely.
          </p>
          {dimensions?.map((dim) => (
            <div key={dim.key} className="mb-2.5">
              <div className="mb-1 flex justify-between">
                <span className="text-[11px] text-[#ccc]">{dim.label}</span>
                <span
                  className={`text-[11px] font-medium ${
                    (localWeights[dim.key] ?? 0) === 0
                      ? 'text-[#555]'
                      : (localWeights[dim.key] ?? 0) > 2.5
                        ? 'text-[#C9A227]'
                        : 'text-[#2DD4BF]'
                  }`}
                >
                  {(localWeights[dim.key] ?? 0).toFixed(1)}
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={5}
                step={0.5}
                value={localWeights[dim.key] ?? 0}
                onChange={(e) => handleWeightChange(dim.key, Number(e.target.value))}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-[#222]"
              />
            </div>
          ))}
        </div>

        <div className="border-t border-[#222]" />

        {/* Demographic Filters */}
        <div>
          <div className="mb-3 text-[10px] uppercase tracking-[1.5px] text-[#C9A227]">
            Demographic Filters
          </div>
          <div className="mb-3">
            <div className="mb-1 text-[10px] text-[#888]">Age Range</div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={ageMin}
                onChange={(e) => onAgeMinChange(Number(e.target.value))}
                className="w-[60px] rounded border border-[#333] bg-[#1a1a1f] px-2 py-1 text-center text-[11px] text-[#ccc]"
              />
              <span className="text-[10px] text-[#555]">to</span>
              <input
                type="number"
                value={ageMax}
                onChange={(e) => onAgeMaxChange(Number(e.target.value))}
                className="w-[60px] rounded border border-[#333] bg-[#1a1a1f] px-2 py-1 text-center text-[11px] text-[#ccc]"
              />
            </div>
          </div>
          <div>
            <div className="mb-1 text-[10px] text-[#888]">Gender</div>
            <select
              value={gender}
              onChange={(e) => onGenderChange(e.target.value)}
              className="w-full rounded-md border border-[#333] bg-[#1a1a1f] px-2.5 py-1.5 text-[11px] text-[#ccc]"
            >
              <option value="">All</option>
              <option value="8507">Male</option>
              <option value="8532">Female</option>
            </select>
          </div>
        </div>

        {/* Apply */}
        <button
          onClick={handleApply}
          className="w-full rounded-md bg-[#9B1B30] px-4 py-2.5 text-xs font-semibold text-white transition-colors hover:bg-[#B02040]"
          type="button"
        >
          Apply & Re-run Pipeline
        </button>
      </div>
    </Drawer>
  );
}
```

- [ ] **Step 2: Wire SettingsDrawer into workspace**

In `PatientSimilarityWorkspace.tsx`, add state for weights, age, gender. Import and render `SettingsDrawer` with `settingsOpen` state. Pass `onApply` that calls `handleCompare`.

- [ ] **Step 3: TypeScript + build check**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx vite build"`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/patient-similarity/components/SettingsDrawer.tsx frontend/src/features/patient-similarity/pages/PatientSimilarityWorkspace.tsx
git commit -m "feat: add SettingsDrawer with dimension weights, demographic filters, and apply action"
```

---

## Task 10: HeadToHeadDrawer

**Files:**
- Create: `frontend/src/features/patient-similarity/components/HeadToHeadDrawer.tsx`
- Reference: `frontend/src/components/ui/Drawer.tsx`
- Reference: `frontend/src/features/patient-similarity/components/TrajectoryComparison.tsx`
- Reference: `frontend/src/features/patient-similarity/components/DimensionScoreBar.tsx`

- [ ] **Step 1: Implement HeadToHeadDrawer**

```typescript
// frontend/src/features/patient-similarity/components/HeadToHeadDrawer.tsx

import { Drawer } from '@/components/ui/Drawer';
import { useComparePatients } from '../hooks/usePatientSimilarity';
import { TrajectoryComparison } from './TrajectoryComparison';
import { DimensionScoreBar } from './DimensionScoreBar';

interface HeadToHeadDrawerProps {
  open: boolean;
  onClose: () => void;
  personAId: number | null;
  personBId: number | null;
  sourceId: number;
}

export function HeadToHeadDrawer({
  open,
  onClose,
  personAId,
  personBId,
  sourceId,
}: HeadToHeadDrawerProps) {
  const { data: comparison, isLoading } = useComparePatients(
    personAId ?? 0,
    personBId ?? 0,
    sourceId,
  );

  if (!personAId || !personBId) return null;

  return (
    <Drawer open={open} onClose={onClose} title="Patient Comparison" size="xl">
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#333] border-t-[#2DD4BF]" />
        </div>
      ) : comparison ? (
        <div className="space-y-4">
          {/* Patient cards */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-0">
            <div className="rounded-lg border border-[#9B1B3040] bg-[#0e0e11] p-3">
              <div className="text-[9px] uppercase tracking-wider text-[#9B1B30]">Patient A</div>
              <div className="text-base font-semibold text-[#ddd]">#{personAId}</div>
              <div className="mt-1 text-[11px] text-[#888]">
                {comparison.patient_a?.gender}, {comparison.patient_a?.age}
              </div>
            </div>
            <div className="flex items-center px-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#C9A22740] bg-[#C9A22720]">
                <span className="text-[10px] font-bold text-[#C9A227]">vs</span>
              </div>
            </div>
            <div className="rounded-lg border border-[#2DD4BF40] bg-[#0e0e11] p-3">
              <div className="text-[9px] uppercase tracking-wider text-[#2DD4BF]">Patient B</div>
              <div className="text-base font-semibold text-[#ddd]">#{personBId}</div>
              <div className="mt-1 text-[11px] text-[#888]">
                {comparison.patient_b?.gender}, {comparison.patient_b?.age}
              </div>
            </div>
          </div>

          {/* Overall score */}
          <div className="flex items-center gap-4 rounded-lg bg-[#0e0e11] px-4 py-3">
            <div>
              <div className="text-[9px] uppercase tracking-wider text-[#555]">
                Overall Similarity
              </div>
              <div className="text-[28px] font-bold text-[#C9A227]">
                {comparison.overall_score?.toFixed(2)}
              </div>
            </div>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-[#222]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#2DD4BF] to-[#C9A227]"
                style={{ width: `${(comparison.overall_score ?? 0) * 100}%` }}
              />
            </div>
          </div>

          {/* Dimension scores */}
          {comparison.dimension_scores && (
            <div className="rounded-lg bg-[#0e0e11] p-3">
              <div className="mb-2 text-[10px] uppercase tracking-wider text-[#777]">
                Dimension Scores
              </div>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(comparison.dimension_scores).map(([key, score]) => (
                  <DimensionScoreBar key={key} label={key} score={score as number} />
                ))}
              </div>
            </div>
          )}

          {/* Trajectory comparison */}
          <div className="rounded-lg bg-[#0e0e11] p-3">
            <div className="mb-2 text-[10px] uppercase tracking-wider text-[#777]">
              Temporal Trajectory
            </div>
            <TrajectoryComparison
              sourceId={sourceId}
              personAId={personAId}
              personBId={personBId}
            />
          </div>

          {/* Links to profiles */}
          <div className="flex gap-2">
            <a
              href={`/patient-profiles/${personAId}?source_id=${sourceId}`}
              className="flex-1 rounded border border-[#333] px-3 py-1.5 text-center text-[10px] text-[#777] transition-colors hover:border-[#555]"
            >
              View Patient A Profile ↗
            </a>
            <a
              href={`/patient-profiles/${personBId}?source_id=${sourceId}`}
              className="flex-1 rounded border border-[#333] px-3 py-1.5 text-center text-[10px] text-[#777] transition-colors hover:border-[#555]"
            >
              View Patient B Profile ↗
            </a>
          </div>
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center text-xs text-[#555]">
          No comparison data available
        </div>
      )}
    </Drawer>
  );
}
```

- [ ] **Step 2: Wire into workspace**

In `PatientSimilarityWorkspace.tsx`, add state for `h2hPersonA`, `h2hPersonB`, `h2hOpen`. Render `HeadToHeadDrawer` at the bottom of the component.

- [ ] **Step 3: TypeScript + build check**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx vite build"`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/patient-similarity/components/HeadToHeadDrawer.tsx frontend/src/features/patient-similarity/pages/PatientSimilarityWorkspace.tsx
git commit -m "feat: add HeadToHeadDrawer with patient comparison, dimension scores, and trajectory"
```

---

## Task 11: Expand Mode Panels

**Files:**
- Create: `frontend/src/features/patient-similarity/components/CentroidProfilePanel.tsx`
- Create: `frontend/src/features/patient-similarity/components/SimilarPatientsPanel.tsx`

- [ ] **Step 1: Implement CentroidProfilePanel**

```typescript
// frontend/src/features/patient-similarity/components/CentroidProfilePanel.tsx

import type { CohortProfileResult } from '../types/patientSimilarity';
import { CohortCentroidRadar } from './CohortCentroidRadar';

interface CentroidProfilePanelProps {
  profile: CohortProfileResult;
  onContinue: () => void;
}

export function CentroidProfilePanel({ profile, onContinue }: CentroidProfilePanelProps) {
  return (
    <div>
      <CohortCentroidRadar profile={profile} />
      <div className="mt-3 flex items-center justify-end border-t border-[#222] pt-3">
        <button
          onClick={onContinue}
          className="rounded-md border border-[#2DD4BF40] bg-[#2DD4BF20] px-3 py-1.5 text-[10px] text-[#2DD4BF]"
          type="button"
        >
          View Similar Patients →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement SimilarPatientsPanel**

```typescript
// frontend/src/features/patient-similarity/components/SimilarPatientsPanel.tsx

import { useState } from 'react';
import type { SimilaritySearchResult } from '../types/patientSimilarity';
import { SimilarPatientTable } from './SimilarPatientTable';
import { CohortExportDialog } from './CohortExportDialog';

interface SimilarPatientsPanelProps {
  result: SimilaritySearchResult;
  sourceId: number;
  onContinue: () => void;
}

export function SimilarPatientsPanel({ result, sourceId, onContinue }: SimilarPatientsPanelProps) {
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <div>
      <SimilarPatientTable
        patients={result.similar_patients}
        showPersonId={true}
        seedPersonId={undefined}
        sourceId={sourceId}
      />

      {/* Action bar */}
      <div className="mt-3 flex items-center justify-between border-t border-[#222] pt-3">
        <div className="flex gap-2">
          <button
            onClick={() => setExportOpen(true)}
            className="rounded border border-[#333] px-3 py-1.5 text-[10px] text-[#777] hover:border-[#555]"
            type="button"
          >
            Export as New Cohort
          </button>
        </div>
        <button
          onClick={onContinue}
          className="rounded-md border border-[#2DD4BF40] bg-[#2DD4BF20] px-3 py-1.5 text-[10px] text-[#2DD4BF]"
          type="button"
        >
          Continue to Landscape →
        </button>
      </div>

      {result.metadata?.cache_id && (
        <CohortExportDialog
          isOpen={exportOpen}
          onClose={() => setExportOpen(false)}
          cacheId={result.metadata.cache_id}
          patients={result.similar_patients}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Wire expand mode into workspace**

In `PatientSimilarityWorkspace.tsx`, add the expand mode flow in `handleCompare` (when `pipeline.mode === 'expand'`). Use `useCohortProfile` for step 1 and `useCohortSimilaritySearch` for step 2. Add the expand-mode cases to `renderStepContent`.

- [ ] **Step 4: TypeScript + build check**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit && npx vite build"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/patient-similarity/components/CentroidProfilePanel.tsx frontend/src/features/patient-similarity/components/SimilarPatientsPanel.tsx frontend/src/features/patient-similarity/pages/PatientSimilarityWorkspace.tsx
git commit -m "feat: add expand mode panels (CentroidProfile + SimilarPatients) and wire into pipeline"
```

---

## Task 12: Final Integration and Cleanup

**Files:**
- Modify: `frontend/src/features/patient-similarity/pages/__tests__/PatientSimilarityWorkspace.test.tsx`
- Modify: `frontend/src/features/patient-similarity/pages/__tests__/PatientSimilarityPage.test.tsx`

- [ ] **Step 1: Update old page tests**

The old `PatientSimilarityPage.test.tsx` tests the deprecated page. Either delete them or adapt to test the old page in isolation (it's still importable, just not routed). Since the old page is preserved but not routed, delete the test file:

```bash
rm frontend/src/features/patient-similarity/pages/__tests__/PatientSimilarityPage.test.tsx
```

- [ ] **Step 2: Run full test suite**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vitest run src/features/patient-similarity/`
Expected: All new tests PASS, no orphaned imports

- [ ] **Step 3: Run ESLint on changed files**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx eslint src/features/patient-similarity/pages/PatientSimilarityWorkspace.tsx src/features/patient-similarity/components/CohortSelectorBar.tsx src/features/patient-similarity/components/PipelineStep.tsx src/features/patient-similarity/components/AnalysisPipeline.tsx --fix`
Expected: Clean or auto-fixed

- [ ] **Step 4: Full TypeScript check**

Run: `docker compose exec node sh -c "cd /app && npx tsc --noEmit"`
Expected: PASS

- [ ] **Step 5: Full Vite build**

Run: `docker compose exec node sh -c "cd /app && npx vite build"`
Expected: PASS (vite build is stricter)

- [ ] **Step 6: Deploy frontend**

Run: `./deploy.sh --frontend`
Expected: Build succeeds, frontend served at production URL

- [ ] **Step 7: Commit**

```bash
git add -A frontend/src/features/patient-similarity/
git commit -m "chore: clean up tests and finalize patient similarity workspace integration"
```

---

## Summary

| Task | Component | Est. Time |
|------|-----------|----------|
| 1 | Pipeline types + usePipeline hook | Foundation |
| 2 | PipelineStep (collapsible panel wrapper) | Core UI |
| 3 | CohortSelectorBar (top bar) | Core UI |
| 4 | ProfileComparisonPanel (Step 1) | Panel |
| 5 | CovariateBalancePanel (Step 2) | Panel |
| 6 | AnalysisPipeline + Workspace + Route swap | Integration |
| 7 | PsmPanel (Step 3) | Panel |
| 8 | LandscapePanel (Step 4) | Panel |
| 9 | SettingsDrawer | Overlay |
| 10 | HeadToHeadDrawer | Overlay |
| 11 | Expand mode panels | Panels |
| 12 | Final integration + cleanup | Polish |

**Phase 3 panels** (PhenotypeDiscoveryPanel, NetworkFusionPanel) are designed in the spec but not included in this plan — they will be implemented when the Python service endpoints are integrated in Phase 3. The pipeline already shows them as "future" steps with "Run ▸" buttons.
