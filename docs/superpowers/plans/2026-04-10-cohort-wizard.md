# Cohort Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a guided, chapter-based cohort creation wizard that translates OHDSI mechanics into clinical language, replacing the "New Cohort Definition" button with a "Cohort Wizard" button.

**Architecture:** 6-chapter wizard with persistent sidebar navigation. Embeds existing vocabulary search panels for inline concept discovery. Produces a standard `CohortExpression` JSON identical to the Advanced Editor's output. New Zustand store manages wizard state and assembles the final expression.

**Tech Stack:** React 19, TypeScript strict, Zustand, TanStack Query, Tailwind CSS 4, existing vocabulary/genomic/imaging components

**Spec:** `docs/superpowers/specs/2026-04-10-cohort-wizard-design.md`

---

## File Map

### New Files

| File | Purpose |
|---|---|
| `frontend/src/features/cohort-definitions/pages/CohortWizardPage.tsx` | Route-level page component wrapping `CohortWizard` |
| `frontend/src/features/cohort-definitions/stores/cohortWizardStore.ts` | Zustand store: wizard navigation, metadata, expression assembly |
| `frontend/src/features/cohort-definitions/components/wizard/CohortWizard.tsx` | Top-level layout: sidebar + content area + Back/Next |
| `frontend/src/features/cohort-definitions/components/wizard/WizardSidebar.tsx` | Chapter list with completion indicators |
| `frontend/src/features/cohort-definitions/components/wizard/BasicsChapter.tsx` | Ch 1: Name, description, domain, tags |
| `frontend/src/features/cohort-definitions/components/wizard/EntryEventsStep.tsx` | Ch 2 Step 1: Entry event concept picker |
| `frontend/src/features/cohort-definitions/components/wizard/ObservationWindowStep.tsx` | Ch 2 Step 2: Prior/post days |
| `frontend/src/features/cohort-definitions/components/wizard/QualifyingEventsStep.tsx` | Ch 2 Step 3: First vs All |
| `frontend/src/features/cohort-definitions/components/wizard/InclusionRulesStep.tsx` | Ch 3 Step 1: Sentence-pattern rules |
| `frontend/src/features/cohort-definitions/components/wizard/InclusionRuleSentence.tsx` | Single inclusion rule sentence builder |
| `frontend/src/features/cohort-definitions/components/wizard/TemporalPresetPicker.tsx` | Preset grid + custom temporal range |
| `frontend/src/features/cohort-definitions/components/wizard/DemographicsStep.tsx` | Ch 3 Step 2: Age, gender, race, ethnicity |
| `frontend/src/features/cohort-definitions/components/wizard/RiskScoresStep.tsx` | Ch 3 Step 3: Risk score filters |
| `frontend/src/features/cohort-definitions/components/wizard/EndStrategyStep.tsx` | Ch 4 Step 1: Three end strategy cards |
| `frontend/src/features/cohort-definitions/components/wizard/CensoringStep.tsx` | Ch 4 Step 2: Censoring event picker |
| `frontend/src/features/cohort-definitions/components/wizard/SpecializedChapter.tsx` | Ch 5: Opt-in gate + embedded panels |
| `frontend/src/features/cohort-definitions/components/wizard/ReviewStep.tsx` | Ch 6 Step 1: Plain-English summary |
| `frontend/src/features/cohort-definitions/components/wizard/GenerateStep.tsx` | Ch 6 Step 2: Source selector + generate |
| `frontend/src/features/cohort-definitions/components/wizard/HandoffStep.tsx` | Ch 6 Step 3: Done / Editor / Diagnostics |
| `frontend/src/features/cohort-definitions/components/wizard/WizardConceptPicker.tsx` | Wraps vocab search panels with selection list |
| `frontend/src/features/cohort-definitions/components/wizard/SelectedConceptsList.tsx` | Displays selected concepts with toggles |
| `frontend/src/features/cohort-definitions/components/wizard/CohortSummary.tsx` | Plain-English expression renderer |
| `frontend/src/features/cohort-definitions/utils/buildExpression.ts` | Pure function: wizard state → CohortExpression |
| `frontend/src/features/cohort-definitions/utils/autoNameConceptSet.ts` | Context-based concept set naming |
| `frontend/src/features/cohort-definitions/utils/temporalPresets.ts` | Preset definitions + Coeff translation |

### Modified Files

| File | Change |
|---|---|
| `frontend/src/app/router.tsx` | Add `path: "new"` route for wizard |
| `frontend/src/features/cohort-definitions/pages/CohortDefinitionsPage.tsx` | Change button label + navigate to `/cohort-definitions/new` |

---

## Task 1: Utility Functions (Foundation)

**Files:**
- Create: `frontend/src/features/cohort-definitions/utils/temporalPresets.ts`
- Create: `frontend/src/features/cohort-definitions/utils/autoNameConceptSet.ts`
- Create: `frontend/src/features/cohort-definitions/utils/buildExpression.ts`

These pure functions have no UI dependencies and are testable in isolation. They form the foundation for all subsequent tasks.

- [ ] **Step 1: Create temporal presets and Coeff translation**

```typescript
// frontend/src/features/cohort-definitions/utils/temporalPresets.ts
import type { TemporalWindow } from "../types/cohortExpression";

export interface TemporalPreset {
  key: string;
  label: string;
  description: string;
  window: TemporalWindow | null; // null = no temporal restriction
}

export const TEMPORAL_PRESETS: TemporalPreset[] = [
  {
    key: "any_time_before",
    label: "Any time before",
    description: "Event occurred at any point prior to cohort entry",
    window: {
      Start: { Days: 99999, Coeff: -1 },
      End: { Days: 0, Coeff: -1 },
    },
  },
  {
    key: "any_time_after",
    label: "Any time after",
    description: "Event occurred at any point after cohort entry",
    window: {
      Start: { Days: 0, Coeff: 1 },
      End: { Days: 99999, Coeff: 1 },
    },
  },
  {
    key: "same_day",
    label: "Same day",
    description: "Event on the same date as cohort entry",
    window: {
      Start: { Days: 0, Coeff: -1 },
      End: { Days: 0, Coeff: 1 },
    },
  },
  {
    key: "within_30",
    label: "Within 30 days",
    description: "30 days before through 30 days after",
    window: {
      Start: { Days: 30, Coeff: -1 },
      End: { Days: 30, Coeff: 1 },
    },
  },
  {
    key: "within_90",
    label: "Within 90 days",
    description: "90 days before through 90 days after",
    window: {
      Start: { Days: 90, Coeff: -1 },
      End: { Days: 90, Coeff: 1 },
    },
  },
  {
    key: "any_time",
    label: "Any time",
    description: "No temporal restriction",
    window: null,
  },
];

export type TemporalDirection = "before" | "after";

export function directionToCoeff(direction: TemporalDirection): number {
  return direction === "before" ? -1 : 1;
}

export function coeffToDirection(coeff: number): TemporalDirection {
  return coeff < 0 ? "before" : "after";
}

export function buildCustomWindow(
  startDays: number,
  startDirection: TemporalDirection,
  endDays: number,
  endDirection: TemporalDirection,
): TemporalWindow {
  return {
    Start: { Days: startDays, Coeff: directionToCoeff(startDirection) },
    End: { Days: endDays, Coeff: directionToCoeff(endDirection) },
  };
}

export function describeWindow(window: TemporalWindow | null | undefined): string {
  if (!window) return "any time";
  const startDir = coeffToDirection(window.Start.Coeff);
  const endDir = coeffToDirection(window.End.Coeff);

  if (window.Start.Days === 0 && window.End.Days === 0) {
    return "on the same day as cohort entry";
  }
  if (window.Start.Days >= 99999 && startDir === "before") {
    return "any time before cohort entry";
  }
  if (window.End.Days >= 99999 && endDir === "after") {
    return "any time after cohort entry";
  }

  return `between ${window.Start.Days} days ${startDir} and ${window.End.Days} days ${endDir} cohort entry`;
}
```

- [ ] **Step 2: Create concept set auto-namer**

```typescript
// frontend/src/features/cohort-definitions/utils/autoNameConceptSet.ts
import type { Concept } from "@/features/vocabulary/types/vocabulary";

export type ConceptSetContext = "Entry" | "Inclusion" | "Censoring" | "Era";

export function autoNameConceptSet(
  context: ConceptSetContext,
  concepts: Pick<Concept, "concept_name">[],
): string {
  if (concepts.length === 0) return `${context}: (empty)`;
  const primary = concepts[0].concept_name;
  if (concepts.length === 1) return `${context}: ${primary}`;
  return `${context}: ${primary} + ${concepts.length - 1} more`;
}
```

- [ ] **Step 3: Create expression builder**

```typescript
// frontend/src/features/cohort-definitions/utils/buildExpression.ts
import type {
  CohortExpression,
  ConceptSetExpression,
  ConceptSetExpressionItem,
  CriteriaGroup,
  DomainCriterionType,
  EndStrategy,
  WindowedCriteria,
  DemographicFilter,
  GenomicCriterion,
  ImagingCriterion,
  RiskScoreCriterion,
  OccurrenceCount,
} from "../types/cohortExpression";
import type { Concept } from "@/features/vocabulary/types/vocabulary";

// --- Wizard-specific types ---

export interface WizardEntryConcept {
  concept: Concept;
  domain: DomainCriterionType;
  includeDescendants: boolean;
  includeMapped: boolean;
  firstOccurrenceOnly: boolean;
}

export interface WizardInclusionRule {
  domain: DomainCriterionType;
  concepts: WizardEntryConcept[];
  occurrenceType: 0 | 1 | 2; // exactly, at most, at least
  occurrenceCount: number;
  temporalWindow: import("../types/cohortExpression").TemporalWindow | null;
  restrictVisit: boolean;
}

export type InclusionLogicType = "ALL" | "ANY" | "NONE";

export interface WizardEndStrategy {
  type: "observation" | "fixed" | "drug_era";
  fixedDays?: number;
  fixedDateField?: "StartDate" | "EndDate";
  drugConcepts?: WizardEntryConcept[];
  gapDays?: number;
  offset?: number;
}

export interface WizardState {
  name: string;
  description: string;
  domain: string;
  tags: string[];
  entryConcepts: WizardEntryConcept[];
  observationWindow: { priorDays: number; postDays: number };
  qualifiedLimit: "First" | "All";
  inclusionRules: WizardInclusionRule[];
  inclusionLogic: InclusionLogicType;
  demographics: DemographicFilter | null;
  riskScores: RiskScoreCriterion[];
  endStrategy: WizardEndStrategy;
  censoringConcepts: WizardEntryConcept[];
  genomicCriteria: GenomicCriterion[];
  imagingCriteria: ImagingCriterion[];
}

// --- Builder ---

function conceptToItem(
  entry: WizardEntryConcept,
): ConceptSetExpressionItem {
  return {
    concept: {
      CONCEPT_ID: entry.concept.concept_id,
      CONCEPT_NAME: entry.concept.concept_name,
      DOMAIN_ID: entry.concept.domain_id,
      VOCABULARY_ID: entry.concept.vocabulary_id,
      CONCEPT_CLASS_ID: entry.concept.concept_class_id,
      STANDARD_CONCEPT: entry.concept.standard_concept ?? undefined,
      CONCEPT_CODE: entry.concept.concept_code,
    },
    isExcluded: false,
    includeDescendants: entry.includeDescendants,
    includeMapped: entry.includeMapped,
  };
}

export function buildExpression(state: WizardState): CohortExpression {
  const conceptSets: ConceptSetExpression[] = [];
  let nextId = 0;

  // Helper: create a concept set, return its ID
  function addConceptSet(
    name: string,
    entries: WizardEntryConcept[],
  ): number {
    const id = nextId++;
    conceptSets.push({
      id,
      name,
      expression: { items: entries.map(conceptToItem) },
    });
    return id;
  }

  // --- Primary Criteria ---
  // Group entry concepts by domain
  const byDomain = new Map<DomainCriterionType, WizardEntryConcept[]>();
  for (const entry of state.entryConcepts) {
    const list = byDomain.get(entry.domain) ?? [];
    list.push(entry);
    byDomain.set(entry.domain, list);
  }

  const criteriaList: Partial<Record<DomainCriterionType, { CodesetId: number; First?: boolean }>>[] = [];
  for (const [domain, entries] of byDomain) {
    const primary = entries[0];
    const setName = `Entry: ${primary.concept.concept_name}${entries.length > 1 ? ` + ${entries.length - 1} more` : ""}`;
    const codesetId = addConceptSet(setName, entries);
    criteriaList.push({
      [domain]: {
        CodesetId: codesetId,
        ...(primary.firstOccurrenceOnly ? { First: true } : {}),
      },
    });
  }

  // --- Inclusion Rules ---
  let additionalCriteria: CriteriaGroup | undefined;
  if (state.inclusionRules.length > 0) {
    const criteriaGroupList: WindowedCriteria[] = state.inclusionRules.map(
      (rule) => {
        const primary = rule.concepts[0];
        const setName = `Inclusion: ${primary?.concept.concept_name ?? "Unknown"}${rule.concepts.length > 1 ? ` + ${rule.concepts.length - 1} more` : ""}`;
        const codesetId = addConceptSet(setName, rule.concepts);

        const wc: WindowedCriteria = {
          Criteria: {
            [rule.domain]: { CodesetId: codesetId },
          },
          Occurrence: {
            Type: rule.occurrenceType,
            Count: rule.occurrenceCount,
          } as OccurrenceCount,
          RestrictVisit: rule.restrictVisit || undefined,
        };
        if (rule.temporalWindow) {
          wc.StartWindow = rule.temporalWindow;
        }
        return wc;
      },
    );

    const groupType = state.inclusionLogic === "NONE" ? "AT_MOST_0" : state.inclusionLogic;
    additionalCriteria = {
      Type: groupType as "ALL" | "ANY" | "AT_MOST_0",
      CriteriaList: criteriaGroupList,
      Groups: [],
    };
  }

  // --- End Strategy ---
  let endStrategy: EndStrategy | undefined;
  if (state.endStrategy.type === "fixed") {
    endStrategy = {
      DateOffset: {
        DateField: state.endStrategy.fixedDateField ?? "StartDate",
        Offset: state.endStrategy.fixedDays ?? 365,
      },
    };
  } else if (state.endStrategy.type === "drug_era" && state.endStrategy.drugConcepts?.length) {
    const primary = state.endStrategy.drugConcepts[0];
    const setName = `Era: ${primary.concept.concept_name}`;
    const codesetId = addConceptSet(setName, state.endStrategy.drugConcepts);
    endStrategy = {
      CustomEra: {
        DrugCodesetId: codesetId,
        GapDays: state.endStrategy.gapDays ?? 30,
        Offset: state.endStrategy.offset ?? 0,
      },
    };
  }
  // type === "observation" → no EndStrategy (observation period end)

  // --- Censoring ---
  let censoringCriteria: CohortExpression["CensoringCriteria"] | undefined;
  if (state.censoringConcepts.length > 0) {
    // Group by domain like primary criteria
    const censByDomain = new Map<DomainCriterionType, WizardEntryConcept[]>();
    for (const entry of state.censoringConcepts) {
      const list = censByDomain.get(entry.domain) ?? [];
      list.push(entry);
      censByDomain.set(entry.domain, list);
    }
    censoringCriteria = [];
    for (const [domain, entries] of censByDomain) {
      const primary = entries[0];
      const setName = `Censoring: ${primary.concept.concept_name}`;
      const codesetId = addConceptSet(setName, entries);
      censoringCriteria.push({ [domain]: { CodesetId: codesetId } });
    }
  }

  // --- Demographics ---
  const demographicCriteria = state.demographics ? [state.demographics] : undefined;

  // --- Assemble ---
  return {
    ConceptSets: conceptSets,
    PrimaryCriteria: {
      CriteriaList: criteriaList,
      ObservationWindow: {
        PriorDays: state.observationWindow.priorDays,
        PostDays: state.observationWindow.postDays,
      },
    },
    AdditionalCriteria: additionalCriteria,
    QualifiedLimit: { Type: state.qualifiedLimit },
    ExpressionLimit: { Type: state.qualifiedLimit },
    CollapseSettings: { CollapseType: "ERA", EraPad: 0 },
    EndStrategy: endStrategy,
    CensoringCriteria: censoringCriteria,
    DemographicCriteria: demographicCriteria,
    GenomicCriteria: state.genomicCriteria.length > 0 ? state.genomicCriteria : undefined,
    ImagingCriteria: state.imagingCriteria.length > 0 ? state.imagingCriteria : undefined,
    RiskScoreCriteria: state.riskScores.length > 0 ? state.riskScores : undefined,
  };
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -30`

