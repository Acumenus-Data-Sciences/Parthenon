// ---------------------------------------------------------------------------
// Self-Controlled Cohort (SCC) Types
//
// Mirrors the SelfControlledCohortController contract (CRUD + execute +
// executions). Distinct from the Self-Controlled Case Series (SCCS) method,
// though the design surface is intentionally parallel to the SCCS designer.
// ---------------------------------------------------------------------------

import type { AnalysisExecution } from "@/features/analyses/types/analysis";
import type { CovariateSettings } from "@/components/analysis/CovariateSettingsPanel";

export interface SelfControlledCohortRiskWindow {
  start: number;
  end: number;
  startAnchor: "era_start" | "era_end";
  endAnchor: "era_start" | "era_end";
  label: string;
}

export interface SelfControlledCohortDesign {
  exposureCohortId: number;
  outcomeCohortId: number;
  riskWindows: SelfControlledCohortRiskWindow[];
  model: {
    type:
      | "simple"
      | "age_adjusted"
      | "season_adjusted"
      | "age_season_adjusted";
  };
  studyPopulation: {
    naivePeriod: number;
    firstOutcomeOnly: boolean;
    minAge?: number;
    maxAge?: number;
  };
  covariateSettings?: CovariateSettings;
}

export interface SelfControlledCohortAnalysis {
  id: number;
  name: string;
  description: string | null;
  design_json: SelfControlledCohortDesign;
  author_id: number;
  author?: { id: number; name: string; email: string };
  created_at: string;
  updated_at: string;
  executions?: AnalysisExecution[];
  latest_execution?: AnalysisExecution | null;
  // Library lifecycle (parallels the SCCS analysis library)
  status?: "draft" | "active" | "archived" | null;
  archived_at?: string | null;
  archived_by?: number | null;
  promoted_at?: string | null;
}
