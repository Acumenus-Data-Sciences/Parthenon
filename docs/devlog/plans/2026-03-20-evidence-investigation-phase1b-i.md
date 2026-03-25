# Evidence Investigation Phase 1b-i — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire Phase 1a's shell to persistent state (auto-save concept sets to investigation), add guided mode entry (StudyAgent question decomposition), integrate cohort import from Parthenon library, and connect CodeWAS validation to the existing FinnGen CO2 backend.

**Architecture:** This plan is pure wiring — no new database tables, no new backend services for CodeWAS (reuses FinnGen CO2 module). The key changes: pass `investigation` prop through EvidenceBoard → PhenotypePanel, implement auto-save debounce for concept set state, add StudyAgent `splitIntent` call to NewInvestigationPage, create a cohort picker component using existing `useCohortDefinitions`, and create a CodeWAS runner that calls the existing `finngenCo2Analysis` endpoint with the investigation's cohort context.

**Tech Stack:** React 19, TypeScript, TanStack Query, Zustand, existing StudyAgent API, existing FinnGen CO2 backend

**Spec:** `docs/superpowers/specs/2026-03-20-finngen-evidence-investigation-design.md` (Phase 1b section)

**Depends on:** Phase 1a complete (all 13 tasks landed)

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `frontend/src/features/investigation/components/phenotype/CohortBuilder.tsx` | Cohort import picker + concept set naming/management |
| `frontend/src/features/investigation/components/phenotype/CohortPicker.tsx` | Browse/select from Parthenon cohort library |
| `frontend/src/features/investigation/components/phenotype/CodeWASRunner.tsx` | CodeWAS execution UI using FinnGen CO2 backend |
| `frontend/src/features/investigation/components/phenotype/CodeWASResults.tsx` | Interactive volcano plot + results table for CodeWAS |
| `frontend/src/features/investigation/hooks/useAutoSave.ts` | Generic debounced auto-save hook for domain state |
| `frontend/src/features/investigation/lib/conceptSetMapper.ts` | Maps between investigation concept set format and OHDSI/Atlas format |

### Modified Files

| File | Changes |
|------|---------|
| `frontend/src/features/investigation/components/EvidenceBoard.tsx` | Pass `investigation` prop to PhenotypePanel |
| `frontend/src/features/investigation/components/PhenotypePanel.tsx` | Accept investigation prop, wire auto-save, enable Build + Validate tabs, manage multi-set state |
| `frontend/src/features/investigation/components/phenotype/ConceptSetBuilder.tsx` | Add "Name this set" input, "Save" action |
| `frontend/src/features/investigation/pages/NewInvestigationPage.tsx` | Add StudyAgent intent split on creation |
| `frontend/src/features/investigation/types.ts` | Add CodeWAS types, StudyAgent intent types |
| `frontend/src/features/investigation/api.ts` | Add CodeWAS API wrapper function |

---

## Task Breakdown

### Task 1: Auto-save hook and EvidenceBoard wiring

**Files:**
- Create: `frontend/src/features/investigation/hooks/useAutoSave.ts`
- Modify: `frontend/src/features/investigation/components/EvidenceBoard.tsx`
- Modify: `frontend/src/features/investigation/components/PhenotypePanel.tsx`

- [ ] **Step 1: Create useAutoSave hook**

Create `frontend/src/features/investigation/hooks/useAutoSave.ts`:

A generic hook that debounces domain state saves. Takes an investigation ID, domain name, and the current state object. Fires `saveDomainState` after 2 seconds of inactivity. Shows a visual indicator ("Saving..." → "Saved").

```typescript
import { useCallback, useEffect, useRef, useState } from "react";
import { useSaveDomainState } from "./useInvestigation";
import type { EvidenceDomain } from "../types";

type SaveStatus = "idle" | "saving" | "saved" | "error";

export function useAutoSave(
  investigationId: number | undefined,
  domain: EvidenceDomain,
  state: Record<string, unknown> | null,
  debounceMs = 2000,
) {
  const mutation = useSaveDomainState();
  const [status, setStatus] = useState<SaveStatus>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastSavedRef = useRef<string>("");

  const save = useCallback(() => {
    if (!investigationId || !state) return;

    const serialized = JSON.stringify(state);
    if (serialized === lastSavedRef.current) return;

    setStatus("saving");
    mutation.mutate(
      { id: investigationId, domain, state },
      {
        onSuccess: () => {
          lastSavedRef.current = serialized;
          setStatus("saved");
          setTimeout(() => setStatus("idle"), 2000);
        },
        onError: () => setStatus("error"),
      },
    );
  }, [investigationId, domain, state, mutation]);

  useEffect(() => {
    if (!state || !investigationId) return;

    const serialized = JSON.stringify(state);
    if (serialized === lastSavedRef.current) return;

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(save, debounceMs);

    return () => clearTimeout(timeoutRef.current);
  }, [state, investigationId, save, debounceMs]);

  return { status, saveNow: save };
}
```

