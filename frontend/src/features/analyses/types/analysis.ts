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
  featureAnalyses?: FeatureType[];
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

export type TarAnchor = "era_start" | "era_end";

export interface TarConfig {
  start_offset: number;
  start_anchor: TarAnchor;
  end_offset: number;
  end_anchor: TarAnchor;
}

export interface StratificationConfig {
  by_age: boolean;
  by_gender: boolean;
  by_year: boolean;
  age_breaks: number[];
}

export interface IncidenceRateDesign {
  targetCohortId: number;
  outcomeCohortIds: number[];
  timeAtRisk: {
    start: { dateField: "StartDate" | "EndDate"; offset: number };
    end: { dateField: "StartDate" | "EndDate"; offset: number };
  };
  // OHDSI CohortIncidence extended fields
  tarConfigs: TarConfig[];
  stratification: StratificationConfig;
  stratifyByGender: boolean;
  stratifyByAge: boolean;
  ageGroups: string[];
  minCellCount: number;
}

// ---------------------------------------------------------------------------
// Direct CohortIncidence calculation (POST /api/v1/incidence-rates/calculate-direct)
// ---------------------------------------------------------------------------

export interface DirectCalcOutcome {
  cohort_id: number;
  cohort_name: string;
  clean_window: number;
}

export interface DirectCalcRequest {
  source_id: number;
  targets: Array<{ cohort_id: number; cohort_name: string }>;
  outcomes: DirectCalcOutcome[];
  time_at_risk: TarConfig[];
  strata: StratificationConfig;
  min_cell_count: number;
}

export interface StratumResult {
  stratum_name: string;
  stratum_value: string;
  persons_at_risk: number;
  persons_with_outcome: number;
  person_years: number;
  incidence_rate: number;
  rate_95_ci_lower: number;
  rate_95_ci_upper: number;
}

export interface DirectCalcRateRow {
  target_cohort_id: number;
  target_cohort_name: string;
  outcome_cohort_id: number;
  outcome_cohort_name: string;
  tar_id: number;
  tar_label: string;
  persons_at_risk: number;
  persons_with_outcome: number;
  person_years: number;
  incidence_rate: number;
  rate_95_ci_lower: number;
  rate_95_ci_upper: number;
  strata: StratumResult[];
}

export interface DirectCalcResponse {
  incidence_rates: DirectCalcRateRow[];
  summary: {
    total_persons: number;
    total_person_years: number;
    total_outcomes: number;
    sources_used: string[];
  };
  metadata: {
    executed_at: string;
    duration_seconds: number;
    r_version?: string;
  };
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

// ---------------------------------------------------------------------------
// Direct Run (OHDSI Characterization R endpoint)
// ---------------------------------------------------------------------------

export interface TimeWindow {
  start_day: number;
  end_day: number;
}

export interface DirectRunAnalyses {
  aggregate_covariates: boolean;
  time_to_event: boolean;
  dechallenge_rechallenge: boolean;
}

export interface DirectRunRequest {
  source_id: number;
  target_ids: number[];
  outcome_ids: number[];
  analyses: DirectRunAnalyses;
  time_windows: TimeWindow[];
  min_cell_count: number;
  min_prior_observation: number;
}

export interface AggregateCovariateRow {
  covariate_name: string;
  covariate_id?: number;
  analysis_name?: string;
  time_window?: string;
  mean_target: number;
  mean_outcome: number;
  smd: number;
}

export interface CohortCount {
  cohort_id: number;
  cohort_name?: string;
  person_count: number;
}

export interface TimeToEventRow {
  target_cohort_id?: number;
  outcome_cohort_id?: number;
  target_cohort_name?: string;
  outcome_cohort_name?: string;
  time_days: number;
  num_events: number;
  num_at_risk?: number;
}

export interface DirectRunResult {
  aggregate_covariates?: AggregateCovariateRow[];
  time_to_event?: TimeToEventRow[];
  cohort_counts?: CohortCount[];
  execution_time_seconds?: number;
  status?: string;
  error?: string;
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
  rate_95_ci_lower?: number;
  rate_95_ci_upper?: number;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}
