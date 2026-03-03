// ---------------------------------------------------------------------------
// Prediction (PLP) Types
// ---------------------------------------------------------------------------

import type { AnalysisExecution } from "@/features/analyses/types/analysis";
import type { CovariateSettings } from "@/components/analysis/CovariateSettingsPanel";

export type PredictionModelType =
  | "lasso_logistic_regression"
  | "gradient_boosting"
  | "random_forest"
  | "ada_boost"
  | "decision_tree"
  | "naive_bayes"
  | "mlp"
  | "lightgbm"
  | "cox_model";

export interface PredictionDesign {
  targetCohortId: number;
  outcomeCohortId: number;
  model: {
    type: PredictionModelType;
    hyperParameters: Record<string, unknown>;
  };
  timeAtRisk: {
    start: number;
    end: number;
    endAnchor: "cohort start" | "cohort end";
  };
  covariateSettings: CovariateSettings;
  populationSettings: {
    washoutPeriod: number;
    removeSubjectsWithPriorOutcome: boolean;
    requireTimeAtRisk: boolean;
    minTimeAtRisk: number;
    firstExposureOnly?: boolean;
  };
  splitSettings: {
    testFraction: number;
    splitSeed: number;
    nFold?: number;
    type?: "stratified" | "time";
  };
  preprocessSettings?: {
    minFraction?: number;
    normalize?: boolean;
    removeRedundancy?: boolean;
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
