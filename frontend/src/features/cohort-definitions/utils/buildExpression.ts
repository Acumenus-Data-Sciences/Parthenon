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
  _key: string;
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