- [ ] **Step 2: Pass investigation prop through EvidenceBoard to PhenotypePanel**

In `frontend/src/features/investigation/components/EvidenceBoard.tsx`, find where `PhenotypePanel` is rendered (in the `FocusPanel` switch). Change it to pass the investigation:

```typescript
// BEFORE:
case "phenotype":
  return <PhenotypePanel />;

// AFTER:
case "phenotype":
  return <PhenotypePanel investigation={investigation} />;
```

- [ ] **Step 3: Update PhenotypePanel to accept investigation and wire auto-save**

In `frontend/src/features/investigation/components/PhenotypePanel.tsx`:

1. Add `investigation: Investigation` to the props interface
2. Initialize `conceptSetEntries` from `investigation.phenotype_state.concept_sets` (map saved concept sets back to `ConceptSetEntry[]` on mount)
3. Build a `phenotypeState` object from the current local state
4. Call `useAutoSave(investigation.id, "phenotype", phenotypeState)` to persist changes
5. Show the save status indicator in the panel header ("Saving..." / "Saved" / "Error")

The auto-save fires whenever `conceptSetEntries` changes (add, remove, toggle). The 2-second debounce prevents excessive API calls.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/investigation/hooks/useAutoSave.ts frontend/src/features/investigation/components/EvidenceBoard.tsx frontend/src/features/investigation/components/PhenotypePanel.tsx
git commit -m "feat(investigation): wire auto-save for phenotype state with 2s debounce"
```

---

### Task 2: Concept set naming and multi-set management

**Files:**
- Modify: `frontend/src/features/investigation/components/phenotype/ConceptSetBuilder.tsx`
- Modify: `frontend/src/features/investigation/components/PhenotypePanel.tsx`

- [ ] **Step 1: Add concept set naming to ConceptSetBuilder**

In `ConceptSetBuilder.tsx`, add above the concept list:

- A text input for the concept set name (default: "Untitled concept set")
- A "New Set" button that saves the current set and creates a new empty one
- A set selector dropdown showing all saved concept sets by name, allowing switching between them

Add props: `setName: string`, `onSetNameChange: (name: string) => void`, `savedSets: Array<{id: string, name: string, count: number}>`, `onSwitchSet: (id: string) => void`, `onNewSet: () => void`.

- [ ] **Step 2: Update PhenotypePanel for multi-set state management**

In `PhenotypePanel.tsx`:

1. Change state from a single `conceptSetEntries` array to a map of concept sets:
   ```typescript
   const [conceptSets, setConceptSets] = useState<Map<string, { name: string; entries: ConceptSetEntry[] }>>(new Map());
   const [activeSetId, setActiveSetId] = useState<string>("");
   ```
2. Initialize from `investigation.phenotype_state.concept_sets` on mount
3. "New Set" generates a UUID, creates an empty set, switches to it
4. Wire the new props through to `ConceptSetBuilder`

- [ ] **Step 3: Update auto-save serializer for new multi-set state shape**

IMPORTANT: Task 1 wired `useAutoSave` with a `phenotypeState` object built from the old single-array `conceptSetEntries`. Now that the state is a Map of named sets, update the `phenotypeState` construction in `PhenotypePanel` to serialize from the new `Map<string, { name, entries }>` into the `PhenotypeState.concept_sets` format:

```typescript
const phenotypeState: PhenotypeState = {
  concept_sets: Array.from(conceptSets.entries()).map(([id, set]) => ({
    id,
    name: set.name,
    concepts: set.entries.map((e) => ({
      concept_id: e.concept.concept_id,
      include_descendants: e.includeDescendants,
      is_excluded: e.isExcluded,
    })),
  })),
  // ... other fields from PhenotypeState
};
```

Verify the auto-save fires correctly by checking that `useAutoSave` receives the updated shape.

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/investigation/components/phenotype/ConceptSetBuilder.tsx frontend/src/features/investigation/components/PhenotypePanel.tsx
git commit -m "feat(investigation): add concept set naming and multi-set management"
```

