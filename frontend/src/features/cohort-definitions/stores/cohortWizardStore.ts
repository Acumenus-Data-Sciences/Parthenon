import { create } from "zustand";
import type { Concept } from "@/features/vocabulary/types/vocabulary";
import type {
  DomainCriterionType,
  DemographicFilter,
  GenomicCriterion,
  ImagingCriterion,
  RiskScoreCriterion,
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
  currentStep: number;
  slideDir: "forward" | "back";

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
  setStep: (step: number) => void;
  goNext: () => void;
  goBack: () => void;
  canProceed: () => boolean;

  // Metadata actions
  setName: (name: string) => void;
  setDescription: (description: string) => void;
  setDomain: (domain: string) => void;
  setTags: (tags: string[]) => void;

  // Chapter 2 actions
  addEntryConcept: (
    concept: Concept,
    domain: DomainCriterionType,
    options?: {
      includeDescendants?: boolean;
      includeMapped?: boolean;
      firstOccurrenceOnly?: boolean;
    },
  ) => void;
  removeEntryConcept: (conceptId: number) => void;
  updateEntryConceptOptions: (
    conceptId: number,
    options: Partial<
      Pick<
        WizardEntryConcept,
        "includeDescendants" | "includeMapped" | "firstOccurrenceOnly"
      >
    >,
  ) => void;
  setObservationWindow: (priorDays: number, postDays: number) => void;
  setQualifiedLimit: (limit: "First" | "All") => void;

  // Chapter 3 actions
  addInclusionRule: () => void;
  removeInclusionRule: (index: number) => void;
  updateInclusionRule: (
    index: number,
    updates: Partial<WizardInclusionRule>,
  ) => void;
  addInclusionRuleConcept: (
    ruleIndex: number,
    concept: Concept,
    domain: DomainCriterionType,
  ) => void;
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

  // Generated cohort ID (set by GenerateStep, consumed by HandoffStep)
  createdId: number | null;
  setCreatedId: (id: number | null) => void;

  // Chapter completion
  getChapterStatus: (chapter: number) => ChapterStatus;

  // Build final expression
  buildExpression: () => CohortExpression;

  // Reset
  reset: () => void;
}

const initialState = {
  currentStep: 0,
  slideDir: "forward" as const,
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
  createdId: null as number | null,
};

export const useCohortWizardStore = create<CohortWizardStore>((set, get) => ({
  ...initialState,

  // --- Navigation ---
  setStep: (step) => {
    const { currentStep } = get();
    set({ currentStep: step, slideDir: step > currentStep ? "forward" : "back" });
  },

  goNext: () => {
    const { currentStep } = get();
    if (currentStep < 5) {
      set({ currentStep: currentStep + 1, slideDir: "forward" });
    }
  },

  goBack: () => {
    const { currentStep } = get();
    if (currentStep > 0) {
      set({ currentStep: currentStep - 1, slideDir: "back" });
    }
  },

  canProceed: () => {
    const s = get();
    switch (s.currentStep) {
      case 0: return s.name.trim() !== "";
      case 1: return s.entryConcepts.length > 0;
      case 2: return true;
      case 3: return true;
      case 4: return true;
      case 5: return true;
      default: return false;
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
          _key: crypto.randomUUID(),
          domain: "ConditionOccurrence" as DomainCriterionType,
          concepts: [],
          occurrenceType: 2 as const, // at least
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
    set((s) => ({ riskScores: [...s.riskScores, { ...criterion, _key: crypto.randomUUID() }] })),

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
      genomicCriteria: [...s.genomicCriteria, { ...criterion, _key: crypto.randomUUID() }],
    })),

  removeGenomicCriterion: (index) =>
    set((s) => ({
      genomicCriteria: s.genomicCriteria.filter((_, i) => i !== index),
    })),

  addImagingCriterion: (criterion) =>
    set((s) => ({
      imagingCriteria: [...s.imagingCriteria, { ...criterion, _key: crypto.randomUUID() }],
    })),

  removeImagingCriterion: (index) =>
    set((s) => ({
      imagingCriteria: s.imagingCriteria.filter((_, i) => i !== index),
    })),

  // --- Chapter completion ---
  getChapterStatus: (chapter) => {
    const s = get();
    switch (chapter) {
      case 0:
        if (!s.name) return "pending";
        return "complete";
      case 1:
        if (s.entryConcepts.length === 0) return "pending";
        return "complete";
      case 2:
        return s.inclusionRules.length > 0 ||
          s.demographics ||
          s.riskScores.length > 0
          ? "complete"
          : "pending";
      case 3:
        return "complete"; // Always valid (observation period is default)
      case 4:
        return "complete"; // Always valid (optional)
      case 5:
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

  // --- createdId ---
  setCreatedId: (id) => set({ createdId: id }),

  // --- Reset ---
  reset: () => set(initialState),
}));
