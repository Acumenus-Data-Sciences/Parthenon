# Cohort Wizard Modal Conversion — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Cohort Wizard from a full-page route (`/cohort-definitions/new`) to a modal overlay launched from the Cohort Definitions list page, matching the established AddSourceWizard/SetupWizard pattern, and fix all design system color drift across the 20 wizard component files.

**Architecture:** The wizard becomes a `max-w-3xl` modal overlay with 6 horizontal step indicators (one per former "chapter"), direction-aware slide animations (220ms), and a `border-t` footer with Back/Next buttons. The 14 sub-step screens collapse into 6 scrollable step views where former sub-steps render as stacked sections. The Zustand store simplifies from dual `currentChapter`/`currentStep` navigation to a single `currentStep: 0-5` index. All off-palette colors are corrected to the design system palette.

**Tech Stack:** React 19, TypeScript strict, Zustand, TanStack Query, Tailwind 4, lucide-react

**Reference files (read these before starting):**
- `frontend/src/features/data-sources/components/AddSourceWizard.tsx` — canonical modal wizard pattern
- `frontend/src/features/auth/components/SetupWizard.tsx` — slide animation + step indicator
- `docs/devlog/modules/ux/patient-similarity-design-system-alignment.md` — color palette reference

---

## Color Palette Reference

Every hex color in wizard files must match this palette. No exceptions.

```
Surfaces:  #0E0E11 (base/inset), #151518 (raised), #1C1C20 (overlay), #232328 (elevated)
Borders:   #2A2A30 (default), #323238 (subtle)
Text:      #F0EDE8 (primary), #C5C0B8 (secondary), #8A857D (muted), #5A5650 (ghost)
Accents:   #9B1B30 (crimson), #2DD4BF (teal), #C9A227 (gold), #E85A6B (error)
Focus:     focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/15
```

**Color replacement map** (apply globally across all wizard files):

| Off-Palette | Replacement | Context |
|---|---|---|
| `#12121a` | `#151518` | Card/panel backgrounds |
| `#2a2a3a` | `#2A2A30` | Borders |
| `#1a1a2e` | `#1C1C20` | Overlay/nested backgrounds |
| `#333` | `#2A2A30` | Borders |
| `#444` | `#323238` | Subtle borders, input borders |
| `#555` | `#5A5650` | Ghost text |
| `#666` | `#5A5650` | Ghost text, labels |
| `#888` | `#8A857D` | Muted text |
| `#999` | `#8A857D` | Muted text |
| `#ccc` | `#C5C0B8` | Secondary text |
| `#222` | `#2A2A30` | Borders |
| `border-[#555]` (hover) | `border-[#3A3A42]` | Hover borders |
| `hover:text-[#ccc]` | `hover:text-[#C5C0B8]` | Hover text |

**Unicode symbols to replace with lucide-react icons:**

| Symbol | Replacement |
|---|---|
| `&#x270F;` (pencil) | `<Pencil size={12} />` from lucide-react |
| `&#x2715;` (X mark) | `<X size={12} />` from lucide-react |
| `▸` / `▾` (triangles) | `<ChevronRight size={12} />` / `<ChevronDown size={12} />` |
| `💡` (lightbulb emoji) | `<Lightbulb size={14} className="text-[#C9A227]" />` |

---

## File Structure

### New files
| File | Responsibility |
|---|---|
| `frontend/src/features/cohort-definitions/components/wizard/CohortWizardModal.tsx` | Modal shell: backdrop, step indicator, slide animation, footer nav, step routing |
| `frontend/src/features/cohort-definitions/components/wizard/steps/PopulationStep.tsx` | Consolidated step 2: stacks EntryEventsStep + ObservationWindowStep + QualifyingEventsStep as labeled sections |
| `frontend/src/features/cohort-definitions/components/wizard/steps/CriteriaStep.tsx` | Consolidated step 3: stacks InclusionRulesStep + DemographicsStep + RiskScoresStep as sections |
| `frontend/src/features/cohort-definitions/components/wizard/steps/FollowUpStep.tsx` | Consolidated step 4: stacks EndStrategyStep + CensoringStep as labeled sections |
| `frontend/src/features/cohort-definitions/components/wizard/steps/ReviewGenerateStep.tsx` | Consolidated step 6: CohortSummary + source select + generate + handoff links |

### Files to delete
| File | Reason |
|---|---|
| `frontend/src/features/cohort-definitions/pages/CohortWizardPage.tsx` | Route-based page wrapper — replaced by modal invocation |
| `frontend/src/features/cohort-definitions/components/wizard/CohortWizard.tsx` | Old two-column layout shell — replaced by CohortWizardModal |
| `frontend/src/features/cohort-definitions/components/wizard/WizardSidebar.tsx` | Vertical sidebar — replaced by horizontal StepIndicator |

