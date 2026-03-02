// ---------------------------------------------------------------------------
// Estimation (PLE) Types
// ---------------------------------------------------------------------------

import type { AnalysisExecution } from "@/features/analyses/types/analysis";

export interface EstimationDesign {
  targetCohortId: number;
  comparatorCohortId: number;
  outcomeCohortIds: number[];
  model: {
    type: "cox" | "logistic";
    timeAtRiskStart: number;
    timeAtRiskEnd: number;
    endAnchor: "cohort start" | "cohort end";
  };
  propensityScore: {
    enabled: boolean;
    trimming: number;
    matching: { ratio: number; caliper: number };
    stratification: { strata: number };
  };
  covariateSettings: {
    useDemographics: boolean;
    useConditionOccurrence: boolean;
    useDrugExposure: boolean;
    useProcedureOccurrence: boolean;
    useMeasurement: boolean;
    useObservation: boolean;
    timeWindows: { start: number; end: number }[];
  };
  negativeControlOutcomes: number[];
}

export interface EstimationAnalysis {
  id: number;
  name: string;
  description: string | null;
  design_json: EstimationDesign;
  author_id: number;
  created_at: string;
  updated_at: string;
  executions?: AnalysisExecution[];
  latest_execution?: AnalysisExecution | null;
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
    before_matching: { mean_smd: number; max_smd: number };
    after_matching: { mean_smd: number; max_smd: number };
  };
  diagnostics?: {
    equipoise: number;
    power: Record<string, number>;
  };
  status?: string;
  message?: string;
  design_validated?: boolean;
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