Expected: No errors from the new files (existing errors may appear).

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/cohort-definitions/utils/temporalPresets.ts \
        frontend/src/features/cohort-definitions/utils/autoNameConceptSet.ts \
        frontend/src/features/cohort-definitions/utils/buildExpression.ts
git commit -m "feat(cohort-wizard): add utility functions for expression building, temporal presets, and concept set naming"
```

---

## Task 2: Wizard Store

**Files:**
- Create: `frontend/src/features/cohort-definitions/stores/cohortWizardStore.ts`

- [ ] **Step 1: Create the Zustand wizard store**

```typescript
// frontend/src/features/cohort-definitions/stores/cohortWizardStore.ts
import { create } from "zustand";
import type { Concept } from "@/features/vocabulary/types/vocabulary";
import type {
  DomainCriterionType,
  DemographicFilter,
  GenomicCriterion,
  ImagingCriterion,
  RiskScoreCriterion,
  TemporalWindow,
  CohortExpression,
} from "../types/cohortExpression";
import {
  buildExpression,
  type WizardEntryConcept,
  type WizardInclusionRule,
  type WizardEndStrategy,
  type WizardState,
  type InclusionLogicType,
} from "../utils/buildExpression";

export type ChapterStatus = "pending" | "in-progress" | "complete" | "warning";

interface CohortWizardStore {
  // Navigation
  currentChapter: number;
  currentStep: number;

  // Metadata
  name: string;
  description: string;
  domain: string;
  tags: string[];

  // Chapter 2: Define Population
  entryConcepts: WizardEntryConcept[];
  observationWindow: { priorDays: number; postDays: number };
  qualifiedLimit: "First" | "All";

  // Chapter 3: Refine & Filter
  inclusionRules: WizardInclusionRule[];
  inclusionLogic: InclusionLogicType;
  demographics: DemographicFilter | null;
  riskScores: RiskScoreCriterion[];

  // Chapter 4: Follow-up & Exit
  endStrategy: WizardEndStrategy;
  censoringConcepts: WizardEntryConcept[];

  // Chapter 5: Specialized
  selectedSpecialized: ("genomic" | "imaging")[];
  genomicCriteria: GenomicCriterion[];
  imagingCriteria: ImagingCriterion[];

  // Navigation actions
  setChapter: (chapter: number) => void;
  setStep: (step: number) => void;
  goNext: () => void;
  goBack: () => void;

  // Metadata actions
  setName: (name: string) => void;
  setDescription: (description: string) => void;
  setDomain: (domain: string) => void;
  setTags: (tags: string[]) => void;

  // Chapter 2 actions
  addEntryConcept: (concept: Concept, domain: DomainCriterionType, options?: { includeDescendants?: boolean; includeMapped?: boolean; firstOccurrenceOnly?: boolean }) => void;
  removeEntryConcept: (conceptId: number) => void;
  updateEntryConceptOptions: (conceptId: number, options: Partial<Pick<WizardEntryConcept, "includeDescendants" | "includeMapped" | "firstOccurrenceOnly">>) => void;
  setObservationWindow: (priorDays: number, postDays: number) => void;
  setQualifiedLimit: (limit: "First" | "All") => void;

  // Chapter 3 actions
  addInclusionRule: () => void;
  removeInclusionRule: (index: number) => void;
  updateInclusionRule: (index: number, updates: Partial<WizardInclusionRule>) => void;
  addInclusionRuleConcept: (ruleIndex: number, concept: Concept, domain: DomainCriterionType) => void;
  removeInclusionRuleConcept: (ruleIndex: number, conceptId: number) => void;
  setInclusionLogic: (logic: InclusionLogicType) => void;
  setDemographics: (demographics: DemographicFilter | null) => void;
  addRiskScore: (criterion: RiskScoreCriterion) => void;
  removeRiskScore: (index: number) => void;

  // Chapter 4 actions
  setEndStrategy: (strategy: WizardEndStrategy) => void;
  addCensoringConcept: (concept: Concept, domain: DomainCriterionType) => void;
  removeCensoringConcept: (conceptId: number) => void;

  // Chapter 5 actions
  setSelectedSpecialized: (selected: ("genomic" | "imaging")[]) => void;
  addGenomicCriterion: (criterion: GenomicCriterion) => void;
  removeGenomicCriterion: (index: number) => void;
  addImagingCriterion: (criterion: ImagingCriterion) => void;
  removeImagingCriterion: (index: number) => void;

  // Chapter completion
  getChapterStatus: (chapter: number) => ChapterStatus;

  // Build final expression
  buildExpression: () => CohortExpression;

  // Reset
  reset: () => void;
}

const CHAPTER_STEPS: Record<number, number> = {
  1: 1, // Basics: 1 step
  2: 3, // Define Population: Entry events, Observation window, Qualifying events
  3: 3, // Refine: Inclusion rules, Demographics, Risk scores
  4: 2, // Follow-up: End strategy, Censoring
  5: 1, // Specialized: opt-in gate
  6: 3, // Review: Summary, Generate, Handoff
};

const initialState = {
  currentChapter: 1,
  currentStep: 1,
  name: "",
  description: "",
  domain: "",
  tags: [] as string[],
  entryConcepts: [] as WizardEntryConcept[],
  observationWindow: { priorDays: 0, postDays: 0 },
  qualifiedLimit: "First" as const,
  inclusionRules: [] as WizardInclusionRule[],
  inclusionLogic: "ALL" as InclusionLogicType,
  demographics: null as DemographicFilter | null,
  riskScores: [] as RiskScoreCriterion[],
  endStrategy: { type: "observation" } as WizardEndStrategy,
  censoringConcepts: [] as WizardEntryConcept[],
  selectedSpecialized: [] as ("genomic" | "imaging")[],
  genomicCriteria: [] as GenomicCriterion[],
  imagingCriteria: [] as ImagingCriterion[],
};

export const useCohortWizardStore = create<CohortWizardStore>((set, get) => ({
  ...initialState,

  // --- Navigation ---
  setChapter: (chapter) => set({ currentChapter: chapter, currentStep: 1 }),
  setStep: (step) => set({ currentStep: step }),

  goNext: () => {
    const { currentChapter, currentStep } = get();
    const maxSteps = CHAPTER_STEPS[currentChapter] ?? 1;
    if (currentStep < maxSteps) {
      set({ currentStep: currentStep + 1 });
    } else if (currentChapter < 6) {
      set({ currentChapter: currentChapter + 1, currentStep: 1 });
    }
  },

  goBack: () => {
    const { currentChapter, currentStep } = get();
    if (currentStep > 1) {
      set({ currentStep: currentStep - 1 });
    } else if (currentChapter > 1) {
      const prevChapter = currentChapter - 1;
      set({
        currentChapter: prevChapter,
        currentStep: CHAPTER_STEPS[prevChapter] ?? 1,
      });
    }
  },

  // --- Metadata ---
  setName: (name) => set({ name }),
  setDescription: (description) => set({ description }),
  setDomain: (domain) => set({ domain }),
  setTags: (tags) => set({ tags }),

  // --- Chapter 2 ---
  addEntryConcept: (concept, domain, options) =>
    set((s) => ({
      entryConcepts: [
        ...s.entryConcepts,
        {
          concept,
          domain,
          includeDescendants: options?.includeDescendants ?? true,
          includeMapped: options?.includeMapped ?? false,
          firstOccurrenceOnly: options?.firstOccurrenceOnly ?? false,
        },
      ],
    })),

  removeEntryConcept: (conceptId) =>
    set((s) => ({
      entryConcepts: s.entryConcepts.filter(
        (e) => e.concept.concept_id !== conceptId,
      ),
    })),

  updateEntryConceptOptions: (conceptId, options) =>
    set((s) => ({
      entryConcepts: s.entryConcepts.map((e) =>
        e.concept.concept_id === conceptId ? { ...e, ...options } : e,
      ),
    })),

  setObservationWindow: (priorDays, postDays) =>
    set({ observationWindow: { priorDays, postDays } }),

  setQualifiedLimit: (limit) => set({ qualifiedLimit: limit }),

  // --- Chapter 3 ---
  addInclusionRule: () =>
    set((s) => ({
      inclusionRules: [
        ...s.inclusionRules,
        {
          domain: "ConditionOccurrence" as DomainCriterionType,
          concepts: [],
          occurrenceType: 2, // at least
          occurrenceCount: 1,
          temporalWindow: null,
          restrictVisit: false,
        },
      ],
    })),

  removeInclusionRule: (index) =>
    set((s) => ({
      inclusionRules: s.inclusionRules.filter((_, i) => i !== index),
    })),

  updateInclusionRule: (index, updates) =>
    set((s) => ({
      inclusionRules: s.inclusionRules.map((r, i) =>
        i === index ? { ...r, ...updates } : r,
      ),
    })),

  addInclusionRuleConcept: (ruleIndex, concept, domain) =>
    set((s) => ({
      inclusionRules: s.inclusionRules.map((r, i) =>
        i === ruleIndex
          ? {
              ...r,
              domain,
              concepts: [
                ...r.concepts,
                {
                  concept,
                  domain,
                  includeDescendants: true,
                  includeMapped: false,
                  firstOccurrenceOnly: false,
                },
              ],
            }
          : r,
      ),
    })),

  removeInclusionRuleConcept: (ruleIndex, conceptId) =>
    set((s) => ({
      inclusionRules: s.inclusionRules.map((r, i) =>
        i === ruleIndex
          ? {
              ...r,
              concepts: r.concepts.filter(
                (c) => c.concept.concept_id !== conceptId,
              ),
            }
          : r,
      ),
    })),

  setInclusionLogic: (logic) => set({ inclusionLogic: logic }),
  setDemographics: (demographics) => set({ demographics }),

  addRiskScore: (criterion) =>
    set((s) => ({ riskScores: [...s.riskScores, criterion] })),

  removeRiskScore: (index) =>
    set((s) => ({
      riskScores: s.riskScores.filter((_, i) => i !== index),
    })),

  // --- Chapter 4 ---
  setEndStrategy: (strategy) => set({ endStrategy: strategy }),

  addCensoringConcept: (concept, domain) =>
    set((s) => ({
      censoringConcepts: [
        ...s.censoringConcepts,
        {
          concept,
          domain,
          includeDescendants: true,
          includeMapped: false,
          firstOccurrenceOnly: false,
        },
      ],
    })),

  removeCensoringConcept: (conceptId) =>
    set((s) => ({
      censoringConcepts: s.censoringConcepts.filter(
        (e) => e.concept.concept_id !== conceptId,
      ),
    })),

  // --- Chapter 5 ---
  setSelectedSpecialized: (selected) =>
    set({ selectedSpecialized: selected }),

  addGenomicCriterion: (criterion) =>
    set((s) => ({
      genomicCriteria: [...s.genomicCriteria, criterion],
    })),

  removeGenomicCriterion: (index) =>
    set((s) => ({
      genomicCriteria: s.genomicCriteria.filter((_, i) => i !== index),
    })),

  addImagingCriterion: (criterion) =>
    set((s) => ({
      imagingCriteria: [...s.imagingCriteria, criterion],
    })),

  removeImagingCriterion: (index) =>
    set((s) => ({
      imagingCriteria: s.imagingCriteria.filter((_, i) => i !== index),
    })),

  // --- Chapter completion ---
  getChapterStatus: (chapter) => {
    const s = get();
    switch (chapter) {
      case 1:
        if (!s.name) return "pending";
        return "complete";
      case 2:
        if (s.entryConcepts.length === 0) return "pending";
        return "complete";
      case 3:
        return s.inclusionRules.length > 0 || s.demographics || s.riskScores.length > 0
          ? "complete"
          : "pending";
      case 4:
        return "complete"; // Always valid (observation period is default)
      case 5:
        return "complete"; // Always valid (optional)
      case 6:
        return "pending";
      default:
        return "pending";
    }
  },

  // --- Build expression ---
  buildExpression: () => {
    const s = get();
    const wizardState: WizardState = {
      name: s.name,
      description: s.description,
      domain: s.domain,
      tags: s.tags,
      entryConcepts: s.entryConcepts,
      observationWindow: s.observationWindow,
      qualifiedLimit: s.qualifiedLimit,
      inclusionRules: s.inclusionRules,
      inclusionLogic: s.inclusionLogic,
      demographics: s.demographics,
      riskScores: s.riskScores,
      endStrategy: s.endStrategy,
      censoringConcepts: s.censoringConcepts,
      genomicCriteria: s.genomicCriteria,
      imagingCriteria: s.imagingCriteria,
    };
    return buildExpression(wizardState);
  },

  // --- Reset ---
  reset: () => set(initialState),
}));
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/cohort-definitions/stores/cohortWizardStore.ts
git commit -m "feat(cohort-wizard): add Zustand wizard store with navigation, state management, and expression assembly"
```

---

## Task 3: Wizard Shell (Router + Layout + Sidebar)

**Files:**
- Create: `frontend/src/features/cohort-definitions/pages/CohortWizardPage.tsx`
- Create: `frontend/src/features/cohort-definitions/components/wizard/CohortWizard.tsx`
- Create: `frontend/src/features/cohort-definitions/components/wizard/WizardSidebar.tsx`
- Modify: `frontend/src/app/router.tsx`
- Modify: `frontend/src/features/cohort-definitions/pages/CohortDefinitionsPage.tsx`

- [ ] **Step 1: Create WizardSidebar**

```typescript
// frontend/src/features/cohort-definitions/components/wizard/WizardSidebar.tsx
import { Check, Circle, AlertCircle } from "lucide-react";
import { useCohortWizardStore, type ChapterStatus } from "../../stores/cohortWizardStore";