### Files to modify
| File | Change |
|---|---|
| `frontend/src/features/cohort-definitions/stores/cohortWizardStore.ts` | Simplify navigation to single `currentStep: 0-5`, add `canProceed()`, remove chapter/step dual tracking |
| `frontend/src/features/cohort-definitions/pages/CohortDefinitionsPage.tsx` | Replace `navigate("/cohort-definitions/new")` with local `wizardOpen` state + render `CohortWizardModal` |
| `frontend/src/app/router.tsx` | Remove the `/cohort-definitions/new` route |
| All 13 existing step/chapter/helper components | Fix off-palette colors per the color map above, replace unicode with lucide-react icons, remove "Step N of M" headers (parent section labels replace these) |

---

### Task 1: Simplify the Zustand Store Navigation

**Files:**
- Modify: `frontend/src/features/cohort-definitions/stores/cohortWizardStore.ts`

The store currently uses `currentChapter` (1-6) + `currentStep` (1-N) with a `CHAPTER_STEPS` map. Replace with a single `currentStep` (0-5) index.

- [ ] **Step 1: Read the current store**

Read `frontend/src/features/cohort-definitions/stores/cohortWizardStore.ts` to confirm current state before editing.

- [ ] **Step 2: Replace navigation state and actions**

Replace the following in the store interface:

```typescript
// OLD — remove these
currentChapter: number;
currentStep: number;
setChapter: (chapter: number) => void;
setStep: (step: number) => void;

// NEW — add these
currentStep: number;      // 0-5 (was currentChapter 1-6)
slideDir: "forward" | "back";
setStep: (step: number) => void;
```

Remove `CHAPTER_STEPS` constant entirely.

Replace the `goNext` implementation:

```typescript
goNext: () => {
  const { currentStep } = get();
  if (currentStep < 5) {
    set({ currentStep: currentStep + 1, slideDir: "forward" });
  }
},
```

Replace the `goBack` implementation:

```typescript
goBack: () => {
  const { currentStep } = get();
  if (currentStep > 0) {
    set({ currentStep: currentStep - 1, slideDir: "back" });
  }
},
```

Replace `setChapter`:

```typescript
setStep: (step: number) => {
  const { currentStep } = get();
  set({ currentStep: step, slideDir: step > currentStep ? "forward" : "back" });
},
```

- [ ] **Step 3: Update initialState**

Replace `currentChapter: 1, currentStep: 1` with:

```typescript
currentStep: 0,
slideDir: "forward" as const,
```

- [ ] **Step 4: Add canProceed() validation**

