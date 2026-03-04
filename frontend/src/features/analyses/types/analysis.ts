// ---------------------------------------------------------------------------
// Analysis Types — Characterization & Incidence Rates
// ---------------------------------------------------------------------------

export type ExecutionStatus =
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface AnalysisExecution {
  id: number;
  analysis_type: string;
  analysis_id: number;
  source_id: number;
  status: ExecutionStatus;
  started_at: string | null;
  completed_at: string | null;
  result_json: Record<string, unknown> | null;
  fail_message: string | null;
  created_at: string;
}

// ---------------------------------------------------------------------------
// Characterization
// ---------------------------------------------------------------------------

export type FeatureType =
  | "demographics"
  | "conditions"
  | "drugs"
  | "procedures"
  | "measurements"
  | "visits";

export interface CharacterizationDesign {
  targetCohortIds: number[];
  comparatorCohortIds: number[];
  featureTypes: FeatureType[];
  stratifyByGender: boolean;
  stratifyByAge: boolean;
  topN: number;
  minCellCount: number;
}

export interface Characterization {
  id: number;
  name: string;
  description: string | null;
  design_json: CharacterizationDesign;
  author_id: number;
  author?: { id: number; name: string; email: string };
  created_at: string;
  updated_at: string;
  executions?: AnalysisExecution[];
  latest_execution?: AnalysisExecution | null;
}

// ---------------------------------------------------------------------------
// Incidence Rate
// ---------------------------------------------------------------------------

export interface IncidenceRateDesign {
  targetCohortId: number;
  outcomeCohortIds: number[];
  timeAtRisk: {
    start: { dateField: "StartDate" | "EndDate"; offset: number };
    end: { dateField: "StartDate" | "EndDate"; offset: number };
  };
  stratifyByGender: boolean;
  stratifyByAge: boolean;
  ageGroups: string[];
  minCellCount: number;
}

export interface IncidenceRateAnalysis {
  id: number;
  name: string;
  description: string | null;
  design_json: IncidenceRateDesign;
  author_id: number;
  author?: { id: number; name: string; email: string };
  created_at: string;
  updated_at: string;
  executions?: AnalysisExecution[];
  latest_execution?: AnalysisExecution | null;
}

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface FeatureResult {
  feature_name: string;
  category: string;
  count: number;
  percent: number;
  avg_value?: number;
  std_dev?: number;
  cohort_id: number;
  cohort_name?: string;
}

export interface CharacterizationResult {
  cohort_id: number;
  cohort_name: string;
  person_count: number;
  features: Record<FeatureType, FeatureResult[]>;
}

export interface IncidenceRateResult {
  outcome_cohort_id: number;
  outcome_cohort_name: string;
  persons_at_risk: number;
  persons_with_outcome: number;
  person_years: number;
  incidence_rate: number; // per 1000 person-years
  rate_95_ci_lower: number;
  rate_95_ci_upper: number;
  strata?: IncidenceRateStratum[];
}

export interface IncidenceRateStratum {
  stratum_name: string;
  stratum_value: string;
  persons_at_risk: number;
  persons_with_outcome: number;
  person_years: number;
  incidence_rate: number;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}
