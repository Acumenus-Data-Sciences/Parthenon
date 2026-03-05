// ---------------------------------------------------------------------------
// Cohort Expression Types — matches OHDSI Atlas PascalCase format
// ---------------------------------------------------------------------------

// Concept set reference within a cohort expression
export interface ConceptSetExpression {
  id: number; // Local index (0, 1, 2...)
  name: string;
  expression: {
    items: ConceptSetExpressionItem[];
  };
}

export interface ConceptSetExpressionItem {
  concept: {
    CONCEPT_ID: number;
    CONCEPT_NAME: string;
    DOMAIN_ID?: string;
    VOCABULARY_ID?: string;
    CONCEPT_CLASS_ID?: string;
    STANDARD_CONCEPT?: string;
    CONCEPT_CODE?: string;
  };
  isExcluded: boolean;
  includeDescendants: boolean;
  includeMapped: boolean;
}

// Domain criteria types
export type DomainCriterionType =
  | "ConditionOccurrence"
  | "DrugExposure"
  | "ProcedureOccurrence"
  | "Measurement"
  | "Observation"
  | "VisitOccurrence"
  | "Death";

export interface DomainCriterion {
  CodesetId: number;
  First?: boolean;
  OccurrenceStartDate?: DateRange;
  OccurrenceEndDate?: DateRange;
  // Domain-specific fields
  ValueAsNumber?: NumericRange;
  ValueAsConcept?: number[];
  Unit?: number[];
  Gender?: number[];
  Age?: NumericRange;
}

export interface DateRange {
  Value: string;
  Op: "gt" | "gte" | "lt" | "lte" | "eq" | "bt";
  Extent?: string; // For 'bt' (between)
}

export interface NumericRange {
  Value: number;
  Op: "gt" | "gte" | "lt" | "lte" | "eq" | "bt";
  Extent?: number;
}

export interface TemporalWindow {
  Start: { Days: number; Coeff: number }; // Coeff: -1=before, 1=after
  End: { Days: number; Coeff: number };
  UseEventEnd?: boolean;
  UseIndexEnd?: boolean;
}

export interface OccurrenceCount {
  Type: 0 | 1 | 2; // 0=exactly, 1=at most, 2=at least
  Count: number;
}

export interface WindowedCriteria {
  Criteria: Partial<Record<DomainCriterionType, DomainCriterion>>;
  StartWindow?: TemporalWindow;
  EndWindow?: TemporalWindow;
  Occurrence?: OccurrenceCount;
  RestrictVisit?: boolean;
}

export interface CriteriaGroup {
  Type: "ALL" | "ANY" | "AT_MOST_0";
  CriteriaList: WindowedCriteria[];
  Groups: CriteriaGroup[];
}

export interface DemographicFilter {
  Age?: NumericRange;
  Gender?: number[];
  Race?: number[];
  Ethnicity?: number[];
}

export interface EndStrategy {
  DateOffset?: {
    DateField: "StartDate" | "EndDate";
    Offset: number;
  };
  CustomEra?: {
    DrugCodesetId: number;
    GapDays: number;
    Offset: number;
  };
}

// ---------------------------------------------------------------------------
// Phase 15 — Genomic Criteria (extends OHDSI expression with molecular filters)
// ---------------------------------------------------------------------------

export type GenomicCriteriaType =
  | "gene_mutation"
  | "tmb"
  | "msi"
  | "fusion"
  | "pathogenicity"
  | "treatment_episode";

export interface GenomicCriterion {
  id?: number; // saved criterion ID (from genomic_cohort_criteria)
  type: GenomicCriteriaType;
  label: string; // human-readable, e.g. "EGFR L858R mutation present"
  // gene_mutation fields
  gene?: string;
  hgvs?: string;
  // tmb fields
  tmbOperator?: "gt" | "gte" | "lt" | "lte";
  tmbValue?: number;
  tmbUnit?: "mut/Mb";
  // msi fields
  msiStatus?: "MSS" | "MSI-L" | "MSI-H" | "any_unstable";
  // fusion fields
  gene1?: string;
  gene2?: string;
  // pathogenicity fields
  clinvarClasses?: ("Pathogenic" | "Likely pathogenic" | "Uncertain significance")[];
  // negation
  exclude?: boolean;
}