interface Chapter {
  number: number;
  label: string;
  steps: string[];
  optional?: boolean;
}

const CHAPTERS: Chapter[] = [
  { number: 1, label: "Basics", steps: ["Name, description, domain"] },
  { number: 2, label: "Define Population", steps: ["Entry Events", "Observation Window", "Qualifying Events"] },
  { number: 3, label: "Refine & Filter", steps: ["Inclusion Rules", "Demographics", "Risk Scores"] },
  { number: 4, label: "Follow-up & Exit", steps: ["End Strategy", "Censoring Events"] },
  { number: 5, label: "Specialized", steps: ["Genomic", "Imaging"], optional: true },
  { number: 6, label: "Review & Generate", steps: ["Summary", "Generate", "What's Next"] },
];

function StatusIcon({ status }: { status: ChapterStatus }) {
  switch (status) {
    case "complete":
      return (
        <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#2DD4BF]">
          <Check size={12} className="text-[#0E0E11]" />
        </div>
      );
    case "warning":
      return (
        <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-[#C9A227]">
          <AlertCircle size={12} className="text-[#0E0E11]" />
        </div>
      );
    case "in-progress":
      return (
        <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full border-2 border-[#C9A227]">
          <Circle size={8} className="fill-[#C9A227] text-[#C9A227]" />
        </div>
      );
    default:
      return (
        <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-[#444]">
          <span className="text-[11px] text-[#666]">{/* number injected by parent */}</span>
        </div>
      );
  }
}

export function WizardSidebar() {
  const { currentChapter, currentStep, setChapter, getChapterStatus } =
    useCohortWizardStore();

  return (
    <div className="w-[240px] shrink-0 rounded-xl border border-[#2a2a3a] bg-[#12121a] p-5">
      <div className="mb-4 text-[11px] uppercase tracking-widest text-[#666]">
        Wizard Progress
      </div>
      <div className="flex flex-col gap-5">
        {CHAPTERS.map((ch) => {
          const isActive = currentChapter === ch.number;
          const status = isActive ? "in-progress" : getChapterStatus(ch.number);

          return (
            <button
              key={ch.number}
              type="button"
              onClick={() => setChapter(ch.number)}
              className="text-left"
            >
              <div className="flex items-center gap-2">
                {status === "pending" ? (
                  <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full border border-[#444]">
                    <span className="text-[11px] text-[#666]">{ch.number}</span>
                  </div>
                ) : (
                  <StatusIcon status={status} />
                )}
                <span
                  className={`text-sm ${
                    isActive
                      ? "font-semibold text-[#C9A227]"
                      : status === "complete"
                        ? "text-[#2DD4BF]"
                        : "text-[#888]"
                  }`}
                >
                  {ch.label}
                </span>
                {ch.optional && (
                  <span className="rounded bg-[#1a1a2e] px-1.5 py-0.5 text-[10px] text-[#555]">
                    optional
                  </span>
                )}
              </div>
              <div className="ml-[30px] mt-1">
                {ch.steps.map((step, si) => {
                  const isActiveStep = isActive && currentStep === si + 1;
                  return (
                    <div
                      key={step}
                      className={`text-[11px] ${
                        isActiveStep ? "text-[#C9A227]" : "text-[#555]"
                      }`}
                    >
                      {isActiveStep ? "→ " : "· "}
                      {step}
                    </div>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create CohortWizard layout**

```typescript
// frontend/src/features/cohort-definitions/components/wizard/CohortWizard.tsx
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { WizardSidebar } from "./WizardSidebar";
import { BasicsChapter } from "./BasicsChapter";
import { EntryEventsStep } from "./EntryEventsStep";
import { ObservationWindowStep } from "./ObservationWindowStep";
import { QualifyingEventsStep } from "./QualifyingEventsStep";
import { InclusionRulesStep } from "./InclusionRulesStep";
import { DemographicsStep } from "./DemographicsStep";
import { RiskScoresStep } from "./RiskScoresStep";
import { EndStrategyStep } from "./EndStrategyStep";
import { CensoringStep } from "./CensoringStep";
import { SpecializedChapter } from "./SpecializedChapter";
import { ReviewStep } from "./ReviewStep";
import { GenerateStep } from "./GenerateStep";
import { HandoffStep } from "./HandoffStep";

const CHAPTER_TITLES: Record<number, { title: string; subtitle: string }> = {
  1: { title: "Basics", subtitle: "What are you studying?" },
  2: { title: "Define Population", subtitle: "Who enters the cohort?" },
  3: { title: "Refine & Filter", subtitle: "What else must be true?" },
  4: { title: "Follow-up & Exit", subtitle: "How long are they followed?" },
  5: { title: "Specialized Criteria", subtitle: "Any molecular or imaging criteria?" },
  6: { title: "Review & Generate", subtitle: "Does this look right?" },
};

function ActiveStep() {
  const { currentChapter, currentStep } = useCohortWizardStore();

  // Chapter 1
  if (currentChapter === 1) return <BasicsChapter />;

  // Chapter 2
  if (currentChapter === 2) {
    if (currentStep === 1) return <EntryEventsStep />;
    if (currentStep === 2) return <ObservationWindowStep />;
    if (currentStep === 3) return <QualifyingEventsStep />;
  }

  // Chapter 3
  if (currentChapter === 3) {
    if (currentStep === 1) return <InclusionRulesStep />;
    if (currentStep === 2) return <DemographicsStep />;
    if (currentStep === 3) return <RiskScoresStep />;
  }

  // Chapter 4
  if (currentChapter === 4) {
    if (currentStep === 1) return <EndStrategyStep />;
    if (currentStep === 2) return <CensoringStep />;
  }

  // Chapter 5
  if (currentChapter === 5) return <SpecializedChapter />;

  // Chapter 6
  if (currentChapter === 6) {
    if (currentStep === 1) return <ReviewStep />;
    if (currentStep === 2) return <GenerateStep />;
    if (currentStep === 3) return <HandoffStep />;
  }

  return null;
}

export function CohortWizard() {
  const { currentChapter, goNext, goBack } = useCohortWizardStore();
  const header = CHAPTER_TITLES[currentChapter];
  const isFirstStep = currentChapter === 1;
  const isLastStep = currentChapter === 6;

  return (
    <div className="flex gap-6 p-6">
      <WizardSidebar />
      <div className="min-w-0 flex-1 rounded-xl border border-[#2a2a3a] bg-[#12121a] p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="m-0 text-[#C9A227]">
              Chapter {currentChapter}: {header?.title}
            </h3>
            <p className="mt-1 text-[13px] text-[#666]">{header?.subtitle}</p>
          </div>
          <div className="flex gap-2">
            {!isFirstStep && (
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-1 rounded-md border border-[#333] px-3.5 py-1.5 text-[12px] text-[#888] transition-colors hover:border-[#555] hover:text-[#ccc]"
              >
                <ArrowLeft size={14} />
                Back
              </button>
            )}
            {!isLastStep && (
              <button
                type="button"
                onClick={goNext}
                className="flex items-center gap-1 rounded-md bg-[#C9A227] px-3.5 py-1.5 text-[12px] font-semibold text-[#0E0E11] transition-colors hover:bg-[#B8922A]"
              >
                Next
                <ArrowRight size={14} />
              </button>
            )}
          </div>
        </div>
        <ActiveStep />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create CohortWizardPage**

```typescript
// frontend/src/features/cohort-definitions/pages/CohortWizardPage.tsx
import { useEffect } from "react";
import { CohortWizard } from "../components/wizard/CohortWizard";
import { useCohortWizardStore } from "../stores/cohortWizardStore";

export default function CohortWizardPage() {
  const reset = useCohortWizardStore((s) => s.reset);

  useEffect(() => {
    reset();
  }, [reset]);

  return <CohortWizard />;
}
```

- [ ] **Step 4: Create placeholder chapter components**

Create stub components for every chapter/step so the wizard shell compiles and renders. Each stub shows the chapter/step title and a placeholder message.

```typescript
// frontend/src/features/cohort-definitions/components/wizard/BasicsChapter.tsx
export function BasicsChapter() {
  return <div className="text-[#888]">Chapter 1: Basics — implementation pending</div>;
}
```

Create identical stubs for: `EntryEventsStep`, `ObservationWindowStep`, `QualifyingEventsStep`, `InclusionRulesStep`, `DemographicsStep`, `RiskScoresStep`, `EndStrategyStep`, `CensoringStep`, `SpecializedChapter`, `ReviewStep`, `GenerateStep`, `HandoffStep`.

Each follows the same pattern:

```typescript
export function ComponentName() {
  return <div className="text-[#888]">Step description — implementation pending</div>;
}
```

- [ ] **Step 5: Add route and update button**

In `frontend/src/app/router.tsx`, add the wizard route inside the `cohort-definitions` children array, **before** the `:id` route:

```typescript
{
  path: "new",
  lazy: () =>
    import(
      "@/features/cohort-definitions/pages/CohortWizardPage"
    ).then((m) => ({ Component: m.default })),
},
```

In `frontend/src/features/cohort-definitions/pages/CohortDefinitionsPage.tsx`, change the button from `handleCreate` to navigate:

Replace the `handleCreate` function body with:
```typescript
const handleCreate = () => {
  navigate("/cohort-definitions/new");
};
```

Change the button label from `New Cohort Definition` to `Cohort Wizard` and the icon from `Plus` to `Wand2` (import from lucide-react).

- [ ] **Step 6: Verify TypeScript and test navigation**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -40`

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vite build 2>&1 | tail -10`

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/cohort-definitions/pages/CohortWizardPage.tsx \
        frontend/src/features/cohort-definitions/components/wizard/ \
        frontend/src/app/router.tsx \
        frontend/src/features/cohort-definitions/pages/CohortDefinitionsPage.tsx
git commit -m "feat(cohort-wizard): add wizard shell with sidebar navigation, chapter routing, and page entry point"
```

---

## Task 4: Chapter 1 — Basics

**Files:**
- Modify: `frontend/src/features/cohort-definitions/components/wizard/BasicsChapter.tsx`

- [ ] **Step 1: Implement BasicsChapter**

```typescript
// frontend/src/features/cohort-definitions/components/wizard/BasicsChapter.tsx
import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { X } from "lucide-react";
import { useState } from "react";

const DOMAIN_OPTIONS = [
  { value: "cardiovascular", label: "Cardiovascular" },
  { value: "metabolic", label: "Metabolic / Endocrine" },
  { value: "renal", label: "Renal" },
  { value: "oncology", label: "Oncology" },
  { value: "rare-disease", label: "Rare Disease" },
  { value: "pain-substance-use", label: "Pain / Substance Use" },
  { value: "pediatric", label: "Pediatric" },
  { value: "general", label: "General" },
] as const;

export function BasicsChapter() {
  const { name, description, domain, tags, setName, setDescription, setDomain, setTags } =
    useCohortWizardStore();
  const [tagInput, setTagInput] = useState("");

  const handleAddTag = () => {
    const trimmed = tagInput.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setTagInput("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleTagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Name */}
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-[#ccc]">
          Cohort Name <span className="text-[#E85A6B]">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Type 2 Diabetes on Metformin"
          autoFocus
          className="w-full rounded-lg border border-[#333] bg-[#0E0E11] px-4 py-2.5 text-[14px] text-[#ccc] placeholder-[#555] outline-none transition-colors focus:border-[#C9A227]"
        />
      </div>

      {/* Description */}
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-[#ccc]">
          Description <span className="text-[11px] text-[#555]">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the clinical context and purpose of this cohort..."
          rows={3}
          className="w-full resize-none rounded-lg border border-[#333] bg-[#0E0E11] px-4 py-2.5 text-[13px] text-[#ccc] placeholder-[#555] outline-none transition-colors focus:border-[#C9A227]"
        />
      </div>

      {/* Domain */}
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-[#ccc]">
          Clinical Domain
        </label>
        <select
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          className="w-full rounded-lg border border-[#333] bg-[#0E0E11] px-4 py-2.5 text-[13px] text-[#ccc] outline-none transition-colors focus:border-[#C9A227]"
        >
          <option value="">Select a domain...</option>
          {DOMAIN_OPTIONS.map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tags */}
      <div>
        <label className="mb-1.5 block text-[13px] font-medium text-[#ccc]">
          Tags <span className="text-[11px] text-[#555]">(optional)</span>
        </label>
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded-md border border-[#333] bg-[#1a1a2e] px-2.5 py-1 text-[12px] text-[#ccc]"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="text-[#555] hover:text-[#E85A6B]"
              >
                <X size={12} />
              </button>
            </span>
          ))}
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKeyDown}
            onBlur={handleAddTag}
            placeholder="Add tag..."
            className="rounded-md border border-[#333] bg-[#0E0E11] px-3 py-1 text-[12px] text-[#ccc] placeholder-[#555] outline-none focus:border-[#C9A227]"
          />
        </div>
      </div>

      {/* Validation hint */}
      {!name && (
        <div className="rounded-lg border border-[rgba(201,162,39,0.15)] bg-[rgba(201,162,39,0.05)] px-4 py-3">
          <span className="text-[13px] text-[#999]">
            <strong className="text-[#C9A227]">Required:</strong> Enter a name for your cohort to continue.
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/cohort-definitions/components/wizard/BasicsChapter.tsx
git commit -m "feat(cohort-wizard): implement Chapter 1 — Basics (name, description, domain, tags)"
```

---

## Task 5: WizardConceptPicker + SelectedConceptsList

**Files:**
- Create: `frontend/src/features/cohort-definitions/components/wizard/WizardConceptPicker.tsx`
- Create: `frontend/src/features/cohort-definitions/components/wizard/SelectedConceptsList.tsx`

These are the reusable concept selection components embedded in Chapters 2, 3, and 4.

- [ ] **Step 1: Create SelectedConceptsList**

```typescript
// frontend/src/features/cohort-definitions/components/wizard/SelectedConceptsList.tsx
import { X } from "lucide-react";
import type { WizardEntryConcept } from "../../utils/buildExpression";

interface SelectedConceptsListProps {
  concepts: WizardEntryConcept[];
  onRemove: (conceptId: number) => void;
  onUpdateOptions?: (conceptId: number, options: Partial<Pick<WizardEntryConcept, "includeDescendants" | "includeMapped" | "firstOccurrenceOnly">>) => void;
  showFirstOccurrence?: boolean;
}

export function SelectedConceptsList({
  concepts,
  onRemove,
  onUpdateOptions,
  showFirstOccurrence = false,
}: SelectedConceptsListProps) {
  if (concepts.length === 0) return null;

  return (
    <div className="border-t border-[#222] pt-3">
      <div className="mb-2 text-[11px] uppercase tracking-wider text-[#666]">
        Selected ({concepts.length})
      </div>
      <div className="flex flex-col gap-1.5">
        {concepts.map((entry) => (
          <div
            key={entry.concept.concept_id}
            className="flex items-center rounded-md border border-[rgba(45,212,191,0.15)] bg-[rgba(45,212,191,0.05)] px-3 py-2"
          >
            <div className="min-w-0 flex-1">
              <span className="mr-2 font-mono text-[11px] text-[#C9A227]">
                {entry.concept.concept_id}
              </span>
              <span className="text-[13px] text-[#ccc]">
                {entry.concept.concept_name}
              </span>
              <span className="ml-2 rounded bg-[rgba(155,27,48,0.2)] px-1.5 py-0.5 text-[10px] text-[#E85A6B]">
                {entry.concept.domain_id}
              </span>
              <span className="ml-1 rounded bg-[rgba(201,162,39,0.2)] px-1.5 py-0.5 text-[10px] text-[#C9A227]">
                {entry.concept.vocabulary_id}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {onUpdateOptions && (
                <>
                  <label className="flex items-center gap-1 text-[11px] text-[#888]">
                    <input
                      type="checkbox"
                      checked={entry.includeDescendants}
                      onChange={(e) =>
                        onUpdateOptions(entry.concept.concept_id, {
                          includeDescendants: e.target.checked,
                        })
                      }
                      className="accent-[#2DD4BF]"
                    />
                    Descendants
                  </label>
                  {showFirstOccurrence && (
                    <label className="flex items-center gap-1 text-[11px] text-[#888]">
                      <input
                        type="checkbox"
                        checked={entry.firstOccurrenceOnly}
                        onChange={(e) =>
                          onUpdateOptions(entry.concept.concept_id, {
                            firstOccurrenceOnly: e.target.checked,
                          })
                        }
                        className="accent-[#2DD4BF]"
                      />
                      First only
                    </label>
                  )}
                </>
              )}
              <button
                type="button"
                onClick={() => onRemove(entry.concept.concept_id)}
                className="text-[#444] hover:text-[#E85A6B]"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create WizardConceptPicker**

```typescript
// frontend/src/features/cohort-definitions/components/wizard/WizardConceptPicker.tsx
import { useState, useMemo, useCallback } from "react";
import { Search, Sparkles, GitBranch } from "lucide-react";
import { VocabularySearchPanel } from "@/features/vocabulary/components/VocabularySearchPanel";
import { SemanticSearchPanel } from "@/features/vocabulary/components/SemanticSearchPanel";
import { HierarchyBrowserPanel } from "@/features/vocabulary/components/HierarchyBrowserPanel";
import type { Concept } from "@/features/vocabulary/types/vocabulary";
import type { DomainCriterionType } from "../../types/cohortExpression";
import type { WizardEntryConcept } from "../../utils/buildExpression";
import { SelectedConceptsList } from "./SelectedConceptsList";

type SearchTab = "keyword" | "semantic" | "hierarchy";

const DOMAIN_MAP: Record<string, DomainCriterionType> = {
  Condition: "ConditionOccurrence",
  Drug: "DrugExposure",
  Procedure: "ProcedureOccurrence",
  Measurement: "Measurement",
  Observation: "Observation",
  Visit: "VisitOccurrence",
  Death: "Death",
};

interface WizardConceptPickerProps {
  concepts: WizardEntryConcept[];
  onAdd: (concept: Concept, domain: DomainCriterionType) => void;
  onRemove: (conceptId: number) => void;
  onUpdateOptions?: (conceptId: number, options: Partial<Pick<WizardEntryConcept, "includeDescendants" | "includeMapped" | "firstOccurrenceOnly">>) => void;
  showFirstOccurrence?: boolean;
  prompt?: string;
}

export function WizardConceptPicker({
  concepts,
  onAdd,
  onRemove,
  onUpdateOptions,
  showFirstOccurrence = false,
  prompt = "Search for conditions, drugs, procedures...",
}: WizardConceptPickerProps) {
  const [activeTab, setActiveTab] = useState<SearchTab>("keyword");

  const selectedIds = useMemo(
    () => new Set(concepts.map((c) => c.concept.concept_id)),
    [concepts],
  );

  const handleAddConcept = useCallback(
    (conceptId: number) => {
      // We need the full concept object. The search panels call onAddToSet with just the ID.
      // We'll use onSelectConcept instead to get the full concept via the detail panel pattern.
      // For now, the search panels in build mode provide the concept ID via onAddToSet.
      // We need to fetch the concept detail to get domain_id for mapping.
      // The panels already show domain_id in their results — we store it on selection.
    },
    [],
  );

  const handleSelectConcept = useCallback(
    (conceptId: number) => {
      // This is called when a concept is clicked in the search results.
      // We don't use this for adding — we use onAddToSet.
    },
    [],
  );

  // The VocabularySearchPanel and SemanticSearchPanel both support onAddToSet
  // which receives conceptId. However, we need the full Concept object to
  // determine the domain. We'll use a ref-based approach: store concepts
  // from search results and look them up by ID when added.

  const tabs = [
    { key: "keyword" as const, label: "Keyword", icon: Search, color: "rgba(155,27,48,0.3)" },
    { key: "semantic" as const, label: "Semantic (AI)", icon: Sparkles, color: "rgba(45,212,191,0.3)" },
    { key: "hierarchy" as const, label: "Browse Hierarchy", icon: GitBranch, color: "rgba(201,162,39,0.3)" },
  ];

  return (
    <div className="rounded-lg border border-[#2a2a3a] bg-[#0E0E11] p-4">
      {/* Tab selector */}
      <div className="mb-3 flex gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] transition-colors ${
              activeTab === tab.key
                ? "border border-current bg-opacity-15 font-medium"
                : "text-[#555] hover:text-[#888]"
            }`}
            style={
              activeTab === tab.key
                ? { borderColor: tab.color, color: tab.color.replace("0.3", "1") }
                : undefined
            }
          >
            <tab.icon size={12} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search panel */}
      <div className="max-h-[400px] overflow-y-auto">
        {activeTab === "keyword" && (
          <VocabularySearchPanel
            mode="build"
            conceptSetItemIds={selectedIds}
            onAddToSet={(conceptId) => {
              // The panel doesn't give us the full concept, so we handle
              // this through a workaround: we listen for the concept via
              // onSelectConcept or pass the concept through a shared ref.
              // For the wizard, we'll rely on the panel's internal concept list.
              // This will be connected in the step components that use this picker.
              handleAddConcept(conceptId);
            }}
          />
        )}
        {activeTab === "semantic" && (
          <SemanticSearchPanel
            mode="build"
            conceptSetItemIds={selectedIds}
            onAddToSet={(conceptId) => {
              handleAddConcept(conceptId);
            }}
          />
        )}
        {activeTab === "hierarchy" && (
          <HierarchyBrowserPanel
            mode="browse"
            onSelectConcept={handleSelectConcept}
          />
        )}
      </div>

      {/* Selected concepts */}
      <div className="mt-3">
        <SelectedConceptsList
          concepts={concepts}
          onRemove={onRemove}
          onUpdateOptions={onUpdateOptions}
          showFirstOccurrence={showFirstOccurrence}
        />
      </div>

      {/* Tip */}
      {concepts.length > 0 && (
        <div className="mt-3 rounded-lg border border-[rgba(201,162,39,0.15)] bg-[rgba(201,162,39,0.05)] px-3 py-2">
          <span className="text-[#C9A227]">💡</span>{" "}
          <span className="text-[11px] text-[#999]">
            <strong className="text-[#C9A227]">Tip:</strong> "Include descendants"
            automatically captures all sub-types. For example, selecting "Type 2 diabetes
            mellitus" with descendants includes all specific complications.
          </span>
        </div>
      )}
    </div>
  );
}
```

**Note to implementer:** The `VocabularySearchPanel` and `SemanticSearchPanel` `onAddToSet` callbacks only provide `conceptId` (number), not the full `Concept` object. The step components that use `WizardConceptPicker` will need to fetch the concept detail via the existing `useConcept(id)` hook or maintain a lookup map from search results. The simplest approach: when `onAddToSet` fires, fetch `/api/v1/vocabulary/concepts/{id}` to get the full concept, then call `onAdd` with the result. This is a single lightweight API call per addition.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/cohort-definitions/components/wizard/WizardConceptPicker.tsx \
        frontend/src/features/cohort-definitions/components/wizard/SelectedConceptsList.tsx
git commit -m "feat(cohort-wizard): add WizardConceptPicker and SelectedConceptsList components"
```

---

## Task 6: Chapter 2 — Define Population (Entry Events, Observation Window, Qualifying Events)

**Files:**
- Modify: `frontend/src/features/cohort-definitions/components/wizard/EntryEventsStep.tsx`
- Modify: `frontend/src/features/cohort-definitions/components/wizard/ObservationWindowStep.tsx`
- Modify: `frontend/src/features/cohort-definitions/components/wizard/QualifyingEventsStep.tsx`

- [ ] **Step 1: Implement EntryEventsStep**

```typescript
// frontend/src/features/cohort-definitions/components/wizard/EntryEventsStep.tsx
import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { WizardConceptPicker } from "./WizardConceptPicker";

export function EntryEventsStep() {
  const { entryConcepts, addEntryConcept, removeEntryConcept, updateEntryConceptOptions } =
    useCohortWizardStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-[#ccc]">
          Step 1 of 3 — Entry Events
        </div>
        <p className="text-[13px] text-[#888]">
          Search for the diagnoses, procedures, medications, or other events that define when
          a patient enters your cohort. You can add multiple entry events — a patient matching{" "}
          <em>any</em> of them qualifies.
        </p>
      </div>

      <WizardConceptPicker
        concepts={entryConcepts}
        onAdd={(concept, domain) => addEntryConcept(concept, domain)}
        onRemove={removeEntryConcept}
        onUpdateOptions={updateEntryConceptOptions}
        showFirstOccurrence
        prompt="Search conditions, drugs, procedures..."
      />
    </div>
  );
}
```

- [ ] **Step 2: Implement ObservationWindowStep**

```typescript
// frontend/src/features/cohort-definitions/components/wizard/ObservationWindowStep.tsx
import { useCohortWizardStore } from "../../stores/cohortWizardStore";

export function ObservationWindowStep() {
  const { observationWindow, setObservationWindow } = useCohortWizardStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-[#ccc]">
          Step 2 of 3 — Observation Window
        </div>
        <p className="text-[13px] text-[#888]">
          How much medical history must a patient have before and after their entry event?
        </p>
      </div>

      <div className="rounded-lg border border-[#2a2a3a] bg-[#0E0E11] p-4">
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <label className="min-w-[240px] text-[13px] text-[#ccc]">
              Days of history required before entry
            </label>
            <input
              type="number"
              min={0}
              value={observationWindow.priorDays}
              onChange={(e) =>
                setObservationWindow(
                  Math.max(0, parseInt(e.target.value) || 0),
                  observationWindow.postDays,
                )
              }
              className="w-[100px] rounded-md border border-[#444] bg-[#1a1a2e] px-3 py-2 text-center text-[13px] text-[#C9A227] outline-none focus:border-[#C9A227]"
            />
            <span className="text-[13px] text-[#888]">days</span>
          </div>

          <div className="flex items-center gap-4">
            <label className="min-w-[240px] text-[13px] text-[#ccc]">
              Days of follow-up required after entry
            </label>
            <input
              type="number"
              min={0}
              value={observationWindow.postDays}
              onChange={(e) =>
                setObservationWindow(
                  observationWindow.priorDays,
                  Math.max(0, parseInt(e.target.value) || 0),
                )
              }
              className="w-[100px] rounded-md border border-[#444] bg-[#1a1a2e] px-3 py-2 text-center text-[13px] text-[#C9A227] outline-none focus:border-[#C9A227]"
            />
            <span className="text-[13px] text-[#888]">days</span>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-[rgba(201,162,39,0.15)] bg-[rgba(201,162,39,0.05)] px-4 py-3">
        <span className="text-[#C9A227]">💡</span>{" "}
        <span className="text-[13px] text-[#999]">
          <strong className="text-[#C9A227]">Tip:</strong> This ensures patients have enough
          data for your study. For example, requiring 365 days of prior history ensures you
          can check for pre-existing conditions.
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement QualifyingEventsStep**

```typescript
// frontend/src/features/cohort-definitions/components/wizard/QualifyingEventsStep.tsx
import { useCohortWizardStore } from "../../stores/cohortWizardStore";

export function QualifyingEventsStep() {
  const { qualifiedLimit, setQualifiedLimit } = useCohortWizardStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-[#ccc]">
          Step 3 of 3 — Qualifying Events
        </div>
        <p className="text-[13px] text-[#888]">
          If a patient has multiple qualifying events, which one defines their cohort entry?
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => setQualifiedLimit("First")}
          className={`rounded-lg p-4 text-left transition-colors ${
            qualifiedLimit === "First"
              ? "border-2 border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.05)]"
              : "border border-[#333] bg-[#1a1a2e] hover:border-[#555]"
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`flex h-[18px] w-[18px] items-center justify-center rounded-full ${
                qualifiedLimit === "First"
                  ? "bg-[#2DD4BF]"
                  : "border border-[#555]"
              }`}
            >
              {qualifiedLimit === "First" && (
                <div className="h-2 w-2 rounded-full bg-[#0E0E11]" />
              )}
            </div>
            <span className="text-[13px] font-medium text-[#ccc]">
              First event
            </span>
            <span className="rounded bg-[rgba(45,212,191,0.15)] px-1.5 py-0.5 text-[10px] text-[#2DD4BF]">
              recommended
            </span>
          </div>
          <p className="mt-1.5 ml-[26px] text-[12px] text-[#888]">
            Use the earliest qualifying event as the entry date. Most common choice.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setQualifiedLimit("All")}
          className={`rounded-lg p-4 text-left transition-colors ${
            qualifiedLimit === "All"
              ? "border-2 border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.05)]"
              : "border border-[#333] bg-[#1a1a2e] hover:border-[#555]"
          }`}
        >
          <div className="flex items-center gap-2">
            <div
              className={`flex h-[18px] w-[18px] items-center justify-center rounded-full ${
                qualifiedLimit === "All"
                  ? "bg-[#2DD4BF]"
                  : "border border-[#555]"
              }`}
            >
              {qualifiedLimit === "All" && (
                <div className="h-2 w-2 rounded-full bg-[#0E0E11]" />
              )}
            </div>
            <span className="text-[13px] font-medium text-[#ccc]">
              All events
            </span>
          </div>
          <p className="mt-1.5 ml-[26px] text-[12px] text-[#888]">
            Each qualifying event creates a separate cohort entry period.
          </p>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/cohort-definitions/components/wizard/EntryEventsStep.tsx \
        frontend/src/features/cohort-definitions/components/wizard/ObservationWindowStep.tsx \
        frontend/src/features/cohort-definitions/components/wizard/QualifyingEventsStep.tsx
git commit -m "feat(cohort-wizard): implement Chapter 2 — Define Population (entry events, observation window, qualifying events)"
```

---

## Task 7: Chapter 3 — Refine & Filter (Inclusion Rules, Demographics, Risk Scores)

**Files:**
- Create: `frontend/src/features/cohort-definitions/components/wizard/TemporalPresetPicker.tsx`
- Create: `frontend/src/features/cohort-definitions/components/wizard/InclusionRuleSentence.tsx`
- Modify: `frontend/src/features/cohort-definitions/components/wizard/InclusionRulesStep.tsx`
- Modify: `frontend/src/features/cohort-definitions/components/wizard/DemographicsStep.tsx`
- Modify: `frontend/src/features/cohort-definitions/components/wizard/RiskScoresStep.tsx`

- [ ] **Step 1: Create TemporalPresetPicker**

```typescript
// frontend/src/features/cohort-definitions/components/wizard/TemporalPresetPicker.tsx
import { useState } from "react";
import type { TemporalWindow } from "../../types/cohortExpression";
import {
  TEMPORAL_PRESETS,
  buildCustomWindow,
  describeWindow,
  coeffToDirection,
  type TemporalDirection,
} from "../../utils/temporalPresets";

interface TemporalPresetPickerProps {
  value: TemporalWindow | null;
  onChange: (window: TemporalWindow | null) => void;
}

export function TemporalPresetPicker({ value, onChange }: TemporalPresetPickerProps) {
  const [isCustom, setIsCustom] = useState(false);
  const [startDays, setStartDays] = useState(value?.Start?.Days ?? 30);
  const [startDir, setStartDir] = useState<TemporalDirection>(
    value?.Start ? coeffToDirection(value.Start.Coeff) : "before",
  );
  const [endDays, setEndDays] = useState(value?.End?.Days ?? 30);
  const [endDir, setEndDir] = useState<TemporalDirection>(
    value?.End ? coeffToDirection(value.End.Coeff) : "after",
  );

  const handlePreset = (preset: (typeof TEMPORAL_PRESETS)[number]) => {
    setIsCustom(false);
    onChange(preset.window);
    if (preset.window) {
      setStartDays(preset.window.Start.Days);
      setStartDir(coeffToDirection(preset.window.Start.Coeff));
      setEndDays(preset.window.End.Days);
      setEndDir(coeffToDirection(preset.window.End.Coeff));
    }
  };

  const handleCustomChange = (
    sd: number,
    sDir: TemporalDirection,
    ed: number,
    eDir: TemporalDirection,
  ) => {
    setStartDays(sd);
    setStartDir(sDir);
    setEndDays(ed);
    setEndDir(eDir);
    onChange(buildCustomWindow(sd, sDir, ed, eDir));
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Presets */}
      <div className="grid grid-cols-3 gap-2">
        {TEMPORAL_PRESETS.map((preset) => {
          const isSelected =
            !isCustom &&
            JSON.stringify(value) === JSON.stringify(preset.window);
          return (
            <button
              key={preset.key}
              type="button"
              onClick={() => handlePreset(preset)}
              className={`rounded-md p-2.5 text-left transition-colors ${
                isSelected
                  ? "border border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.05)]"
                  : "border border-[#2a2a3a] bg-[#0E0E11] hover:border-[#444]"
              }`}
            >
              <div className={`text-[13px] font-medium ${isSelected ? "text-[#2DD4BF]" : "text-[#ccc]"}`}>
                {preset.label}
              </div>
              <div className="text-[11px] text-[#666]">{preset.description}</div>
            </button>
          );
        })}
      </div>

      {/* Custom toggle */}
      <button
        type="button"
        onClick={() => {
          setIsCustom(true);
          handleCustomChange(startDays, startDir, endDays, endDir);
        }}
        className={`text-[12px] ${isCustom ? "text-[#C9A227]" : "text-[#555] hover:text-[#888]"}`}
      >
        {isCustom ? "▾ Custom range" : "▸ Custom range..."}
      </button>

      {/* Custom range inputs */}
      {isCustom && (
        <div className="rounded-md bg-[#1a1a2e] p-3">
          <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
            <span className="text-[#ccc]">between</span>
            <input
              type="number"
              min={0}
              value={startDays}
              onChange={(e) =>
                handleCustomChange(Math.max(0, parseInt(e.target.value) || 0), startDir, endDays, endDir)
              }
              className="w-[50px] rounded border border-[#444] bg-[#0E0E11] px-2 py-1 text-center text-[#C9A227] outline-none focus:border-[#C9A227]"
            />
            <span className="text-[#ccc]">days</span>
            <select
              value={startDir}
              onChange={(e) =>
                handleCustomChange(startDays, e.target.value as TemporalDirection, endDays, endDir)
              }
              className="rounded border border-[#444] bg-[#0E0E11] px-2 py-1 text-[#2DD4BF] outline-none"
            >
              <option value="before">before</option>
              <option value="after">after</option>
            </select>
            <span className="text-[#ccc]">and</span>
            <input
              type="number"
              min={0}
              value={endDays}
              onChange={(e) =>
                handleCustomChange(startDays, startDir, Math.max(0, parseInt(e.target.value) || 0), endDir)
              }
              className="w-[50px] rounded border border-[#444] bg-[#0E0E11] px-2 py-1 text-center text-[#C9A227] outline-none focus:border-[#C9A227]"
            />
            <span className="text-[#ccc]">days</span>
            <select
              value={endDir}
              onChange={(e) =>
                handleCustomChange(startDays, startDir, endDays, e.target.value as TemporalDirection)
              }
              className="rounded border border-[#444] bg-[#0E0E11] px-2 py-1 text-[#2DD4BF] outline-none"
            >
              <option value="before">before</option>
              <option value="after">after</option>
            </select>
            <span className="text-[#ccc]">cohort entry</span>
          </div>
        </div>
      )}

      {/* Live preview */}
      {value !== undefined && (
        <div className="rounded-md border border-[rgba(45,212,191,0.15)] bg-[rgba(45,212,191,0.05)] px-3 py-2">
          <span className="text-[11px] text-[#666]">READS AS: </span>
          <span className="text-[13px] text-[#ccc]">
            "{describeWindow(value)}"
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create InclusionRuleSentence**

```typescript
// frontend/src/features/cohort-definitions/components/wizard/InclusionRuleSentence.tsx
import { Trash2 } from "lucide-react";
import type { DomainCriterionType } from "../../types/cohortExpression";
import type { WizardInclusionRule } from "../../utils/buildExpression";
import { describeWindow } from "../../utils/temporalPresets";
import { TemporalPresetPicker } from "./TemporalPresetPicker";
import { WizardConceptPicker } from "./WizardConceptPicker";

const DOMAIN_LABELS: Record<DomainCriterionType, string> = {
  ConditionOccurrence: "condition",
  DrugExposure: "drug exposure",
  ProcedureOccurrence: "procedure",
  Measurement: "measurement",
  Observation: "observation",
  VisitOccurrence: "visit",
  Death: "death",
};

const OCCURRENCE_LABELS: Record<number, string> = {
  0: "exactly",
  1: "at most",
  2: "at least",
};

interface InclusionRuleSentenceProps {
  rule: WizardInclusionRule;
  index: number;
  onUpdate: (index: number, updates: Partial<WizardInclusionRule>) => void;
  onAddConcept: (ruleIndex: number, concept: import("@/features/vocabulary/types/vocabulary").Concept, domain: DomainCriterionType) => void;
  onRemoveConcept: (ruleIndex: number, conceptId: number) => void;
  onRemove: (index: number) => void;
}

export function InclusionRuleSentence({
  rule,
  index,
  onUpdate,
  onAddConcept,
  onRemoveConcept,
  onRemove,
}: InclusionRuleSentenceProps) {
  const isExclusion = rule.occurrenceType === 0 && rule.occurrenceCount === 0;
  const primaryConceptName = rule.concepts[0]?.concept.concept_name ?? "...";

  return (
    <div className="rounded-lg border border-[#2a2a3a] bg-[#0E0E11] p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[11px] uppercase tracking-wider text-[#666]">
            Rule {index + 1}
          </span>
          {isExclusion && (
            <span className="rounded bg-[rgba(155,27,48,0.2)] px-1.5 py-0.5 text-[10px] text-[#E85A6B]">
              exclusion
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="text-[#444] hover:text-[#E85A6B]"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Sentence builder */}
      <div className="flex flex-wrap items-center gap-1.5 text-[14px] leading-[2.2]">
        <span className="text-[#ccc]">Require</span>
        <select
          value={rule.occurrenceType}
          onChange={(e) => onUpdate(index, { occurrenceType: parseInt(e.target.value) as 0 | 1 | 2 })}
          className="rounded border border-[#444] bg-[#1a1a2e] px-2.5 py-1 text-[13px] text-[#2DD4BF] outline-none"
        >
          <option value={2}>at least</option>
          <option value={1}>at most</option>
          <option value={0}>exactly</option>
        </select>
        <input
          type="number"
          min={0}
          value={rule.occurrenceCount}
          onChange={(e) => onUpdate(index, { occurrenceCount: Math.max(0, parseInt(e.target.value) || 0) })}
          className="w-[40px] rounded border border-[#444] bg-[#1a1a2e] px-2 py-1 text-center text-[13px] text-[#C9A227] outline-none focus:border-[#C9A227]"
        />
        <select
          value={rule.domain}
          onChange={(e) => onUpdate(index, { domain: e.target.value as DomainCriterionType })}
          className="rounded border border-[#444] bg-[#1a1a2e] px-2.5 py-1 text-[13px] text-[#2DD4BF] outline-none"
        >
          {Object.entries(DOMAIN_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <span className="text-[#ccc]">of</span>
        <span className="rounded border border-[rgba(201,162,39,0.3)] bg-[rgba(201,162,39,0.15)] px-2.5 py-1 text-[13px] text-[#C9A227]">
          {primaryConceptName}
        </span>
      </div>

      {/* Concept picker (collapsed) */}
      <div className="mt-3">
        <WizardConceptPicker
          concepts={rule.concepts}
          onAdd={(concept, domain) => onAddConcept(index, concept, domain)}
          onRemove={(conceptId) => onRemoveConcept(index, conceptId)}
        />
      </div>

      {/* Temporal */}
      <div className="mt-3">
        <div className="mb-2 text-[12px] text-[#888]">Occurring:</div>
        <TemporalPresetPicker
          value={rule.temporalWindow}
          onChange={(window) => onUpdate(index, { temporalWindow: window })}
        />
      </div>

      {/* Restrict to same visit */}
      <div className="mt-3">
        <label className="flex items-center gap-2 text-[12px] text-[#888]">
          <input
            type="checkbox"
            checked={rule.restrictVisit}
            onChange={(e) => onUpdate(index, { restrictVisit: e.target.checked })}
            className="accent-[#2DD4BF]"
          />
          Restrict to same visit
        </label>
      </div>

      {/* Live preview */}
      <div className="mt-3 rounded-md border border-[rgba(201,162,39,0.15)] bg-[rgba(201,162,39,0.05)] px-3 py-2">
        <span className="text-[11px] text-[#666]">READS AS: </span>
        <span className="text-[13px] text-[#ccc]">
          "Require {OCCURRENCE_LABELS[rule.occurrenceType]} {rule.occurrenceCount}{" "}
          {DOMAIN_LABELS[rule.domain]} of{" "}
          <strong className="text-[#C9A227]">{primaryConceptName}</strong>{" "}
          {describeWindow(rule.temporalWindow)}"
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Implement InclusionRulesStep**

```typescript
// frontend/src/features/cohort-definitions/components/wizard/InclusionRulesStep.tsx
import { Plus } from "lucide-react";
import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { InclusionRuleSentence } from "./InclusionRuleSentence";

export function InclusionRulesStep() {
  const {
    inclusionRules,
    inclusionLogic,
    addInclusionRule,
    removeInclusionRule,
    updateInclusionRule,
    addInclusionRuleConcept,
    removeInclusionRuleConcept,
    setInclusionLogic,
  } = useCohortWizardStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-[#ccc]">
          Step 1 of 3 — Inclusion Rules{" "}
          <span className="text-[11px] text-[#555]">(optional)</span>
        </div>
        <p className="text-[13px] text-[#888]">
          What additional requirements must a patient meet to stay in the cohort?
        </p>
      </div>

      {/* Boolean logic toggle */}
      {inclusionRules.length > 1 && (
        <div className="flex items-center gap-2 rounded-lg border border-[#2a2a3a] bg-[#0E0E11] p-3">
          <span className="text-[13px] text-[#ccc]">Patient must match</span>
          <div className="inline-flex overflow-hidden rounded-md border border-[#333]">
            {(["ALL", "ANY", "NONE"] as const).map((logic) => (
              <button
                key={logic}
                type="button"
                onClick={() => setInclusionLogic(logic)}
                className={`border-l border-[#333] px-3 py-1 text-[12px] first:border-l-0 ${
                  inclusionLogic === logic
                    ? "bg-[#2DD4BF] font-semibold text-[#0E0E11]"
                    : "text-[#888] hover:text-[#ccc]"
                }`}
              >
                {logic}
              </button>
            ))}
          </div>
          <span className="text-[13px] text-[#ccc]">of these rules:</span>
        </div>
      )}

      {/* Rules */}
      <div className="flex flex-col gap-3">
        {inclusionRules.map((rule, index) => (
          <InclusionRuleSentence
            key={index}
            rule={rule}
            index={index}
            onUpdate={updateInclusionRule}
            onAddConcept={addInclusionRuleConcept}
            onRemoveConcept={removeInclusionRuleConcept}
            onRemove={removeInclusionRule}
          />
        ))}
      </div>

      {/* Add rule */}
      <button
        type="button"
        onClick={addInclusionRule}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[#333] py-2.5 text-[12px] text-[#888] transition-colors hover:border-[#555] hover:text-[#ccc]"
      >
        <Plus size={14} />
        Add inclusion rule
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Implement DemographicsStep**

```typescript
// frontend/src/features/cohort-definitions/components/wizard/DemographicsStep.tsx
import { useCohortWizardStore } from "../../stores/cohortWizardStore";

const GENDER_OPTIONS = [
  { conceptId: 8507, label: "Male" },
  { conceptId: 8532, label: "Female" },
] as const;

const RACE_OPTIONS = [
  { conceptId: 8527, label: "White" },
  { conceptId: 8516, label: "Black or African American" },
  { conceptId: 8515, label: "Asian" },
  { conceptId: 8557, label: "Native Hawaiian or Other Pacific Islander" },
  { conceptId: 8657, label: "American Indian or Alaska Native" },
] as const;

const ETHNICITY_OPTIONS = [
  { conceptId: 38003563, label: "Hispanic or Latino" },
  { conceptId: 38003564, label: "Not Hispanic or Latino" },
] as const;

export function DemographicsStep() {
  const { demographics, setDemographics } = useCohortWizardStore();

  const ageMin = demographics?.Age?.Value ?? "";
  const ageMax = demographics?.Age?.Extent ?? "";
  const genders = demographics?.Gender ?? [];
  const races = demographics?.Race ?? [];
  const ethnicities = demographics?.Ethnicity ?? [];

  const updateField = (
    field: "Age" | "Gender" | "Race" | "Ethnicity",
    value: unknown,
  ) => {
    const current = demographics ?? {};
    setDemographics({ ...current, [field]: value } as typeof demographics);
  };

  const toggleInArray = (arr: number[], id: number): number[] =>
    arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-[#ccc]">
          Step 2 of 3 — Demographics{" "}
          <span className="text-[11px] text-[#555]">(optional)</span>
        </div>
        <p className="text-[13px] text-[#888]">
          Any age, gender, race, or ethnicity restrictions?
        </p>
      </div>

      <div className="rounded-lg border border-[#2a2a3a] bg-[#0E0E11] p-4">
        <div className="flex flex-col gap-5">
          {/* Age */}
          <div>
            <label className="mb-2 block text-[12px] font-medium text-[#ccc]">
              Age Range
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={120}
                placeholder="Min"
                value={ageMin}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : undefined;
                  updateField("Age", val !== undefined
                    ? { Value: val, Op: "bt" as const, Extent: typeof ageMax === "number" ? ageMax : undefined }
                    : undefined,
                  );
                }}
                className="w-[80px] rounded-md border border-[#444] bg-[#1a1a2e] px-3 py-2 text-center text-[13px] text-[#C9A227] outline-none focus:border-[#C9A227]"
              />
              <span className="text-[13px] text-[#888]">to</span>
              <input
                type="number"
                min={0}
                max={120}
                placeholder="Max"
                value={ageMax}
                onChange={(e) => {
                  const val = e.target.value ? parseInt(e.target.value) : undefined;
                  const min = typeof ageMin === "number" ? ageMin : 0;
                  updateField("Age", val !== undefined || typeof ageMin === "number"
                    ? { Value: min, Op: "bt" as const, Extent: val }
                    : undefined,
                  );
                }}
                className="w-[80px] rounded-md border border-[#444] bg-[#1a1a2e] px-3 py-2 text-center text-[13px] text-[#C9A227] outline-none focus:border-[#C9A227]"
              />
              <span className="text-[13px] text-[#888]">years</span>
            </div>
          </div>

          {/* Gender */}
          <div>
            <label className="mb-2 block text-[12px] font-medium text-[#ccc]">
              Gender
            </label>
            <div className="flex gap-2">
              {GENDER_OPTIONS.map((g) => (
                <button
                  key={g.conceptId}
                  type="button"
                  onClick={() => updateField("Gender", toggleInArray(genders, g.conceptId))}
                  className={`rounded-md px-4 py-1.5 text-[12px] transition-colors ${
                    genders.includes(g.conceptId)
                      ? "bg-[#2DD4BF] font-medium text-[#0E0E11]"
                      : "border border-[#333] text-[#888] hover:border-[#555]"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          {/* Race */}
          <div>
            <label className="mb-2 block text-[12px] font-medium text-[#ccc]">
              Race
            </label>
            <div className="flex flex-wrap gap-2">
              {RACE_OPTIONS.map((r) => (
                <label
                  key={r.conceptId}
                  className="flex items-center gap-1.5 text-[12px] text-[#888]"
                >
                  <input
                    type="checkbox"
                    checked={races.includes(r.conceptId)}
                    onChange={() => updateField("Race", toggleInArray(races, r.conceptId))}
                    className="accent-[#2DD4BF]"
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>

          {/* Ethnicity */}
          <div>
            <label className="mb-2 block text-[12px] font-medium text-[#ccc]">
              Ethnicity
            </label>
            <div className="flex flex-wrap gap-2">
              {ETHNICITY_OPTIONS.map((e) => (
                <label
                  key={e.conceptId}
                  className="flex items-center gap-1.5 text-[12px] text-[#888]"
                >
                  <input
                    type="checkbox"
                    checked={ethnicities.includes(e.conceptId)}
                    onChange={() => updateField("Ethnicity", toggleInArray(ethnicities, e.conceptId))}
                    className="accent-[#2DD4BF]"
                  />
                  {e.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Implement RiskScoresStep**

```typescript
// frontend/src/features/cohort-definitions/components/wizard/RiskScoresStep.tsx
import { Plus, X } from "lucide-react";
import { useCohortWizardStore } from "../../stores/cohortWizardStore";

export function RiskScoresStep() {
  const { riskScores, addRiskScore, removeRiskScore } = useCohortWizardStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-[#ccc]">
          Step 3 of 3 — Risk Scores{" "}
          <span className="text-[11px] text-[#555]">(optional)</span>
        </div>
        <p className="text-[13px] text-[#888]">
          Filter by any pre-computed clinical risk scores?
        </p>
      </div>

      {riskScores.length > 0 && (
        <div className="flex flex-col gap-2">
          {riskScores.map((rs, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-md border border-[#2a2a3a] bg-[#0E0E11] px-3 py-2"
            >
              <span className="text-[13px] text-[#ccc]">
                {rs.scoreName} {rs.operator} {rs.value}
                {rs.tier && ` (Tier: ${rs.tier})`}
              </span>
              <button
                type="button"
                onClick={() => removeRiskScore(i)}
                className="text-[#444] hover:text-[#E85A6B]"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-[rgba(201,162,39,0.15)] bg-[rgba(201,162,39,0.05)] px-4 py-3">
        <span className="text-[#C9A227]">💡</span>{" "}
        <span className="text-[13px] text-[#999]">
          <strong className="text-[#C9A227]">Note:</strong> Risk score filtering requires
          pre-computed risk scores from a completed analysis. If no risk score analyses have
          been run, this step can be skipped. You can add risk score criteria later in the
          Advanced Editor.
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 7: Commit**

```bash
git add frontend/src/features/cohort-definitions/components/wizard/TemporalPresetPicker.tsx \
        frontend/src/features/cohort-definitions/components/wizard/InclusionRuleSentence.tsx \
        frontend/src/features/cohort-definitions/components/wizard/InclusionRulesStep.tsx \
        frontend/src/features/cohort-definitions/components/wizard/DemographicsStep.tsx \
        frontend/src/features/cohort-definitions/components/wizard/RiskScoresStep.tsx
git commit -m "feat(cohort-wizard): implement Chapter 3 — Refine & Filter (inclusion rules, demographics, risk scores)"
```

---

## Task 8: Chapter 4 — Follow-up & Exit

**Files:**
- Modify: `frontend/src/features/cohort-definitions/components/wizard/EndStrategyStep.tsx`
- Modify: `frontend/src/features/cohort-definitions/components/wizard/CensoringStep.tsx`

- [ ] **Step 1: Implement EndStrategyStep**

```typescript
// frontend/src/features/cohort-definitions/components/wizard/EndStrategyStep.tsx
import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { WizardConceptPicker } from "./WizardConceptPicker";
import type { WizardEndStrategy } from "../../utils/buildExpression";

export function EndStrategyStep() {
  const { endStrategy, setEndStrategy } = useCohortWizardStore();

  const setType = (type: WizardEndStrategy["type"]) => {
    if (type === "observation") {
      setEndStrategy({ type: "observation" });
    } else if (type === "fixed") {
      setEndStrategy({ type: "fixed", fixedDays: 365, fixedDateField: "StartDate" });
    } else {
      setEndStrategy({ type: "drug_era", drugConcepts: [], gapDays: 30, offset: 0 });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-[#ccc]">
          Step 1 of 2 — End Strategy
        </div>
        <p className="text-[13px] text-[#888]">
          When does a patient's cohort membership end?
        </p>
      </div>

      <div className="flex flex-col gap-3">
        {/* Observation Period End */}
        <button
          type="button"
          onClick={() => setType("observation")}
          className={`rounded-lg p-4 text-left transition-colors ${
            endStrategy.type === "observation"
              ? "border-2 border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.05)]"
              : "border border-[#333] bg-[#1a1a2e] hover:border-[#555]"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`flex h-[18px] w-[18px] items-center justify-center rounded-full ${endStrategy.type === "observation" ? "bg-[#2DD4BF]" : "border border-[#555]"}`}>
              {endStrategy.type === "observation" && <div className="h-2 w-2 rounded-full bg-[#0E0E11]" />}
            </div>
            <span className="text-[13px] font-medium text-[#ccc]">End of continuous observation</span>
            <span className="rounded bg-[rgba(45,212,191,0.15)] px-1.5 py-0.5 text-[10px] text-[#2DD4BF]">recommended</span>
          </div>
          <p className="mt-1.5 ml-[26px] text-[12px] text-[#888]">
            Follow until the patient leaves the database (end of insurance enrollment, transfer out, etc.). Most common choice.
          </p>
        </button>

        {/* Fixed Duration */}
        <button
          type="button"
          onClick={() => setType("fixed")}
          className={`rounded-lg p-4 text-left transition-colors ${
            endStrategy.type === "fixed"
              ? "border-2 border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.05)]"
              : "border border-[#333] bg-[#1a1a2e] hover:border-[#555]"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`flex h-[18px] w-[18px] items-center justify-center rounded-full ${endStrategy.type === "fixed" ? "bg-[#2DD4BF]" : "border border-[#555]"}`}>
              {endStrategy.type === "fixed" && <div className="h-2 w-2 rounded-full bg-[#0E0E11]" />}
            </div>
            <span className="text-[13px] font-medium text-[#ccc]">Fixed duration after entry</span>
          </div>
          <p className="mt-1.5 ml-[26px] text-[12px] text-[#888]">
            Follow for exactly N days from the entry event.
          </p>
          {endStrategy.type === "fixed" && (
            <div className="mt-3 ml-[26px] flex items-center gap-2">
              <span className="text-[12px] text-[#888]">Follow for</span>
              <input
                type="number"
                min={1}
                value={endStrategy.fixedDays ?? 365}
                onChange={(e) => setEndStrategy({ ...endStrategy, fixedDays: Math.max(1, parseInt(e.target.value) || 365) })}
                className="w-[70px] rounded border border-[#444] bg-[#0E0E11] px-2 py-1 text-center text-[13px] text-[#C9A227] outline-none focus:border-[#C9A227]"
              />
              <span className="text-[12px] text-[#888]">days</span>
            </div>
          )}
        </button>

        {/* Drug Era */}
        <button
          type="button"
          onClick={() => setType("drug_era")}
          className={`rounded-lg p-4 text-left transition-colors ${
            endStrategy.type === "drug_era"
              ? "border-2 border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.05)]"
              : "border border-[#333] bg-[#1a1a2e] hover:border-[#555]"
          }`}
        >
          <div className="flex items-center gap-2">
            <div className={`flex h-[18px] w-[18px] items-center justify-center rounded-full ${endStrategy.type === "drug_era" ? "bg-[#2DD4BF]" : "border border-[#555]"}`}>
              {endStrategy.type === "drug_era" && <div className="h-2 w-2 rounded-full bg-[#0E0E11]" />}
            </div>
            <span className="text-[13px] font-medium text-[#ccc]">While on medication</span>
          </div>
          <p className="mt-1.5 ml-[26px] text-[12px] text-[#888]">
            Follow as long as the patient continues a drug. Membership ends when the drug era ends.
          </p>
          {endStrategy.type === "drug_era" && (
            <div className="mt-3 ml-[26px] flex flex-col gap-3" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-2">
                <span className="min-w-[120px] text-[12px] text-[#888]">Gap tolerance:</span>
                <input
                  type="number"
                  min={0}
                  value={endStrategy.gapDays ?? 30}
                  onChange={(e) => setEndStrategy({ ...endStrategy, gapDays: Math.max(0, parseInt(e.target.value) || 0) })}
                  className="w-[60px] rounded border border-[#444] bg-[#0E0E11] px-2 py-1 text-center text-[13px] text-[#C9A227] outline-none focus:border-[#C9A227]"
                />
                <span className="text-[12px] text-[#888]">days between fills</span>
              </div>
              <WizardConceptPicker
                concepts={endStrategy.drugConcepts ?? []}
                onAdd={(concept, domain) =>
                  setEndStrategy({
                    ...endStrategy,
                    drugConcepts: [
                      ...(endStrategy.drugConcepts ?? []),
                      { concept, domain, includeDescendants: true, includeMapped: false, firstOccurrenceOnly: false },
                    ],
                  })
                }
                onRemove={(conceptId) =>
                  setEndStrategy({
                    ...endStrategy,
                    drugConcepts: (endStrategy.drugConcepts ?? []).filter((c) => c.concept.concept_id !== conceptId),
                  })
                }
                prompt="Search for drug..."
              />
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Implement CensoringStep**

```typescript
// frontend/src/features/cohort-definitions/components/wizard/CensoringStep.tsx
import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { WizardConceptPicker } from "./WizardConceptPicker";

export function CensoringStep() {
  const { censoringConcepts, addCensoringConcept, removeCensoringConcept } =
    useCohortWizardStore();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-[#ccc]">
          Step 2 of 2 — Censoring Events{" "}
          <span className="text-[11px] text-[#555]">(optional)</span>
        </div>
        <p className="text-[13px] text-[#888]">
          Are there specific events that should end a patient's follow-up early? For example,
          death, organ transplant, or switching to a different treatment.
        </p>
      </div>

      <WizardConceptPicker
        concepts={censoringConcepts}
        onAdd={(concept, domain) => addCensoringConcept(concept, domain)}
        onRemove={removeCensoringConcept}
        prompt="Search for censoring events..."
      />
    </div>
  );
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/cohort-definitions/components/wizard/EndStrategyStep.tsx \
        frontend/src/features/cohort-definitions/components/wizard/CensoringStep.tsx
git commit -m "feat(cohort-wizard): implement Chapter 4 — Follow-up & Exit (end strategy, censoring)"
```

---

## Task 9: Chapter 5 — Specialized Criteria + Chapter 6 — Review & Generate

**Files:**
- Modify: `frontend/src/features/cohort-definitions/components/wizard/SpecializedChapter.tsx`
- Create: `frontend/src/features/cohort-definitions/components/wizard/CohortSummary.tsx`
- Modify: `frontend/src/features/cohort-definitions/components/wizard/ReviewStep.tsx`
- Modify: `frontend/src/features/cohort-definitions/components/wizard/GenerateStep.tsx`
- Modify: `frontend/src/features/cohort-definitions/components/wizard/HandoffStep.tsx`

- [ ] **Step 1: Implement SpecializedChapter**

```typescript
// frontend/src/features/cohort-definitions/components/wizard/SpecializedChapter.tsx
import { Dna, ScanLine, SkipForward } from "lucide-react";
import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { GenomicCriteriaPanel } from "@/features/genomics/components/GenomicCriteriaPanel";
import { ImagingCriteriaPanel } from "@/features/imaging/components/ImagingCriteriaPanel";

export function SpecializedChapter() {
  const {
    selectedSpecialized,
    setSelectedSpecialized,
    genomicCriteria,
    imagingCriteria,
    addGenomicCriterion,
    removeGenomicCriterion,
    addImagingCriterion,
    removeImagingCriterion,
    goNext,
  } = useCohortWizardStore();

  const toggleSpecialized = (type: "genomic" | "imaging") => {
    if (selectedSpecialized.includes(type)) {
      setSelectedSpecialized(selectedSpecialized.filter((s) => s !== type));
    } else {
      setSelectedSpecialized([...selectedSpecialized, type]);
    }
  };

  const hasSelected = selectedSpecialized.length > 0;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-[#ccc]">
          Specialized Criteria{" "}
          <span className="text-[11px] text-[#555]">(optional)</span>
        </div>
        <p className="text-[13px] text-[#888]">
          Do you need any specialized criteria for this cohort?
        </p>
      </div>

      {/* Opt-in cards */}
      <div className="grid grid-cols-3 gap-3">
        <button
          type="button"
          onClick={() => toggleSpecialized("genomic")}
          className={`rounded-lg p-4 text-center transition-colors ${
            selectedSpecialized.includes("genomic")
              ? "border-2 border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.05)]"
              : "border border-[#333] bg-[#1a1a2e] hover:border-[#555]"
          }`}
        >
          <Dna size={24} className="mx-auto mb-1.5 text-[#A78BFA]" />
          <div className="text-[13px] font-medium text-[#ccc]">Genomic</div>
          <div className="mt-1 text-[11px] text-[#666]">Gene mutations, TMB, MSI, fusions</div>
        </button>

        <button
          type="button"
          onClick={() => toggleSpecialized("imaging")}
          className={`rounded-lg p-4 text-center transition-colors ${
            selectedSpecialized.includes("imaging")
              ? "border-2 border-[rgba(45,212,191,0.3)] bg-[rgba(45,212,191,0.05)]"
              : "border border-[#333] bg-[#1a1a2e] hover:border-[#555]"
          }`}
        >
          <ScanLine size={24} className="mx-auto mb-1.5 text-[#60A5FA]" />
          <div className="text-[13px] font-medium text-[#ccc]">Imaging</div>
          <div className="mt-1 text-[11px] text-[#666]">Modality, anatomy, AI classification</div>
        </button>

        <button
          type="button"
          onClick={goNext}
          className="rounded-lg border border-[rgba(45,212,191,0.15)] bg-[rgba(45,212,191,0.05)] p-4 text-center transition-colors hover:border-[rgba(45,212,191,0.3)]"
        >
          <SkipForward size={24} className="mx-auto mb-1.5 text-[#2DD4BF]" />
          <div className="text-[13px] font-medium text-[#2DD4BF]">Skip</div>
          <div className="mt-1 text-[11px] text-[#666]">No specialized criteria needed</div>
        </button>
      </div>

      {/* Genomic panel */}
      {selectedSpecialized.includes("genomic") && (
        <div className="rounded-lg border border-[#2a2a3a] bg-[#0E0E11] p-4">
          <h4 className="mb-3 text-[13px] font-medium text-[#A78BFA]">Genomic Criteria</h4>
          {genomicCriteria.map((gc, i) => (
            <div key={i} className="mb-2 flex items-center justify-between rounded-md border border-[#2a2a3a] bg-[#1a1a2e] px-3 py-2">
              <span className="text-[12px] text-[#ccc]">{gc.label}</span>
              <button type="button" onClick={() => removeGenomicCriterion(i)} className="text-[#444] hover:text-[#E85A6B]">✕</button>
            </div>
          ))}
          <GenomicCriteriaPanel onAdd={addGenomicCriterion} onCancel={() => {}} />
        </div>
      )}

      {/* Imaging panel */}
      {selectedSpecialized.includes("imaging") && (
        <div className="rounded-lg border border-[#2a2a3a] bg-[#0E0E11] p-4">
          <h4 className="mb-3 text-[13px] font-medium text-[#60A5FA]">Imaging Criteria</h4>
          {imagingCriteria.map((ic, i) => (
            <div key={i} className="mb-2 flex items-center justify-between rounded-md border border-[#2a2a3a] bg-[#1a1a2e] px-3 py-2">
              <span className="text-[12px] text-[#ccc]">{ic.label}</span>
              <button type="button" onClick={() => removeImagingCriterion(i)} className="text-[#444] hover:text-[#E85A6B]">✕</button>
            </div>
          ))}
          <ImagingCriteriaPanel onAdd={addImagingCriterion} onCancel={() => {}} />
        </div>
      )}

      {/* Data availability warning */}
      {hasSelected && (
        <div className="rounded-lg border border-[rgba(201,162,39,0.15)] bg-[rgba(201,162,39,0.05)] px-4 py-3">
          <span className="text-[#C9A227]">💡</span>{" "}
          <span className="text-[11px] text-[#999]">
            These criteria require specialized data in your CDM (oncology extension tables, DICOM imaging series). If your data source doesn't have them, these filters will return zero patients.
          </span>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create CohortSummary**

```typescript
// frontend/src/features/cohort-definitions/components/wizard/CohortSummary.tsx
import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { describeWindow } from "../../utils/temporalPresets";

const OCCURRENCE_LABELS: Record<number, string> = { 0: "exactly", 1: "at most", 2: "at least" };
const DOMAIN_LABELS: Record<string, string> = {
  ConditionOccurrence: "condition", DrugExposure: "drug exposure", ProcedureOccurrence: "procedure",
  Measurement: "measurement", Observation: "observation", VisitOccurrence: "visit", Death: "death",
};

export function CohortSummary() {
  const s = useCohortWizardStore();

  const entryNames = s.entryConcepts.map((e) => e.concept.concept_name);
  const hasDescendants = s.entryConcepts.some((e) => e.includeDescendants);

  return (
    <div className="rounded-lg bg-[#1a1a2e] p-4 text-[13px] leading-[1.8] text-[#ccc]">
      <div className="mb-2 text-[11px] uppercase tracking-wider text-[#666]">
        Your cohort definition reads as:
      </div>

      {/* Entry */}
      <div>
        Patients with{" "}
        <strong className="text-[#C9A227]">{entryNames.join(", ") || "(no entry events)"}</strong>
        {hasDescendants && <span className="text-[#888]"> (or any sub-type)</span>}
        {", "}
        <span className="text-[#666]">
          using {s.qualifiedLimit.toLowerCase()} qualifying event
          {s.qualifiedLimit === "All" ? "s" : ""}
        </span>
        {","}
      </div>

      {/* Inclusion rules */}
      {s.inclusionRules.map((rule, i) => {
        const conceptName = rule.concepts[0]?.concept.concept_name ?? "...";
        const isExclusion = rule.occurrenceType === 0 && rule.occurrenceCount === 0;
        return (
          <div key={i}>
            {isExclusion ? (
              <>
                and do <strong className="text-[#E85A6B]">NOT</strong> have{" "}
                <strong className="text-[#C9A227]">{conceptName}</strong>{" "}
                {describeWindow(rule.temporalWindow)}
              </>
            ) : (
              <>
                who have{" "}
                <strong className="text-[#C9A227]">
                  {OCCURRENCE_LABELS[rule.occurrenceType]} {rule.occurrenceCount}{" "}
                  {DOMAIN_LABELS[rule.domain] ?? rule.domain} of {conceptName}
                </strong>{" "}
                {describeWindow(rule.temporalWindow)}
              </>
            )}
            {","}
          </div>
        );
      })}

      {/* Demographics */}
      {s.demographics?.Age && (
        <div>
          aged <strong className="text-[#C9A227]">{s.demographics.Age.Value}–{s.demographics.Age.Extent ?? "∞"}</strong>,
        </div>
      )}

      {/* End strategy */}
      <div>
        followed until{" "}
        <strong className="text-[#C9A227]">
          {s.endStrategy.type === "observation" && "end of continuous observation"}
          {s.endStrategy.type === "fixed" && `${s.endStrategy.fixedDays} days after entry`}
          {s.endStrategy.type === "drug_era" && `drug era ends (${s.endStrategy.drugConcepts?.[0]?.concept.concept_name ?? "..."})`}
        </strong>
        {","}
      </div>

      {/* Censoring */}
      {s.censoringConcepts.length > 0 && (
        <div>
          censored at{" "}
          <strong className="text-[#C9A227]">
            {s.censoringConcepts.map((c) => c.concept.concept_name).join(", ")}
          </strong>
          .
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Implement ReviewStep**

```typescript
// frontend/src/features/cohort-definitions/components/wizard/ReviewStep.tsx
import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { CohortSummary } from "./CohortSummary";

export function ReviewStep() {
  const { setChapter, entryConcepts, name } = useCohortWizardStore();

  const errors: string[] = [];
  if (!name) errors.push("Cohort name is required (Chapter 1)");
  if (entryConcepts.length === 0) errors.push("At least one entry event is required (Chapter 2)");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-[#ccc]">
          Step 1 of 3 — Review Your Cohort
        </div>
      </div>

      <CohortSummary />

      {/* Edit shortcuts */}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setChapter(2)} className="rounded border border-[#333] px-2.5 py-1 text-[11px] text-[#888] hover:border-[#555] hover:text-[#ccc]">
          ✏️ Edit Population
        </button>
        <button type="button" onClick={() => setChapter(3)} className="rounded border border-[#333] px-2.5 py-1 text-[11px] text-[#888] hover:border-[#555] hover:text-[#ccc]">
          ✏️ Edit Rules
        </button>
        <button type="button" onClick={() => setChapter(4)} className="rounded border border-[#333] px-2.5 py-1 text-[11px] text-[#888] hover:border-[#555] hover:text-[#ccc]">
          ✏️ Edit Follow-up
        </button>
      </div>

      {/* Validation errors */}
      {errors.length > 0 && (
        <div className="rounded-lg border border-[rgba(155,27,48,0.3)] bg-[rgba(155,27,48,0.05)] px-4 py-3">
          <div className="mb-1 text-[12px] font-medium text-[#E85A6B]">Cannot generate — fix these issues:</div>
          <ul className="list-inside list-disc text-[12px] text-[#E85A6B]">
            {errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Implement GenerateStep**

```typescript
// frontend/src/features/cohort-definitions/components/wizard/GenerateStep.tsx
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useCohortWizardStore } from "../../stores/cohortWizardStore";
import { useCreateCohortDefinition } from "../../hooks/useCohortDefinitions";
import { useGenerateCohort, useCohortGeneration } from "../../hooks/useCohortGeneration";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";

export function GenerateStep() {
  const store = useCohortWizardStore();
  const [sourceId, setSourceId] = useState<number | null>(null);
  const [createdId, setCreatedId] = useState<number | null>(null);
  const [genId, setGenId] = useState<number | null>(null);

  const { data: sources, isLoading: loadingSources } = useQuery({
    queryKey: ["sources"],
    queryFn: fetchSources,
  });

  const createMutation = useCreateCohortDefinition();
  const generateMutation = useGenerateCohort();
  const { data: generation } = useCohortGeneration(createdId, genId);

  const handleGenerate = () => {
    if (!sourceId) return;

    const expression = store.buildExpression();

    // Create the cohort first, then generate
    createMutation.mutate(
      {
        name: store.name,
        description: store.description,
        expression_json: expression,
      },
      {
        onSuccess: (def) => {
          setCreatedId(def.id);
          generateMutation.mutate(
            { defId: def.id, sourceId },
            { onSuccess: (gen) => setGenId(gen.id) },
          );
        },
      },
    );
  };

  const isRunning = createMutation.isPending || generateMutation.isPending ||
    (generation && ["running", "queued", "pending"].includes(generation.status));

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-[#ccc]">
          Step 2 of 3 — Generate Cohort
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="text-[13px] text-[#888]">Run against:</span>
        <select
          value={sourceId ?? ""}
          onChange={(e) => setSourceId(e.target.value ? parseInt(e.target.value) : null)}
          className="rounded-md border border-[#444] bg-[#1a1a2e] px-3 py-1.5 text-[13px] text-[#ccc] outline-none focus:border-[#C9A227]"
          disabled={loadingSources}
        >
          <option value="">Select data source...</option>
          {(sources ?? []).map((s: { id: number; source_name: string }) => (
            <option key={s.id} value={s.id}>{s.source_name}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!sourceId || isRunning || !store.name || store.entryConcepts.length === 0}
          className="flex items-center gap-1.5 rounded-md bg-[#C9A227] px-4 py-1.5 text-[13px] font-semibold text-[#0E0E11] transition-colors hover:bg-[#B8922A] disabled:opacity-50"
        >
          {isRunning && <Loader2 size={14} className="animate-spin" />}
          Generate
        </button>
      </div>

      {/* Results */}
      {generation?.status === "completed" && (
        <div className="rounded-lg border border-[rgba(45,212,191,0.15)] bg-[rgba(45,212,191,0.05)] p-4">
          <div className="flex items-center gap-3">
            <div className="text-center">
              <div className="text-[28px] font-bold text-[#2DD4BF]">
                {generation.person_count?.toLocaleString() ?? 0}
              </div>
              <div className="text-[11px] text-[#888]">patients</div>
            </div>
          </div>
        </div>
      )}

      {generation?.status === "failed" && (
        <div className="rounded-lg border border-[rgba(155,27,48,0.3)] bg-[rgba(155,27,48,0.05)] px-4 py-3 text-[13px] text-[#E85A6B]">
          Generation failed. Check the expression and try again.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Implement HandoffStep**

```typescript
// frontend/src/features/cohort-definitions/components/wizard/HandoffStep.tsx
import { useNavigate } from "react-router-dom";
import { Check, Wrench, BarChart3 } from "lucide-react";

interface HandoffStepProps {
  createdId?: number | null;
}

export function HandoffStep() {
  const navigate = useNavigate();

  // The createdId would come from GenerateStep. For now we read from URL or store.
  // In practice, the wizard store or a shared state holds the created cohort ID.

  return (
    <div className="flex flex-col gap-4">
      <div>
        <div className="mb-1 text-[13px] font-medium text-[#C9A227]">
          Step 3 of 3 — What's Next?
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={() => navigate("/cohort-definitions")}
          className="rounded-lg border border-[rgba(45,212,191,0.2)] bg-[rgba(45,212,191,0.05)] p-4 text-left transition-colors hover:border-[rgba(45,212,191,0.4)]"
        >
          <div className="flex items-center gap-2 text-[13px] font-medium text-[#2DD4BF]">
            <Check size={16} />
            Done — Save & Close
          </div>
          <p className="mt-1 ml-[24px] text-[12px] text-[#888]">
            Cohort is saved and ready for use in analyses and studies.
          </p>
        </button>

        <button
          type="button"
          onClick={() => {
            // Navigate to the created cohort's detail page
            // createdId would be set by GenerateStep
            navigate("/cohort-definitions");
          }}
          className="rounded-lg border border-[rgba(201,162,39,0.2)] bg-[rgba(201,162,39,0.05)] p-4 text-left transition-colors hover:border-[rgba(201,162,39,0.4)]"
        >
          <div className="flex items-center gap-2 text-[13px] font-medium text-[#C9A227]">
            <Wrench size={16} />
            Open in Advanced Editor
          </div>
          <p className="mt-1 ml-[24px] text-[12px] text-[#888]">
            Fine-tune with the full expression editor. Supports nested boolean logic, custom temporal windows, and all advanced features.
          </p>
          <div className="mt-2 ml-[24px] rounded bg-[#1a1a2e] p-2.5 text-[11px] text-[#666]">
            <strong className="text-[#888]">Quick orientation:</strong> Your entry events are
            in "Primary Criteria". Inclusion rules are in "Additional Criteria". Demographics,
            risk scores, and specialized criteria each have their own section. All concept sets
            appear in the "Concept Sets" reference panel at the top.
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate("/cohort-definitions")}
          className="rounded-lg border border-[#333] bg-[#1a1a2e] p-4 text-left transition-colors hover:border-[#555]"
        >
          <div className="flex items-center gap-2 text-[13px] font-medium text-[#ccc]">
            <BarChart3 size={16} />
            View Diagnostics
          </div>
          <p className="mt-1 ml-[24px] text-[12px] text-[#888]">
            See attrition chart, patient breakdown by age/gender, and detailed generation statistics.
          </p>
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify TypeScript compiles**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -30`

- [ ] **Step 7: Verify Vite build succeeds**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vite build 2>&1 | tail -15`

- [ ] **Step 8: Commit**

```bash
git add frontend/src/features/cohort-definitions/components/wizard/SpecializedChapter.tsx \
        frontend/src/features/cohort-definitions/components/wizard/CohortSummary.tsx \
        frontend/src/features/cohort-definitions/components/wizard/ReviewStep.tsx \
        frontend/src/features/cohort-definitions/components/wizard/GenerateStep.tsx \
        frontend/src/features/cohort-definitions/components/wizard/HandoffStep.tsx
git commit -m "feat(cohort-wizard): implement Chapter 5 (specialized criteria) and Chapter 6 (review, generate, handoff)"
```

---

## Task 10: Integration — Wire GenerateStep to HandoffStep + Final Polish

**Files:**
- Modify: `frontend/src/features/cohort-definitions/components/wizard/CohortWizard.tsx`
- Modify: `frontend/src/features/cohort-definitions/components/wizard/GenerateStep.tsx`
- Modify: `frontend/src/features/cohort-definitions/components/wizard/HandoffStep.tsx`
- Modify: `frontend/src/features/cohort-definitions/stores/cohortWizardStore.ts`

- [ ] **Step 1: Add createdId to wizard store**

In `cohortWizardStore.ts`, add `createdId: number | null` to the store interface and initial state, with a `setCreatedId` action.

Add to the interface:
```typescript
createdId: number | null;
setCreatedId: (id: number | null) => void;
```

Add to initial state:
```typescript
createdId: null as number | null,
```

Add the action:
```typescript
setCreatedId: (id) => set({ createdId: id }),
```

Include `createdId: null` in the `reset()` spread.

- [ ] **Step 2: Update GenerateStep to save createdId**

In `GenerateStep.tsx`, after `createMutation.mutate` `onSuccess`, add:
```typescript
store.setCreatedId(def.id);
```

Remove the local `createdId` state — use the store instead:
```typescript
const createdId = useCohortWizardStore((s) => s.createdId);
```

- [ ] **Step 3: Update HandoffStep to navigate to created cohort**

In `HandoffStep.tsx`, read `createdId` from the store:
```typescript
const createdId = useCohortWizardStore((s) => s.createdId);
```

Update the "Open in Advanced Editor" button:
```typescript
onClick={() => createdId ? navigate(`/cohort-definitions/${createdId}`) : navigate("/cohort-definitions")}
```

Update the "View Diagnostics" button similarly, adding `?tab=diagnostics` if the detail page supports tab params.

- [ ] **Step 4: Verify full build**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx tsc --noEmit --pretty 2>&1 | head -20`

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx vite build 2>&1 | tail -10`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/cohort-definitions/stores/cohortWizardStore.ts \
        frontend/src/features/cohort-definitions/components/wizard/GenerateStep.tsx \
        frontend/src/features/cohort-definitions/components/wizard/HandoffStep.tsx
git commit -m "feat(cohort-wizard): wire generate-to-handoff flow with shared createdId state"
```

---

## Task 11: Deploy & Verify

- [ ] **Step 1: Run Pint (PHP formatter)**

Run: `docker compose exec -T php sh -c "cd /var/www/html && vendor/bin/pint"` (no PHP changes, but CI runs it)

- [ ] **Step 2: Run ESLint on wizard files**

Run: `cd /home/smudoshi/Github/Parthenon/frontend && npx eslint src/features/cohort-definitions/components/wizard/ src/features/cohort-definitions/stores/cohortWizardStore.ts src/features/cohort-definitions/utils/ --fix 2>&1 | tail -20`

- [ ] **Step 3: Deploy frontend**

Run: `cd /home/smudoshi/Github/Parthenon && ./deploy.sh --frontend`

- [ ] **Step 4: Verify in browser**

1. Navigate to https://parthenon.acumenus.net/cohort-definitions
2. Confirm "Cohort Wizard" button is visible (replaced "New Cohort Definition")
3. Click "Cohort Wizard" — should navigate to `/cohort-definitions/new`
4. Verify sidebar shows 6 chapters
5. Walk through: Basics → Define Population → Refine & Filter → Follow-up → Specialized → Review
6. Verify Back/Next navigation works
7. Verify chapter sidebar highlights active chapter/step

- [ ] **Step 5: Commit any ESLint fixes**

```bash
git add -A && git diff --cached --stat
# If changes exist:
git commit -m "style(cohort-wizard): apply ESLint auto-fixes"
```
