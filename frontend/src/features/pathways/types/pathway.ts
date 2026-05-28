// ---------------------------------------------------------------------------
// Pathway Analysis Types
// ---------------------------------------------------------------------------

import type { AnalysisExecution } from "@/features/analyses/types/analysis";

export interface PathwayDesign {
  targetCohortId: number;
  eventCohortIds: number[];
  maxDepth: number;
  minCellCount: number;
  combinationWindow: number;
  maxPathLength: number;
}

export interface PathwayAnalysis {
  id: number;
  name: string;
  description: string | null;
  design_json: PathwayDesign;
  author_id: number;
  author?: { id: number; name: string; email: string };
  created_at: string;
  updated_at: string;
  executions?: AnalysisExecution[];
  latest_execution?: AnalysisExecution | null;
  // Library lifecycle (Phase D §6.x)
  status?: "draft" | "active" | "archived" | null;
  archived_at?: string | null;
  archived_by?: number | null;
  promoted_at?: string | null;
}

export interface PathwayResult {
  target_cohort_id: number;
  target_count: number;
  pathways: PathwayEntry[];
  event_cohorts: Record<string, string>;
  summary: {
    unique_pathways: number;
    persons_with_events: number;
    persons_without_events: number;
  };
}

export interface PathwayEntry {
  path: string[];
  count: number;
  percent: number;
}