---

### Task 3: Concept set format mapper

**Files:**
- Create: `frontend/src/features/investigation/lib/conceptSetMapper.ts`

- [ ] **Step 1: Create the mapper**

Create `frontend/src/features/investigation/lib/conceptSetMapper.ts`:

Maps between the investigation's lowercase format and OHDSI Atlas uppercase format:

```typescript
import type { ConceptSearchResult } from "../types";

/** Investigation concept set entry (lowercase, used in PhenotypeState) */
export interface InvestigationConceptEntry {
  concept_id: number;
  include_descendants: boolean;
  is_excluded: boolean;
}

/** OHDSI Atlas concept set expression item (uppercase) */
export interface AtlasConceptSetItem {
  concept: {
    CONCEPT_ID: number;
    CONCEPT_NAME: string;
    DOMAIN_ID: string;
    VOCABULARY_ID: string;
    CONCEPT_CLASS_ID: string;
    STANDARD_CONCEPT: string;
    CONCEPT_CODE: string;
  };
  isExcluded: boolean;
  includeDescendants: boolean;
  includeMapped: boolean;
}

export function toAtlasFormat(
  entries: InvestigationConceptEntry[],
  conceptLookup: Map<number, ConceptSearchResult>,
): AtlasConceptSetItem[] {
  return entries.map((entry) => {
    const concept = conceptLookup.get(entry.concept_id);
    return {
      concept: {
        CONCEPT_ID: entry.concept_id,
        CONCEPT_NAME: concept?.concept_name ?? `Concept ${entry.concept_id}`,
        DOMAIN_ID: concept?.domain_id ?? "Unknown",
        VOCABULARY_ID: concept?.vocabulary_id ?? "Unknown",
        CONCEPT_CLASS_ID: concept?.concept_class_id ?? "Unknown",
        STANDARD_CONCEPT: concept?.standard_concept ?? "S",
        CONCEPT_CODE: concept?.concept_code ?? "",
      },
      isExcluded: entry.is_excluded,
      includeDescendants: entry.include_descendants,
      includeMapped: true,
    };
  });
}

export function fromAtlasFormat(
  items: AtlasConceptSetItem[],
): InvestigationConceptEntry[] {
  return items.map((item) => ({
    concept_id: item.concept.CONCEPT_ID,
    include_descendants: item.includeDescendants,
    is_excluded: item.isExcluded,
  }));
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/investigation/lib/conceptSetMapper.ts
git commit -m "feat(investigation): add concept set format mapper (investigation ↔ Atlas)"
```

---

### Task 4: Cohort Builder tab with Parthenon cohort picker

**Files:**
- Create: `frontend/src/features/investigation/components/phenotype/CohortPicker.tsx`
- Create: `frontend/src/features/investigation/components/phenotype/CohortBuilder.tsx`
- Modify: `frontend/src/features/investigation/components/PhenotypePanel.tsx`

- [ ] **Step 1: Create CohortPicker**

Create `frontend/src/features/investigation/components/phenotype/CohortPicker.tsx`:

A searchable list of Parthenon cohort definitions. Import the existing hook:
```typescript
import { useCohortDefinitions } from "@/features/cohort-definitions/hooks/useCohortDefinitions";
```

- Search input (filters by name/description client-side)
- Scrollable list (max-h-80) of cohort cards
- Each card: cohort name, description truncated to 2 lines, subject count badge if available
- Checkbox selection — multiple cohorts can be selected
- Selected cohorts get a teal border highlight
- "Set as Primary" button on each selected cohort
- Props: `selectedIds: number[]`, `primaryId: number | null`, `onSelectionChange: (ids: number[]) => void`, `onPrimaryChange: (id: number | null) => void`

Read `frontend/src/features/cohort-definitions/` to find the exact hook name and import path. The hook likely lives in a `hooks/` or directly in `api.ts` of that feature.

- [ ] **Step 2: Create CohortBuilder**

Create `frontend/src/features/investigation/components/phenotype/CohortBuilder.tsx`:

The "Build" sub-tab content. Contains:

1. **Import mode selector** — radio button group:
   - "Parthenon Cohorts" (default) — shows `CohortPicker`
   - "Atlas JSON" — textarea for pasting Atlas cohort JSON
   - "File Upload" — file input for CSV/JSON
   - "Phenotype Library" — uses `searchPhenotypes` from StudyAgent API

2. **Selected cohorts summary** — shows selected cohort names as chips below the picker, primary marked with gold badge

3. **Concept sets from Explore** — shows concept sets built in the Explore tab with a note: "These concept sets can be used as inclusion/exclusion criteria"

4. No set operations (Venn diagrams) yet — that's Phase 1b-ii. This is the selection and import layer.

Props: `investigation: Investigation`, `onStateChange: (partial: Partial<PhenotypeState>) => void`

- [ ] **Step 3: Enable the Build tab in PhenotypePanel**

In `PhenotypePanel.tsx`:
1. Remove `disabled: true` from the "Build" sub-tab entry
2. Remove the "Phase 1b" badge from Build
3. In the tab content switch, render `<CohortBuilder investigation={investigation} onStateChange={handleStateChange} />` for the "build" tab
4. Wire `handleStateChange` to update the phenotype state and trigger auto-save

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/investigation/components/phenotype/CohortPicker.tsx frontend/src/features/investigation/components/phenotype/CohortBuilder.tsx frontend/src/features/investigation/components/PhenotypePanel.tsx
git commit -m "feat(investigation): add Cohort Builder tab with Parthenon cohort import picker"
```

---

### Task 5: CodeWAS integration (Validate tab)

**Files:**
- Create: `frontend/src/features/investigation/components/phenotype/CodeWASRunner.tsx`
- Create: `frontend/src/features/investigation/components/phenotype/CodeWASResults.tsx`
- Modify: `frontend/src/features/investigation/api.ts`
- Modify: `frontend/src/features/investigation/types.ts`
- Modify: `frontend/src/features/investigation/components/PhenotypePanel.tsx`

- [ ] **Step 1: Add CodeWAS result display types**

In `frontend/src/features/investigation/types.ts`, add types that match the actual FinnGen CO2 response shape (`top_signals` returns `{ label: string; count: number }` display pairs, not statistical records):

```typescript
export interface CodeWASSignal {
  label: string;
  count: number;
}

export interface CodeWASDisplayResult {
  top_signals: CodeWASSignal[];
  analysis_summary: Record<string, unknown>;
  forest_plot?: Array<{ label: string; hr: number; lower: number; upper: number }>;
  case_cohort_name: string;
  control_cohort_name: string;
}
```

**NOTE:** Do NOT create a new API wrapper function. The existing `previewFinnGenCo2Analysis` from `@/features/finngen/api` already calls the correct endpoint. Import it directly in `CodeWASRunner.tsx`:
```typescript
import { previewFinnGenCo2Analysis } from "@/features/finngen/api";
```

**NOTE:** The volcano plot (requiring statistical fields: odds_ratio, p_value) is deferred to Phase 1b-ii when the actual R-runtime CodeWAS response contract is verified. Phase 1b-i renders a table-only view of the `top_signals` display data.

- [ ] **Step 2: Create CodeWASRunner**

Create `frontend/src/features/investigation/components/phenotype/CodeWASRunner.tsx`:

The control panel for running CodeWAS:

- **Source selector** — dropdown of CDM sources (reuse the `fetchSources` pattern from FinnGen)
- **Case cohort label** — text input (pre-populated from primary selected cohort name if available)
- **Control label** — text input (default: "General population")
- **Run CodeWAS** button — calls `runCodeWAS`, shows loading state
- On completion: renders `CodeWASResults` below

Props: `investigation: Investigation`, `onPinFinding: (finding: {...}) => void`

- [ ] **Step 3: Create CodeWASResults**

Create `frontend/src/features/investigation/components/phenotype/CodeWASResults.tsx`:

Displays CodeWAS results as a table-only view (volcano plot deferred to Phase 1b-ii when statistical fields are verified):

1. **Summary bar** — analysis_summary key metrics displayed as `KeyValueGrid`-style cards
2. **Top signals table** — rows showing label + count from `top_signals`. Each row has a "Pin" button that calls `onPinFinding` with `finding_type: "codewas_hit"`, `finding_payload: { label, count }`
3. **Forest plot section** — if `forest_plot` data exists in the response, render HR bars using Recharts `BarChart` (reusing the pattern from CO2's `ForestPlotView`)
4. **Placeholder** — a note at the bottom: "Interactive volcano plot coming in a future update" with a teal info badge

Props: `result: CodeWASDisplayResult`, `onPinFinding: (finding: {...}) => void`

- [ ] **Step 4: Enable the Validate tab in PhenotypePanel**

In `PhenotypePanel.tsx`:
1. Remove `disabled: true` from the "Validate" sub-tab
2. Remove the "Phase 1b" badge from Validate
3. Render CodeWASRunner in the validate tab content
4. Wire `onPinFinding` to call `useCreatePin` with the investigation ID and `domain: "phenotype"`, `section: "phenotype_definition"`, `finding_type: "codewas_hit"`

- [ ] **Step 5: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/src/features/investigation/components/phenotype/CodeWASRunner.tsx frontend/src/features/investigation/components/phenotype/CodeWASResults.tsx frontend/src/features/investigation/api.ts frontend/src/features/investigation/types.ts frontend/src/features/investigation/components/PhenotypePanel.tsx
git commit -m "feat(investigation): add CodeWAS validation tab with volcano plot and pin-to-dossier"
```

