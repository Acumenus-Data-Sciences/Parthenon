// ---------------------------------------------------------------------------
// Prediction (PLP) Types
// ---------------------------------------------------------------------------

import type { AnalysisExecution } from "@/features/analyses/types/analysis";

export interface PredictionDesign {
  targetCohortId: number;
  outcomeCohortId: number;
  model: {
    type:
      | "lasso_logistic_regression"
      | "gradient_boosting"
      | "random_forest";
    hyperParameters: Record<string, unknown>;
  };
  timeAtRisk: {
    start: number;
    end: number;
    endAnchor: "cohort start" | "cohort end";
  };
  covariateSettings: {
    useDemographics: boolean;
    useConditionOccurrence: boolean;
    useDrugExposure: boolean;
    useProcedureOccurrence: boolean;
    useMeasurement: boolean;
    timeWindows: { start: number; end: number }[];
  };
  populationSettings: {
    washoutPeriod: number;
    removeSubjectsWithPriorOutcome: boolean;
    requireTimeAtRisk: boolean;
    minTimeAtRisk: number;
  };
  splitSettings: {
    testFraction: number;
    splitSeed: number;
  };
}

export interface PredictionAnalysis {
  id: number;
  name: string;
  description: string | null;
  design_json: PredictionDesign;
  author_id: number;
  created_at: string;
  updated_at: string;
  executions?: AnalysisExecution[];
  latest_execution?: AnalysisExecution | null;
}

export interface PredictionResult {
  summary: {
    target_count: number;
    outcome_count: number;
    outcome_rate: number;
  };
  performance: {
    auc: number;
    auc_ci_lower: number;
    auc_ci_upper: number;
    brier_score: number;
    calibration_slope: number;
    calibration_intercept: number;
  };
  top_predictors: {
    covariate_name: string;
    coefficient: number;
    importance: number;
  }[];
  roc_curve: { fpr: number; tpr: number }[];
  calibration: { predicted: number; observed: number }[];
  status?: string;
  message?: string;
}