export interface CohortExpression {
  ConceptSets: ConceptSetExpression[];
  PrimaryCriteria: {
    CriteriaList: Partial<Record<DomainCriterionType, DomainCriterion>>[];
    ObservationWindow: { PriorDays: number; PostDays: number };
  };
  AdditionalCriteria?: CriteriaGroup;
  CensoringCriteria?: Partial<
    Record<DomainCriterionType, DomainCriterion>
  >[];
  EndStrategy?: EndStrategy;
  QualifiedLimit?: { Type: "First" | "All" };
  ExpressionLimit?: { Type: "First" | "All" };
  DemographicCriteria?: DemographicFilter[];
  CollapseSettings?: { CollapseType: "ERA"; EraPad: number };
  // Phase 15 extension
  GenomicCriteria?: GenomicCriterion[];
}

// ---------------------------------------------------------------------------
// API response types
// ---------------------------------------------------------------------------

export interface CohortDefinition {
  id: number;
  name: string;
  description: string | null;
  expression_json: CohortExpression;
  author_id: number;
  is_public: boolean;
  version: number;
  tags?: string[];
  author?: { id: number; name: string; email: string };
  created_at: string;
  updated_at: string;
  generations?: CohortGeneration[];
}

export interface CohortGeneration {
  id: number;
  cohort_definition_id: number;
  source_id: number;
  status:
    | "pending"
    | "queued"
    | "running"
    | "completed"
    | "failed"
    | "cancelled";
  started_at: string | null;
  completed_at: string | null;
  person_count: number | null;
  fail_message: string | null;
}

// ---------------------------------------------------------------------------
// Param / payload types
// ---------------------------------------------------------------------------

export interface CohortDefinitionListParams {
  page?: number;
  limit?: number;
  search?: string;
  tags?: string[];
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateCohortDefinitionPayload {
  name: string;
  description?: string;
  expression_json: CohortExpression;
}

export interface UpdateCohortDefinitionPayload {
  name?: string;
  description?: string;
  expression_json?: CohortExpression;
  is_public?: boolean;
  tags?: string[];
}

// ---------------------------------------------------------------------------
// §9.4 — Cohort Overlap types
// ---------------------------------------------------------------------------

export interface CohortOverlapPair {
  cohort_id_a: number;
  cohort_id_b: number;
  count_a: number;
  count_b: number;
  overlap_count: number;
  only_a: number;
  only_b: number;
  jaccard_index: number;
}

export interface CohortOverlapResult {
  cohort_counts: Record<number, number>;
  pairs: CohortOverlapPair[];
  summary: {
    cohort_ids: number[];
    total_unique_subjects: number;
  };
}

// ---------------------------------------------------------------------------
// §9.4 — Negative Control types
// ---------------------------------------------------------------------------

export interface NegativeControlSuggestion {
  concept_id: number;
  concept_name: string;
  person_count: number;
}

export interface NegativeControlValidation {
  concept_id: number;
  has_relationship: boolean;
  relationship_ids: string[];
}

// ---------------------------------------------------------------------------
// §9.4 — Cohort Diagnostics types
// ---------------------------------------------------------------------------

export interface CohortDiagnosticsResult {
  cohort_id: number;
  cohort_name: string;
  counts: {
    total_records: number;
    distinct_persons: number;
  };
  visit_context: { visit_type: string; person_count: number }[];
  time_distributions: {
    p25_before?: number;
    median_before?: number;
    p75_before?: number;
    p25_after?: number;
    median_after?: number;
    p75_after?: number;
  };
  age_at_index: { age_group: number; person_count: number }[];
}
