// ---------------------------------------------------------------------------
// Study Orchestrator Types
// ---------------------------------------------------------------------------

import type { AnalysisExecution } from "@/features/analyses/types/analysis";

export interface Study {
  id: number;
  name: string;
  description: string | null;
  study_type: string;
  author_id: number;
  status: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  analyses?: StudyAnalysisEntry[];
}

export interface StudyAnalysisEntry {
  id: number;
  study_id: number;
  analysis_type: string;
  analysis_id: number;
  analysis?: {
    id: number;
    name: string;
    latest_execution?: AnalysisExecution | null;
  };
}

export interface StudyProgress {
  total: number;
  pending: number;
  running: number;
  completed: number;
  failed: number;
  overall_status: string;
}
