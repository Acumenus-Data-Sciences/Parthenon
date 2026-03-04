// ---------------------------------------------------------------------------
// Study Orchestrator Types
// ---------------------------------------------------------------------------

import type { AnalysisExecution } from "@/features/analyses/types/analysis";

export interface Study {
  id: number;
  title: string;
  short_title: string | null;
  slug: string;
  name: string; // backward compat alias from backend (= title)
  description: string | null;
  study_type: string;
  study_design: string | null;
  phase: string;
  priority: string;
  status: string;

  // Leadership
  created_by: number;
  principal_investigator_id: number | null;
  lead_data_scientist_id: number | null;
  lead_statistician_id: number | null;

  // Eager-loaded relationships
  author?: { id: number; name: string; email: string };
  principal_investigator?: { id: number; name: string; email: string } | null;
  lead_data_scientist?: { id: number; name: string; email: string } | null;
  lead_statistician?: { id: number; name: string; email: string } | null;

  // Scientific design
  scientific_rationale: string | null;
  hypothesis: string | null;
  primary_objective: string | null;
  secondary_objectives: string[] | null;

  // Timeline & enrollment
  study_start_date: string | null;
  study_end_date: string | null;
  target_enrollment_sites: number | null;
  actual_enrollment_sites: number;

  // Protocol
  protocol_version: string | null;
  protocol_finalized_at: string | null;

  // External references
  funding_source: string | null;
  clinicaltrials_gov_id: string | null;

  // Flexible data
  tags: string[] | null;
  settings: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;

  created_at: string;
  updated_at: string;

  // Nested relations
  analyses?: StudyAnalysisEntry[];
  progress?: StudyProgress;
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

export interface StudyStats {
  total: number;
  active_count: number;
  by_status: Record<string, number>;
  by_type: Record<string, number>;
  by_phase: Record<string, number>;
}

export interface StudyCreatePayload {
  title: string;
  short_title?: string;
  description?: string;
  study_type: string;
  study_design?: string;
  phase?: string;
  priority?: string;
  scientific_rationale?: string;
  hypothesis?: string;
  primary_objective?: string;
  secondary_objectives?: string[];
  study_start_date?: string;
  study_end_date?: string;
  target_enrollment_sites?: number;
  funding_source?: string;
  clinicaltrials_gov_id?: string;
  tags?: string[];
  principal_investigator_id?: number;
  lead_data_scientist_id?: number;
  lead_statistician_id?: number;
  metadata?: Record<string, unknown>;
}

export type StudyUpdatePayload = Partial<StudyCreatePayload>;
