// ---------------------------------------------------------------------------
// Estimation (PLE) Types
// ---------------------------------------------------------------------------

import type { AnalysisExecution } from "@/features/analyses/types/analysis";

import type { CovariateSettings } from "@/components/analysis/CovariateSettingsPanel";

export interface EstimationDesign {
  targetCohortId: number;
  comparatorCohortId: number;
  outcomeCohortIds: number[];
  model: {
    type: "cox" | "logistic" | "poisson";
    timeAtRiskStart: number;
    timeAtRiskEnd: number;
    endAnchor: "cohort start" | "cohort end";
  };
  propensityScore: {
    enabled: boolean;
    method?: "matching" | "stratification" | "iptw";
    trimming: number;
    matching: {
      ratio: number;
      caliper: number;
      caliperScale?: "ps" | "standardized" | "standardized_logit";
    };
    stratification: { strata: number };
    iptw?: Record<string, unknown>;
  };
  covariateSettings: CovariateSettings;
  negativeControlOutcomes: number[];
  studyPeriod?: {
    startDate?: string;
    endDate?: string;
  };
}

export interface EstimationAnalysis {
  id: number;
  name: string;
  description: string | null;
  design_json: EstimationDesign;
  author_id: number;
  author?: { id: number; name: string; email: string };
  created_at: string;
  updated_at: string;
  executions?: AnalysisExecution[];
  latest_execution?: AnalysisExecution | null;
}

export interface KaplanMeierPoint {
  time: number;
  survival: number;
  lower: number;
  upper: number;
}

export interface KaplanMeierData {
  target: KaplanMeierPoint[];
  comparator: KaplanMeierPoint[];
}

export interface AttritionStep {
  step: string;
  target: number;
  comparator: number;
}

export interface PSDistPoint {
  x: number;
  y: number;
}

export interface CovariateBalanceEntry {
  covariate_name: string;
  concept_id?: number;
  smd_before: number;
  smd_after: number;
  mean_target_before: number;
  mean_comp_before: number;
  mean_target_after: number;
  mean_comp_after: number;
}

export interface EstimationResult {
  summary: {
    target_count: number;
    comparator_count: number;
    outcome_counts: Record<string, number>;
  };
  estimates: EstimateEntry[];
  propensity_score?: {
    auc: number;
    equipoise?: number;
    mean_smd_before?: number;
    mean_smd_after?: number;
    max_smd_before?: number;
    max_smd_after?: number;
    distribution?: {
      target: PSDistPoint[];
      comparator: PSDistPoint[];
    };
    // Legacy format support
    before_matching?: { mean_smd: number; max_smd: number };
    after_matching?: { mean_smd: number; max_smd: number };
  };
  covariate_balance?: CovariateBalanceEntry[];
  kaplan_meier?: KaplanMeierData;
  attrition?: AttritionStep[];
  mdrr?: Record<string, number>;
  negative_controls?: NegativeControlOutcome[];
  power_analysis?: PowerEntry[];
  diagnostics?: {
    equipoise: number;
    power: Record<string, number>;
  };
  status?: string;
  message?: string;
  design_validated?: boolean;
}

export interface NegativeControlOutcome {
  outcome_name: string;
  log_rr: number;
  se_log_rr: number;
  calibrated_log_rr?: number;
  calibrated_se_log_rr?: number;
  ci_95_lower: number;
  ci_95_upper: number;
}

export interface PowerEntry {
  outcome_name: string;
  outcome_id: number;
  target_outcomes: number;
  comparator_outcomes: number;
  target_person_years: number;
  comparator_person_years: number;
  mdrr: number;
  power_at_1_5?: number;
  power_at_2_0?: number;
}

export interface EstimateEntry {
  outcome_id: number;
  outcome_name: string;
  hazard_ratio: number;
  ci_95_lower: number;
  ci_95_upper: number;
  p_value: number;
  log_hr: number;
  se_log_hr: number;
  target_outcomes: number;
  comparator_outcomes: number;
}
