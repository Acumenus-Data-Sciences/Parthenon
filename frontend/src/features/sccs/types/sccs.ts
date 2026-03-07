// ---------------------------------------------------------------------------
// Self-Controlled Case Series (SCCS) Types
// ---------------------------------------------------------------------------

import type { AnalysisExecution } from "@/features/analyses/types/analysis";
import type { CovariateSettings } from "@/components/analysis/CovariateSettingsPanel";

export interface RiskWindow {
  start: number;
  end: number;
  startAnchor: "era_start" | "era_end";
  endAnchor: "era_start" | "era_end";
  label: string;
}

export interface SccsDesign {
  exposureCohortId: number;
  outcomeCohortId: number;
  riskWindows: RiskWindow[];
  model: {
    type: "simple" | "age_adjusted" | "season_adjusted" | "age_season_adjusted";
  };
  studyPopulation: {
    naivePeriod: number;
    firstOutcomeOnly: boolean;
    minAge?: number;
    maxAge?: number;
  };
  covariateSettings?: CovariateSettings;
}

export interface SccsAnalysis {
  id: number;
  name: string;
  description: string | null;
  design_json: SccsDesign;
  author_id: number;
  author?: { id: number; name: string; email: string };
  created_at: string;
  updated_at: string;
  executions?: AnalysisExecution[];
  latest_execution?: AnalysisExecution | null;
}

export interface SccsEstimate {
  covariate: string;
  irr: number;
  ci_lower: number;
  ci_upper: number;
  log_rr: number;
  se_log_rr: number;
}

export interface SccsEra {
  era_name: string;
  era_type: "pre-exposure" | "exposure" | "post-exposure" | "control";
  start_day: number;
  end_day: number;
  event_count: number;
  person_days: number;
  irr?: number;
  ci_lower?: number;
  ci_upper?: number;
}

export interface SccsResult {
  status: string;
  estimates: SccsEstimate[];
  population: {
    cases: number;
    outcomes: number;
    observation_periods: number;
  };
  eras?: SccsEra[];
  logs?: { level: string; message: string; timestamp: string }[];
  elapsed_seconds?: number;
  message?: string;
}
