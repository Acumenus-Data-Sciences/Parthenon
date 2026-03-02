import { create } from "zustand";
import type {
  CohortExpression,
  WindowedCriteria,
  DemographicFilter,
  EndStrategy,
  ConceptSetExpression,
  CriteriaGroup,
  DomainCriterionType,
  DomainCriterion,
} from "../types/cohortExpression";

const defaultExpression: CohortExpression = {
  ConceptSets: [],
  PrimaryCriteria: {
    CriteriaList: [],
    ObservationWindow: { PriorDays: 0, PostDays: 0 },
  },
  QualifiedLimit: { Type: "First" },
  ExpressionLimit: { Type: "First" },
  CollapseSettings: { CollapseType: "ERA", EraPad: 0 },
};

interface CohortExpressionStore {
  expression: CohortExpression;
  isDirty: boolean;

  // Concept sets
  addConceptSet: (cs: ConceptSetExpression) => void;
  removeConceptSet: (id: number) => void;
  updateConceptSet: (id: number, cs: ConceptSetExpression) => void;

  // Primary criteria
  addPrimaryCriterion: (
    domain: DomainCriterionType,
    criterion: DomainCriterion,
  ) => void;
  removePrimaryCriterion: (index: number) => void;
  updatePrimaryCriterion: (
    index: number,
    criterion: Partial<Record<DomainCriterionType, DomainCriterion>>,
  ) => void;
  setObservationWindow: (prior: number, post: number) => void;

  // Inclusion criteria
  setAdditionalCriteria: (criteria: CriteriaGroup) => void;
  addInclusionRule: (rule: WindowedCriteria) => void;
  removeInclusionRule: (index: number) => void;
  updateInclusionRule: (index: number, rule: WindowedCriteria) => void;

  // Other
  setCensoringCriteria: (
    criteria: CohortExpression["CensoringCriteria"],
  ) => void;
  setEndStrategy: (strategy: EndStrategy) => void;
  setDemographicCriteria: (filters: DemographicFilter[]) => void;
  setQualifiedLimit: (type: "First" | "All") => void;

  // State
  reset: (expression?: CohortExpression) => void;
  loadExpression: (expression: CohortExpression) => void;
}

export const useCohortExpressionStore = create<CohortExpressionStore>()(
  (set) => ({
    expression: { ...defaultExpression },
    isDirty: false,

    // -----------------------------------------------------------------------
    // Concept sets
    // -----------------------------------------------------------------------
    addConceptSet: (cs) =>
      set((s) => ({
        isDirty: true,
        expression: {
          ...s.expression,
          ConceptSets: [...s.expression.ConceptSets, cs],
        },
      })),

    removeConceptSet: (id) =>
      set((s) => ({
        isDirty: true,
        expression: {
          ...s.expression,
          ConceptSets: s.expression.ConceptSets.filter((c) => c.id !== id),
        },
      })),

    updateConceptSet: (id, cs) =>
      set((s) => ({
        isDirty: true,
        expression: {
          ...s.expression,
          ConceptSets: s.expression.ConceptSets.map((c) =>
            c.id === id ? cs : c,
          ),
        },
      })),

    // -----------------------------------------------------------------------
    // Primary criteria
    // -----------------------------------------------------------------------
    addPrimaryCriterion: (domain, criterion) =>
      set((s) => ({
        isDirty: true,
        expression: {
          ...s.expression,
          PrimaryCriteria: {
            ...s.expression.PrimaryCriteria,
            CriteriaList: [
              ...s.expression.PrimaryCriteria.CriteriaList,
              { [domain]: criterion } as Partial<
                Record<DomainCriterionType, DomainCriterion>
              >,
            ],
          },
        },
      })),

    removePrimaryCriterion: (index) =>
      set((s) => ({
        isDirty: true,
        expression: {
          ...s.expression,
          PrimaryCriteria: {
            ...s.expression.PrimaryCriteria,
            CriteriaList: s.expression.PrimaryCriteria.CriteriaList.filter(
              (_, i) => i !== index,
            ),
          },
        },
      })),

    updatePrimaryCriterion: (index, criterion) =>
      set((s) => ({
        isDirty: true,
        expression: {
          ...s.expression,
          PrimaryCriteria: {
            ...s.expression.PrimaryCriteria,
            CriteriaList: s.expression.PrimaryCriteria.CriteriaList.map(
              (c, i) => (i === index ? criterion : c),
            ),
          },
        },
      })),

    setObservationWindow: (prior, post) =>
      set((s) => ({
        isDirty: true,
        expression: {
          ...s.expression,
          PrimaryCriteria: {
            ...s.expression.PrimaryCriteria,
            ObservationWindow: { PriorDays: prior, PostDays: post },
          },
        },
      })),

    // -----------------------------------------------------------------------
    // Inclusion criteria
    // -----------------------------------------------------------------------
    setAdditionalCriteria: (criteria) =>
      set((s) => ({
        isDirty: true,
        expression: { ...s.expression, AdditionalCriteria: criteria },
      })),

    addInclusionRule: (rule) =>
      set((s) => {
        const existing = s.expression.AdditionalCriteria ?? {
          Type: "ALL" as const,
          CriteriaList: [],
          Groups: [],
        };
        return {
          isDirty: true,
          expression: {
            ...s.expression,
            AdditionalCriteria: {
              ...existing,
              CriteriaList: [...existing.CriteriaList, rule],
            },
          },
        };
      }),

    removeInclusionRule: (index) =>
      set((s) => {
        const existing = s.expression.AdditionalCriteria;
        if (!existing) return s;
        return {
          isDirty: true,
          expression: {
            ...s.expression,
            AdditionalCriteria: {
              ...existing,
              CriteriaList: existing.CriteriaList.filter(
                (_, i) => i !== index,
              ),
            },
          },
        };
      }),

    updateInclusionRule: (index, rule) =>
      set((s) => {
        const existing = s.expression.AdditionalCriteria;
        if (!existing) return s;
        return {
          isDirty: true,
          expression: {
            ...s.expression,
            AdditionalCriteria: {
              ...existing,
              CriteriaList: existing.CriteriaList.map((r, i) =>
                i === index ? rule : r,
              ),
            },
          },
        };
      }),

    // -----------------------------------------------------------------------
    // Other
    // -----------------------------------------------------------------------
    setCensoringCriteria: (criteria) =>
      set((s) => ({
        isDirty: true,
        expression: { ...s.expression, CensoringCriteria: criteria },
      })),

    setEndStrategy: (strategy) =>
      set((s) => ({
        isDirty: true,
        expression: { ...s.expression, EndStrategy: strategy },
      })),

    setDemographicCriteria: (filters) =>
      set((s) => ({
        isDirty: true,
        expression: { ...s.expression, DemographicCriteria: filters },
      })),

    setQualifiedLimit: (type) =>
      set((s) => ({
        isDirty: true,
        expression: {
          ...s.expression,
          QualifiedLimit: { Type: type },
        },
      })),

    // -----------------------------------------------------------------------
    // State management
    // -----------------------------------------------------------------------
    reset: (expression) =>
      set({
        expression: expression ?? { ...defaultExpression },
        isDirty: false,
      }),

    loadExpression: (expression) =>
      set({
        expression,
        isDirty: false,
      }),
  }),
);