---

### Task 6: Guided mode — StudyAgent intent split on creation

**Files:**
- Modify: `frontend/src/features/investigation/pages/NewInvestigationPage.tsx`
- Modify: `frontend/src/features/investigation/types.ts`

- [ ] **Step 1: Import existing StudyAgent intent type**

Do NOT create a new `IntentSplit` interface — import the existing `IntentSplitResult` from the study-agent feature:
```typescript
import type { IntentSplitResult } from "@/features/study-agent/types";
```

The existing type has `target: string`, `outcome: string`, `rationale?: string` (note `rationale` is optional). Use this type directly.

- [ ] **Step 2: Update NewInvestigationPage with intent split**

In `NewInvestigationPage.tsx`:

1. After the user fills in a research question and clicks "Create", check if the research question is non-empty and longer than 20 characters
2. If so, call `splitIntent({ intent: researchQuestion })` from `@/features/study-agent/api` in parallel with the `createInvestigation` mutation
3. If `splitIntent` succeeds, pre-populate the investigation's `phenotype_state` with a suggested concept set name derived from `intent.target` and `intent.outcome`
4. Save the intent split result to `phenotype_state` via `saveDomainState` after creation
5. Show a brief "AI is analyzing your research question..." loading indicator while the split runs
6. If `splitIntent` fails (StudyAgent unavailable), silently proceed — guided mode is best-effort

The flow becomes:
```
User fills form → clicks "Create"
→ createInvestigation fires (fast, just title + question)
→ navigate to investigation page
→ splitIntent fires in background
→ if split succeeds, saveDomainState to seed phenotype_state with suggestions
→ saveDomainState invalidates ["investigation", id] query
→ EvidenceBoard (already mounted) re-renders with seeded phenotype_state
```

**Note for implementer:** The `saveDomainState` call happens from the *new* page after navigation. The TanStack Query invalidation will cause a background refetch and silent re-render of PhenotypePanel with the seeded state. This is the intended behavior — the user sees the investigation load, then a moment later the AI-suggested concept set names appear. No loading modal needed.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/investigation/pages/NewInvestigationPage.tsx frontend/src/features/investigation/types.ts
git commit -m "feat(investigation): add StudyAgent intent split for guided mode investigation creation"
```

---

### Task 7: Full verification

- [ ] **Step 1: Run frontend TypeScript check**

Run: `cd frontend && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 2: Run frontend ESLint**

Run: `cd frontend && npx eslint src/features/investigation/`
Expected: PASS (or only pre-existing warnings)

- [ ] **Step 3: Run backend PHPStan**

Run: `cd backend && vendor/bin/phpstan analyse`
Expected: No new errors

- [ ] **Step 4: Run backend tests**

Run: `cd backend && vendor/bin/pest tests/Feature/Api/V1/InvestigationCrudTest.php tests/Feature/Api/V1/EvidencePinTest.php`
Expected: All tests still pass (no backend changes in this phase break existing tests)

- [ ] **Step 5: Final commit if any lint fixes needed**

```bash
git add -A
git commit -m "chore: lint fixes after Evidence Investigation Phase 1b-i"
```