Add a `canProceed` method to the store (matching AddSourceWizard's pattern):

```typescript
canProceed: () => {
  const s = get();
  switch (s.currentStep) {
    case 0: return s.name.trim() !== "";                          // Basics: name required
    case 1: return s.entryConcepts.length > 0;                    // Population: at least one entry event
    case 2: return true;                                          // Criteria: all optional
    case 3: return true;                                          // Follow-up: defaults are valid
    case 4: return true;                                          // Specialized: optional
    case 5: return true;                                          // Review: always reachable
    default: return false;
  }
},
```

- [ ] **Step 5: Update getChapterStatus to use step indices**

Renumber `getChapterStatus` to accept 0-5 instead of 1-6. The logic stays the same, just shift all case numbers down by 1.

```typescript
getChapterStatus: (step: number) => {
  const s = get();
  switch (step) {
    case 0: return s.name ? "complete" : "pending";
    case 1: return s.entryConcepts.length > 0 ? "complete" : "pending";
    case 2: return (s.inclusionRules.length > 0 || s.demographics || s.riskScores.length > 0) ? "complete" : "pending";
    case 3: return "complete";
    case 4: return "complete";
    case 5: return "pending";
    default: return "pending";
  }
},
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit 2>&1 | head -30`

Expected: Errors in files that reference `currentChapter` — this is correct, those files will be updated in subsequent tasks. The store itself should have no type errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/cohort-definitions/stores/cohortWizardStore.ts
git commit -m "refactor: simplify cohort wizard store to single-step navigation"
```

---

### Task 2: Create the CohortWizardModal Shell

**Files:**
- Create: `frontend/src/features/cohort-definitions/components/wizard/CohortWizardModal.tsx`

This is the modal overlay that replaces `CohortWizard.tsx`. It follows the AddSourceWizard pattern exactly: backdrop → step indicator → scrollable content → footer nav.

- [ ] **Step 1: Create CohortWizardModal.tsx**

```tsx
import { useState } from "react";
import { Check, X, ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { BasicsChapter } from "./BasicsChapter";
import { PopulationStep } from "./steps/PopulationStep";
import { CriteriaStep } from "./steps/CriteriaStep";
import { FollowUpStep } from "./steps/FollowUpStep";
import { SpecializedChapter } from "./SpecializedChapter";
import { ReviewGenerateStep } from "./steps/ReviewGenerateStep";

const STEPS = [
  { key: "basics", label: "Basics" },
  { key: "population", label: "Population" },
  { key: "criteria", label: "Criteria" },
  { key: "followup", label: "Follow-up" },
  { key: "specialized", label: "Specialized" },
  { key: "review", label: "Review" },
] as const;

interface Props {
  onClose: () => void;
}

function StepIndicator({ currentStep }: { currentStep: number }) {
  return (
    <div className="flex items-center justify-between px-8 pb-2 pt-6">
      {STEPS.map((s, index) => {
        const isCompleted = index < currentStep;
        const isActive = index === currentStep;
        const isPending = index > currentStep;
        const isLast = index === STEPS.length - 1;

        return (
          <div key={s.key} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all",
                  isCompleted && "bg-[#C9A227] text-[#0E0E11]",
                  isActive && "border-2 border-[#C9A227] bg-[#C9A227]/10 text-[#C9A227]",
                  isPending && "border-2 border-[#323238] bg-transparent text-[#5A5650]",
                )}
              >
                {isCompleted ? <Check size={14} strokeWidth={3} /> : index + 1}
              </div>
              <span
                className={cn(
                  "whitespace-nowrap text-xs font-medium",
                  isCompleted && "text-[#C9A227]",
                  isActive && "text-[#F0EDE8]",
                  isPending && "text-[#5A5650]",
                )}
              >
                {s.label}
              </span>
            </div>
            {!isLast && (
              <div className="mx-2 mb-5 flex-1">
                <div className={cn("h-[2px] w-full rounded-full", isCompleted ? "bg-[#C9A227]" : "bg-[#323238]")} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function CohortWizardModal({ onClose }: Props) {
  const { currentStep, slideDir, goNext, goBack, canProceed, reset, createdId } =
    useCohortWizardStore();
  const [animKey, setAnimKey] = useState(0);

  const handleNext = () => {
    setAnimKey((k) => k + 1);
    goNext();
  };

  const handleBack = () => {
    setAnimKey((k) => k + 1);
    goBack();
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const isLastStep = currentStep === STEPS.length - 1;

  const stepContent = [
    <BasicsChapter key="basics" />,
    <PopulationStep key="population" />,
    <CriteriaStep key="criteria" />,
    <FollowUpStep key="followup" />,
    <SpecializedChapter key="specialized" />,
    <ReviewGenerateStep key="review" onClose={handleClose} />,
  ];

  return (
    <>
      <style>{`
        @keyframes cohortWizardSlideFromRight {
          from { opacity: 0; transform: translateX(18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes cohortWizardSlideFromLeft {
          from { opacity: 0; transform: translateX(-18px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>

      <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0E0E11]/90 backdrop-blur-sm">
        <div className="relative mx-4 flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl border border-[#232328] bg-[#151518] shadow-2xl">
          {/* Close button */}
          <button
            type="button"
            onClick={handleClose}
            className="absolute right-4 top-4 z-10 rounded-md p-1.5 text-[#5A5650] transition-colors hover:text-[#8A857D]"
          >
            <X size={18} />
          </button>

          {/* Step indicator */}
          <StepIndicator currentStep={currentStep} />

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-8 py-4">
            <div
              key={animKey}
              style={{
                animation: `${slideDir === "forward" ? "cohortWizardSlideFromRight" : "cohortWizardSlideFromLeft"} 220ms ease forwards`,
              }}
            >
              {stepContent[currentStep]}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-[#232328] px-8 py-4">
            <button
              type="button"
              onClick={handleBack}
              disabled={currentStep === 0}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
                currentStep === 0
                  ? "cursor-not-allowed text-[#323238]"
                  : "text-[#8A857D] hover:text-[#C5C0B8]",
              )}
            >
              <ArrowLeft size={14} />
              Back
            </button>

            {!isLastStep && (
              <button
                type="button"
                onClick={handleNext}
                disabled={!canProceed()}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors",
                  canProceed()
                    ? "bg-[#C9A227] text-[#0E0E11] hover:bg-[#D4AF37]"
                    : "cursor-not-allowed bg-[#232328] text-[#5A5650]",
                )}
              >
                Next
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
```

- [ ] **Step 2: Create the `steps/` directory**

Run: `ls frontend/src/features/cohort-definitions/components/wizard/` to confirm directory exists, then proceed. The `steps/` subdirectory will be created by writing files into it.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/cohort-definitions/components/wizard/CohortWizardModal.tsx
git commit -m "feat: add CohortWizardModal shell with step indicator and slide animation"
```

---

### Task 3: Create Consolidated Step Components

**Files:**
- Create: `frontend/src/features/cohort-definitions/components/wizard/steps/PopulationStep.tsx`
- Create: `frontend/src/features/cohort-definitions/components/wizard/steps/CriteriaStep.tsx`
- Create: `frontend/src/features/cohort-definitions/components/wizard/steps/FollowUpStep.tsx`
- Create: `frontend/src/features/cohort-definitions/components/wizard/steps/ReviewGenerateStep.tsx`

Each consolidated step stacks its former sub-steps as labeled sections separated by `border-b border-[#2A2A30]` dividers. Section headers replace the old "Step N of M" labels.

- [ ] **Step 1: Create PopulationStep.tsx**

This stacks EntryEventsStep + ObservationWindowStep + QualifyingEventsStep with section headers.

```tsx
import { EntryEventsStep } from "../EntryEventsStep";
import { ObservationWindowStep } from "../ObservationWindowStep";
import { QualifyingEventsStep } from "../QualifyingEventsStep";

export function PopulationStep() {
  return (
    <div className="flex flex-col gap-0">
      <div className="pb-5">
        <EntryEventsStep />
      </div>
      <div className="border-t border-[#2A2A30] pb-5 pt-5">
        <ObservationWindowStep />
      </div>
      <div className="border-t border-[#2A2A30] pt-5">
        <QualifyingEventsStep />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create CriteriaStep.tsx**

```tsx
import { InclusionRulesStep } from "../InclusionRulesStep";
import { DemographicsStep } from "../DemographicsStep";
import { RiskScoresStep } from "../RiskScoresStep";

export function CriteriaStep() {
  return (
    <div className="flex flex-col gap-0">
      <div className="pb-5">
        <InclusionRulesStep />
      </div>
      <div className="border-t border-[#2A2A30] pb-5 pt-5">
        <DemographicsStep />
      </div>
      <div className="border-t border-[#2A2A30] pt-5">
        <RiskScoresStep />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create FollowUpStep.tsx**

```tsx
import { EndStrategyStep } from "../EndStrategyStep";
import { CensoringStep } from "../CensoringStep";

export function FollowUpStep() {
  return (
    <div className="flex flex-col gap-0">
      <div className="pb-5">
        <EndStrategyStep />
      </div>
      <div className="border-t border-[#2A2A30] pt-5">
        <CensoringStep />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create ReviewGenerateStep.tsx**

This combines ReviewStep's summary + GenerateStep's source/generate + HandoffStep's links into one scrollable view.

```tsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Wrench, BarChart3, Loader2, Pencil } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCohortWizardStore } from "../../../stores/cohortWizardStore";
import { useCreateCohortDefinition, useGenerateCohort } from "../../../hooks/useCohortDefinitions";
import { useCohortGeneration } from "../../../hooks/useCohortGeneration";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import { CohortSummary } from "../CohortSummary";
import type { Source } from "@/types/models";

interface Props {
  onClose: () => void;
}

export function ReviewGenerateStep({ onClose }: Props) {
  const navigate = useNavigate();
  const store = useCohortWizardStore();
  const createdId = store.createdId;
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [genId, setGenId] = useState<number | null>(null);

  const { data: sources, isLoading: loadingSources } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const createMutation = useCreateCohortDefinition();
  const generateMutation = useGenerateCohort();
  const { data: generation } = useCohortGeneration(createdId, genId);

  const errors: string[] = [];
  if (!store.name) errors.push("Cohort name is required (go back to Basics)");
  if (store.entryConcepts.length === 0) errors.push("At least one entry event is required (go back to Population)");

  const handleGenerate = () => {
    if (!sourceId) return;

    let expression;
    try {
      expression = store.buildExpression();
    } catch (err) {
      console.error("Failed to build expression:", err);
      return;
    }

    createMutation.mutate(
      {
        name: store.name,
        description: store.description,
        expression_json: expression,
      },
      {
        onSuccess: (def) => {
          store.setCreatedId(def.id);
          generateMutation.mutate(
            { defId: def.id, sourceId },
            {
              onSuccess: (gen) => setGenId(gen.id),
            },
          );
        },
      },
    );
  };

  const generationStatus = generation?.status;
  const isRunning =
    createMutation.isPending ||
    generateMutation.isPending ||
    generationStatus === "running" ||
    generationStatus === "queued" ||
    generationStatus === "pending";

  const isDisabled = !sourceId || isRunning || errors.length > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Section: Summary */}
      <div>
        <div className="mb-2 text-[13px] font-medium text-[#C5C0B8]">Cohort Summary</div>
        <CohortSummary />
      </div>

      {/* Edit shortcuts */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => store.setStep(1)}
          className="inline-flex items-center gap-1 rounded border border-[#2A2A30] px-2.5 py-1 text-[11px] text-[#8A857D] hover:border-[#3A3A42] hover:text-[#C5C0B8]"
        >
          <Pencil size={10} />
          Edit Population
        </button>
        <button
          type="button"
          onClick={() => store.setStep(2)}
          className="inline-flex items-center gap-1 rounded border border-[#2A2A30] px-2.5 py-1 text-[11px] text-[#8A857D] hover:border-[#3A3A42] hover:text-[#C5C0B8]"
        >
          <Pencil size={10} />
          Edit Criteria
        </button>
        <button
          type="button"
          onClick={() => store.setStep(3)}
          className="inline-flex items-center gap-1 rounded border border-[#2A2A30] px-2.5 py-1 text-[11px] text-[#8A857D] hover:border-[#3A3A42] hover:text-[#C5C0B8]"
        >
          <Pencil size={10} />
          Edit Follow-up
        </button>
      </div>

      {/* Validation errors */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-[rgba(155,27,48,0.3)] bg-[rgba(155,27,48,0.05)] px-4 py-3">
          <div className="mb-1 text-[12px] font-medium text-[#E85A6B]">
            Cannot generate — fix these issues:
          </div>
          <ul className="list-inside list-disc text-[12px] text-[#E85A6B]">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Section: Generate */}
      <div className="border-t border-[#2A2A30] pt-5">
        <div className="mb-3 text-[13px] font-medium text-[#C5C0B8]">Generate Cohort</div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-[#8A857D]">Run against:</span>
          <select
            value={sourceId ?? ""}
            onChange={(e) => setSourceId(e.target.value ? parseInt(e.target.value, 10) : null)}
            className="rounded-md border border-[#323238] bg-[#1C1C20] px-3 py-1.5 text-[13px] text-[#C5C0B8] outline-none focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/15"
            disabled={loadingSources}
          >
            <option value="">Select data source...</option>
            {(sources ?? []).map((s: Source) => (
              <option key={s.id} value={s.id}>
                {s.source_name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={isDisabled}
            className="flex items-center gap-1.5 rounded-md bg-[#C9A227] px-4 py-1.5 text-[13px] font-semibold text-[#0E0E11] transition-colors hover:bg-[#D4AF37] disabled:opacity-50"
          >
            {isRunning && <Loader2 size={14} className="animate-spin" />}
            Generate
          </button>
        </div>

        {/* Success */}
        {generationStatus === "completed" && (
          <div className="mt-3 rounded-lg border border-[rgba(45,212,191,0.15)] bg-[rgba(45,212,191,0.05)] p-4">
            <div className="text-center">
              <div className="text-[28px] font-bold text-[#2DD4BF]">
                {generation?.person_count?.toLocaleString() ?? 0}
              </div>
              <div className="text-[11px] text-[#8A857D]">patients</div>
            </div>
          </div>
        )}

        {/* Error */}
        {generationStatus === "failed" && (
          <div className="mt-3 rounded-lg border border-[rgba(155,27,48,0.3)] bg-[rgba(155,27,48,0.05)] px-4 py-3 text-[13px] text-[#E85A6B]">
            Generation failed. Check the expression and try again.
          </div>
        )}
      </div>

      {/* Section: What's Next */}
      {(generationStatus === "completed" || createdId) && (
        <div className="border-t border-[#2A2A30] pt-5">
          <div className="mb-3 text-[13px] font-medium text-[#C5C0B8]">What's Next?</div>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[rgba(45,212,191,0.2)] bg-[rgba(45,212,191,0.05)] p-4 text-left transition-colors hover:border-[rgba(45,212,191,0.4)]"
            >
              <div className="flex items-center gap-2 text-[13px] font-medium text-[#2DD4BF]">
                <Check size={16} />
                Done — Save & Close
              </div>
              <p className="ml-[24px] mt-1 text-[12px] text-[#8A857D]">
                Cohort is saved and ready for use in analyses and studies.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(createdId ? `/cohort-definitions/${createdId}` : "/cohort-definitions");
              }}
              className="rounded-lg border border-[rgba(201,162,39,0.2)] bg-[rgba(201,162,39,0.05)] p-4 text-left transition-colors hover:border-[rgba(201,162,39,0.4)]"
            >
              <div className="flex items-center gap-2 text-[13px] font-medium text-[#C9A227]">
                <Wrench size={16} />
                Open in Advanced Editor
              </div>
              <p className="ml-[24px] mt-1 text-[12px] text-[#8A857D]">
                Fine-tune with the full expression editor.
              </p>
            </button>

            <button
              type="button"
              onClick={() => {
                onClose();
                navigate(createdId ? `/cohort-definitions/${createdId}` : "/cohort-definitions");
              }}
              className="rounded-lg border border-[#2A2A30] bg-[#1C1C20] p-4 text-left transition-colors hover:border-[#3A3A42]"
            >
              <div className="flex items-center gap-2 text-[13px] font-medium text-[#C5C0B8]">
                <BarChart3 size={16} />
                View Diagnostics
              </div>
              <p className="ml-[24px] mt-1 text-[12px] text-[#8A857D]">
                See attrition chart, patient breakdown by age/gender, and generation statistics.
              </p>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Verify TypeScript compiles for the new files**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit 2>&1 | grep -E "steps/(Population|Criteria|FollowUp|ReviewGenerate)" | head -20`

Expected: No errors in the new step files. Errors may still exist in the old files (CohortWizard.tsx, etc.) which will be deleted in Task 5.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/cohort-definitions/components/wizard/steps/
git commit -m "feat: add consolidated step components for modal wizard"
```

---

### Task 4: Fix Design System Colors in All Existing Step Components

**Files (13 files to modify):**
- `BasicsChapter.tsx` — `#ccc` → `#C5C0B8`, `#333` → `#2A2A30`, `#555` → `#5A5650`, `#999` → `#8A857D`
- `EntryEventsStep.tsx` — `#ccc` → `#C5C0B8`, `#888` → `#8A857D`
- `ObservationWindowStep.tsx` — `#ccc` → `#C5C0B8`, `#888` → `#8A857D`, `#444` → `#323238`, `#1a1a2e` → `#1C1C20`, `#2a2a3a` → `#2A2A30`, `#999` → `#8A857D`, 💡 → Lightbulb icon
- `QualifyingEventsStep.tsx` — `#ccc` → `#C5C0B8`, `#888` → `#8A857D`, `#333` → `#2A2A30`, `#1a1a2e` → `#1C1C20`, `#555` → `#5A5650`
- `InclusionRulesStep.tsx` — `#ccc` → `#C5C0B8`, `#555` → `#5A5650`, `#888` → `#8A857D`, `#2a2a3a` → `#2A2A30`, `#333` → `#2A2A30`
- `InclusionRuleSentence.tsx` — `#ccc` → `#C5C0B8`, `#666` → `#5A5650`, `#444` → `#323238`, `#1a1a2e` → `#1C1C20`, `#2a2a3a` → `#2A2A30`, `#888` → `#8A857D`
- `DemographicsStep.tsx` — `#ccc` → `#C5C0B8`, `#555` → `#5A5650`, `#888` → `#8A857D`, `#2a2a3a` → `#2A2A30`, `#444` → `#323238`, `#1a1a2e` → `#1C1C20`
- `RiskScoresStep.tsx` — `#ccc` → `#C5C0B8`, `#555` → `#5A5650`, `#888` → `#8A857D`, `#666` → `#5A5650`, `#2a2a3a` → `#2A2A30`, `#333` → `#2A2A30`, `#444` → `#323238`, `#999` → `#8A857D`
- `EndStrategyStep.tsx` — `#ccc` → `#C5C0B8`, `#888` → `#8A857D`, `#333` → `#2A2A30`, `#1a1a2e` → `#1C1C20`, `#555` → `#5A5650`, `#444` → `#323238`
- `CensoringStep.tsx` — `#ccc` → `#C5C0B8`, `#555` → `#5A5650`, `#888` → `#8A857D`
- `SpecializedChapter.tsx` — `#ccc` → `#C5C0B8`, `#555` → `#5A5650`, `#666` → `#5A5650`, `#888` → `#8A857D`, `#333` → `#2A2A30`, `#1a1a2e` → `#1C1C20`, `#2a2a3a` → `#2A2A30`, `#444` → `#323238`, `#999` → `#8A857D`, `&#x2715;` → `<X size={12} />`
- `WizardConceptPicker.tsx` — `#555` → `#5A5650`, `#888` → `#8A857D`, `#2a2a3a` → `#2A2A30`, `#444` → `#323238`, `#999` → `#8A857D`, 💡 → Lightbulb icon
- `SelectedConceptsList.tsx` — `#222` → `#2A2A30`, `#666` → `#5A5650`, `#ccc` → `#C5C0B8`, `#888` → `#8A857D`, `#444` → `#323238`
- `TemporalPresetPicker.tsx` — `#ccc` → `#C5C0B8`, `#666` → `#5A5650`, `#2a2a3a` → `#2A2A30`, `#444` → `#323238`, `#555` → `#5A5650`, `#888` → `#8A857D`, `#1a1a2e` → `#1C1C20`
- `CohortSummary.tsx` — `#1a1a2e` → `#1C1C20`, `#ccc` → `#C5C0B8`, `#666` → `#5A5650`, `#888` → `#8A857D`

This task is a bulk find-and-replace across the wizard directory. Run these replacements in order.

- [ ] **Step 1: Remove "Step N of M" headers from sub-step components**

In each of the sub-step components (EntryEventsStep, ObservationWindowStep, QualifyingEventsStep, InclusionRulesStep, DemographicsStep, RiskScoresStep, EndStrategyStep, CensoringStep), replace the "Step N of M — Title" div with just the title. For example in `EntryEventsStep.tsx`, change:

```tsx
// OLD
<div className="mb-1 text-[13px] font-medium text-[#ccc]">
  Step 1 of 3 — Entry Events
</div>

// NEW
<div className="mb-1 text-[13px] font-medium text-[#C5C0B8]">
  Entry Events
</div>
```

Apply this pattern to all 8 sub-step files, preserving optional/required badges.

- [ ] **Step 2: Run bulk color replacements**

For each of these 14+1 files, apply the color replacement map from the palette reference section above. Process each file: read it, apply all replacements, save.

Key replacements (apply with `replace_all: true` per file):
- `#2a2a3a` → `#2A2A30`
- `#1a1a2e` → `#1C1C20`
- `#12121a` → `#151518`
- `text-[#ccc]` → `text-[#C5C0B8]`
- `text-[#888]` → `text-[#8A857D]`
- `text-[#666]` → `text-[#5A5650]`
- `text-[#555]` → `text-[#5A5650]`
- `text-[#999]` → `text-[#8A857D]`
- `border-[#333]` → `border-[#2A2A30]`
- `border-[#444]` → `border-[#323238]`
- `border-[#222]` → `border-[#2A2A30]`
- `text-[#444]` → `text-[#323238]` (for icon buttons like remove/delete)
- `hover:border-[#555]` → `hover:border-[#3A3A42]`
- `hover:text-[#ccc]` → `hover:text-[#C5C0B8]`
- `hover:text-[#888]` → `hover:text-[#8A857D]`
- `bg-[#1a1a2e]` → `bg-[#1C1C20]`

- [ ] **Step 3: Replace unicode symbols with lucide-react icons**

In `SpecializedChapter.tsx`, replace `&#x2715;` with `<X size={12} />` (already imported).

In `ObservationWindowStep.tsx` and `WizardConceptPicker.tsx`, replace 💡 emoji with:
```tsx
import { Lightbulb } from "lucide-react";
// then replace <span className="text-[#C9A227]">💡</span> with:
<Lightbulb size={14} className="inline text-[#C9A227]" />
```

In `TemporalPresetPicker.tsx`, replace `▸` / `▾` with ChevronRight / ChevronDown icons:
```tsx
import { ChevronRight, ChevronDown } from "lucide-react";
// replace: {isCustom ? "▾ Custom range" : "▸ Custom range..."}
// with:
{isCustom ? <><ChevronDown size={12} className="inline" /> Custom range</> : <><ChevronRight size={12} className="inline" /> Custom range...</>}
```

- [ ] **Step 4: Update SpecializedChapter to remove goNext() usage**

The SpecializedChapter currently calls `goNext()` from the store for its "Skip" button. In the modal context, the footer Next button handles progression. Remove the Skip card that calls `goNext()` and keep only the Genomic/Imaging opt-in cards. The user can just click "Next" in the footer to skip.

In `SpecializedChapter.tsx`, remove the third `<button>` in the grid (the "Skip" card with `onClick={goNext}`). Change `grid-cols-3` to `grid-cols-2`.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit 2>&1 | head -30`

Expected: Remaining errors only in files that will be deleted (CohortWizard.tsx, WizardSidebar.tsx, CohortWizardPage.tsx) and in ReviewStep.tsx, GenerateStep.tsx, HandoffStep.tsx (which are superseded by ReviewGenerateStep).

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/cohort-definitions/components/wizard/
git commit -m "style: fix design system color drift across all cohort wizard components"
```

---

### Task 5: Wire Up Modal Invocation and Remove Old Files

**Files:**
- Modify: `frontend/src/features/cohort-definitions/pages/CohortDefinitionsPage.tsx`
- Modify: `frontend/src/app/router.tsx`
- Delete: `frontend/src/features/cohort-definitions/pages/CohortWizardPage.tsx`
- Delete: `frontend/src/features/cohort-definitions/components/wizard/CohortWizard.tsx`
- Delete: `frontend/src/features/cohort-definitions/components/wizard/WizardSidebar.tsx`
- Delete: `frontend/src/features/cohort-definitions/components/wizard/ReviewStep.tsx`
- Delete: `frontend/src/features/cohort-definitions/components/wizard/GenerateStep.tsx`
- Delete: `frontend/src/features/cohort-definitions/components/wizard/HandoffStep.tsx`

- [ ] **Step 1: Update CohortDefinitionsPage.tsx**

In `CohortDefinitionsPage.tsx`:

1. Remove `useNavigate` import (if no other usage remains — check first).
2. Add import: `import { CohortWizardModal } from "../components/wizard/CohortWizardModal";`
3. Add state: `const [wizardOpen, setWizardOpen] = useState(false);`
4. Replace `handleCreate`:
```tsx
const handleCreate = () => {
  setWizardOpen(true);
};
```
5. Add modal render before the closing `</div>`:
```tsx
{wizardOpen && <CohortWizardModal onClose={() => setWizardOpen(false)} />}
```

Note: `useNavigate` is likely still needed if other parts of the page use it. Check before removing.

- [ ] **Step 2: Remove the route from router.tsx**

In `frontend/src/app/router.tsx`, remove the route block for `/cohort-definitions/new`:

```tsx
// DELETE this entire block:
{
  path: "new",
  lazy: () =>
    import(
      "@/features/cohort-definitions/pages/CohortWizardPage"
    ).then((m) => ({ Component: m.default })),
},
```

- [ ] **Step 3: Delete superseded files**

Delete these files (they are now unreachable — all functionality has been moved to CohortWizardModal and the consolidated step components):

```bash
rm frontend/src/features/cohort-definitions/pages/CohortWizardPage.tsx
rm frontend/src/features/cohort-definitions/components/wizard/CohortWizard.tsx
rm frontend/src/features/cohort-definitions/components/wizard/WizardSidebar.tsx
rm frontend/src/features/cohort-definitions/components/wizard/ReviewStep.tsx
rm frontend/src/features/cohort-definitions/components/wizard/GenerateStep.tsx
rm frontend/src/features/cohort-definitions/components/wizard/HandoffStep.tsx
```

- [ ] **Step 4: Verify TypeScript compiles cleanly**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit`

Expected: Zero errors. All references to deleted files should now be resolved by the new components.

- [ ] **Step 5: Verify Vite build succeeds**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vite build 2>&1 | tail -10`

Expected: Build succeeds. Vite build is stricter than `tsc --noEmit` per CLAUDE.md.

- [ ] **Step 6: Commit**

```bash
git add -A frontend/src/features/cohort-definitions/ frontend/src/app/router.tsx
git commit -m "refactor: convert cohort wizard from page-based to modal, delete superseded files"
```

---

### Task 6: Fix CohortDefinitionsPage Search Focus State

**Files:**
- Modify: `frontend/src/features/cohort-definitions/pages/CohortDefinitionsPage.tsx`

The search input on the list page itself has teal focus state (`focus:border-[#2DD4BF] focus:ring-[#2DD4BF]/40`). Fix it while we're here — this page is the wizard's parent.

- [ ] **Step 1: Fix the search input focus colors**

In `CohortDefinitionsPage.tsx` line ~124, replace:

```tsx
focus:border-[#2DD4BF] focus:ring-1 focus:ring-[#2DD4BF]/40
```

with:

```tsx
focus:border-[#C9A227] focus:ring-1 focus:ring-[#C9A227]/15
```

- [ ] **Step 2: Verify TypeScript still compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/cohort-definitions/pages/CohortDefinitionsPage.tsx
git commit -m "style: fix teal focus state on cohort search input to gold"
```

---

### Task 7: Visual Verification and Production Build

**Files:** None (verification only)

- [ ] **Step 1: Start the dev server if not running**

Run: `cd /home/smudoshi/Github/Parthenon && docker compose ps | grep node`

If the node container is running, the dev server is available at `http://localhost:5175`.

- [ ] **Step 2: Run the full Vite production build**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vite build`

Expected: Build succeeds with zero errors.

- [ ] **Step 3: Run TypeScript strict check**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit`

Expected: Zero errors.

- [ ] **Step 4: Run ESLint on wizard files**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx eslint src/features/cohort-definitions/components/wizard/ src/features/cohort-definitions/stores/cohortWizardStore.ts src/features/cohort-definitions/pages/CohortDefinitionsPage.tsx`

Expected: No errors (warnings are acceptable).

- [ ] **Step 5: Verify no off-palette colors remain**

Run from project root:

```bash
grep -rn '#[0-9a-fA-F]\{3,6\}' frontend/src/features/cohort-definitions/components/wizard/ \
  | grep -vE '#(0E0E11|151518|1C1C20|232328|2A2A30|323238|3A3A42|F0EDE8|C5C0B8|8A857D|5A5650|9B1B30|2DD4BF|C9A227|E85A6B|B22040|26B8A5|D4AF37|A78BFA|60A5FA|A7F3D0)' \
  | grep -vE 'rgba\(' \
  | grep -v node_modules
```

Expected: Zero output. Any remaining off-palette hex values need to be fixed.

- [ ] **Step 6: Deploy the frontend build**

Run: `cd /home/smudoshi/Github/Parthenon && ./deploy.sh --frontend`

- [ ] **Step 7: Commit any remaining fixes**

If any checks above revealed issues, fix them and commit:

```bash
git add -A frontend/src/features/cohort-definitions/
git commit -m "fix: resolve remaining wizard build/lint issues"
```
