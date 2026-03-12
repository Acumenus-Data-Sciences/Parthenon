export interface PhenotypeSearchResult {
  cohortId: number;
  name: string;
  description: string;
  score: number;
  tags?: string[];
}

export interface PhenotypeRecommendation {
  cohortId: number;
  name: string;
  rationale: string;
  score: number;
}

export interface IntentSplitResult {
  target: string;
  outcome: string;
  rationale?: string;
}

export interface LintWarning {
  rule: string;
  message: string;
  severity: "info" | "warning" | "error";
}

export interface ConceptSetFinding {
  finding: string;
  severity: "info" | "warning" | "error";
  suggestion?: string;
}

export interface CombinedLintResult {
  cohort_findings: Record<string, unknown>;
  concept_set_findings: Record<string, unknown>;
}

export interface StudyAgentHealth {
  status: string;
  mcp_status?: string;
  index_status?: {
    total_phenotypes: number;
    index_type: string;
  };
}

export type StudyDesignerTab = "intent" | "search" | "recommend" | "lint";
