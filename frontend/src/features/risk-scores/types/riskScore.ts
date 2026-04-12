export interface RiskScoreModel {
  score_id: string;
  score_name: string;
  category: string;
  description: string;
  eligible_population: string;
  required_components: string[];
  risk_tiers: Record<string, [number | null, number | null]>;
  required_tables: string[];
}

export interface RiskScoreCatalogue {
  scores: RiskScoreModel[];
}

export interface ScoreEligibility {
  eligible: boolean;
  patient_count: number;
  missing: string[];
}

export type EligibilityMap = Record<string, ScoreEligibility>;

export interface RiskScoreTier {
  risk_tier: string;
  patient_count: number;
  tier_fraction: number | null;
  mean_score: number | null;
  p25_score: number | null;
  median_score: number | null;
  p75_score: number | null;
  mean_confidence: number | null;
  mean_completeness: number | null;
  missing_components: Record<string, number>;
}

export interface RiskScoreDetail {
  score_id: string;
  score_name: string;
  category: string;
  description: string;
  eligible_population: string;
  required_components: string[];
  risk_tiers_defined: Record<string, [number | null, number | null]>;
  total_eligible: number;
  total_computable: number;
  completeness_rate: number | null;
  mean_confidence: number;
  mean_completeness: number;
  last_run: string | null;
  tiers: RiskScoreTier[];
}

export interface RunScoreResult {
  score_id: string;
  score_name: string;
  status: "completed" | "failed";
  tiers?: number;
  elapsed_ms?: number;
  error?: string;
}

export interface RunOutcome {
  source_id: number;
  completed: number;
  failed: number;
  scores: RunScoreResult[];
}

export interface RiskScoreSourceResults {
  source_id: number;
  last_run: string | null;
  scores_computed: number;
  summary: Array<{
    score_id: string;
    score_name: string;
    category: string;
    total_patients: number;
    avg_confidence: number | null;
    avg_completeness: number | null;
    last_run: string | null;
  }>;
  by_category: Record<
    string,
    Array<{
      score_id: string;
      score_name: string;
      category: string;
      total_eligible: number;
      computable_count: number;
      tiers: RiskScoreTier[];
    }>
  >;
}

export interface RiskScoreSourceSummaryItem {
  score_id: string;
  score_name: string;
  category: string;
  total_patients: number;
  avg_confidence: number | null;
  avg_completeness: number | null;
  last_run: string | null;
}

export const CATEGORY_ORDER = [
  "Cardiovascular",
  "Comorbidity Burden",
  "Hepatic",
  "Pulmonary",
  "Respiratory",
  "Metabolic",
  "Endocrine",
  "Musculoskeletal",
] as const;

export const TIER_COLORS: Record<string, string> = {
  low: "var(--success)",
  intermediate: "var(--accent)",
  high: "var(--warning)",
  very_high: "var(--primary)",
  uncomputable: "var(--text-ghost)",
};

export const TIER_ORDER = [
  "low",
  "intermediate",
  "high",
  "very_high",
  "uncomputable",
] as const;

// ── v2 Analysis Types ────────────────────────────────────────────

export interface RiskScoreAnalysis {
  id: number;
  name: string;
  description: string | null;
  design_json: RiskScoreDesignJson;
  author_id: number;
  author?: { id: number; name: string; email: string };
  executions_count?: number;
  executions?: AnalysisExecution[];
  created_at: string;
  updated_at: string;
}

export interface RiskScoreDesignJson {
  targetCohortIds: number[];
  comparatorCohortIds?: number[];
  scoreIds: string[];
  minCompleteness?: number;
  storePatientLevel?: boolean;
}

export interface RiskScoreAnalysisCreatePayload {
  name: string;
  description?: string;
  design_json: RiskScoreDesignJson;
}

export type RiskScoreAnalysisUpdatePayload = Pick<RiskScoreAnalysisCreatePayload, 'name' | 'description'>;

export interface AnalysisExecution {
  id: number;
  analysis_type: string;
  analysis_id: number;
  source_id: number;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result_json: Record<string, unknown> | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  source?: { id: number; source_name: string };
}

export interface RiskScoreRunStepV2 {
  id: number;
  execution_id: number;
  score_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at: string | null;
  completed_at: string | null;
  elapsed_ms: number | null;
  patient_count: number | null;
  error_message: string | null;
}

export interface RiskScorePatientResult {
  id: number;
  execution_id: number;
  source_id: number;
  cohort_definition_id: number;
  person_id: number;
  score_id: string;
  score_value: number | null;
  risk_tier: string;
  confidence: number;
  completeness: number;
  missing_components: Record<string, unknown> | null;
  created_at: string;
}

export interface ScoreRecommendation {
  score_id: string;
  score_name: string;
  category: string;
  description: string;
  applicable: boolean;
  reason: string;
  expected_completeness: number | null;
}

export interface CohortProfile {
  id: number;
  name: string;
  person_count: number;
}

export interface RecommendationResponse {
  cohort: CohortProfile;
  profile: {
    patient_count: number;
    min_age: number;
    max_age: number;
    female_pct: number;
    top_conditions: Array<{ concept_id: number; name: string; prevalence: number }>;
    measurement_coverage: Record<string, number>;
  };
  recommendations: ScoreRecommendation[];
}

export interface PopulationSummary {
  score_id: string;
  risk_tier: string;
  patient_count: number;
  mean_score: number | null;
  p25_score: number | null;
  median_score: number | null;
  p75_score: number | null;
  mean_confidence: number | null;
  mean_completeness: number | null;
}

export interface ExecutionDetailResponse {
  execution: AnalysisExecution;
  steps: RiskScoreRunStepV2[];
  population_summaries: PopulationSummary[];
}

export interface RiskScoreAnalysisStats {
  total: number;
  running: number;
  completed: number;
  patients_scored: number;
  scores_available: number;
}

export interface CreateCohortPayload {
  name: string;
  description?: string;
  execution_id: number;
  score_id: string;
  risk_tier?: string;
  person_ids?: number[];
}

export interface CreateCohortResponse {
  data: { id: number; name: string };
  patient_count: number;
}

export const ANALYSIS_STATUS_COLORS: Record<string, string> = {
  draft: "var(--text-muted)",
  pending: "var(--accent)",
  running: "var(--warning)",
  completed: "var(--success)",
  failed: "var(--critical)",
};
