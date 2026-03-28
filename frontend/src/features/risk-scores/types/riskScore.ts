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

export const CATEGORY_ORDER = [
  "Cardiovascular",
  "Comorbidity Burden",
  "Hepatic",
  "Pulmonary",
  "Metabolic",
  "Musculoskeletal",
] as const;

export const TIER_COLORS: Record<string, string> = {
  low: "#2DD4BF",
  intermediate: "#C9A227",
  high: "#F59E0B",
  very_high: "#9B1B30",
  uncomputable: "#5A5650",
};

export const TIER_ORDER = [
  "low",
  "intermediate",
  "high",
  "very_high",
  "uncomputable",
] as const;
