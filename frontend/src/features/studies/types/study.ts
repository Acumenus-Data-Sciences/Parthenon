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

// ---------------------------------------------------------------------------
// Study Sub-resources
// ---------------------------------------------------------------------------

export interface StudySite {
  id: number;
  study_id: number;
  source_id: number;
  site_role: string;
  status: string;
  irb_protocol_number: string | null;
  irb_approval_date: string | null;
  irb_expiry_date: string | null;
  irb_type: string | null;
  dua_signed_at: string | null;
  site_contact_user_id: number | null;
  cdm_version: string | null;
  vocabulary_version: string | null;
  data_freshness_date: string | null;
  patient_count_estimate: number | null;
  feasibility_results: Record<string, unknown> | null;
  execution_log: Record<string, unknown> | null;
  results_received_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  source?: { id: number; source_name: string };
  site_contact?: { id: number; name: string; email: string } | null;
}

export interface StudyTeamMember {
  id: number;
  study_id: number;
  user_id: number;
  role: string;
  site_id: number | null;
  permissions: Record<string, boolean> | null;
  joined_at: string;
  left_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  user?: { id: number; name: string; email: string };
  site?: StudySite | null;
}

export interface StudyCohort {
  id: number;
  study_id: number;
  cohort_definition_id: number;
  role: string;
  label: string | null;
  description: string | null;
  sql_definition: string | null;
  json_definition: Record<string, unknown> | null;
  concept_set_ids: number[] | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  cohort_definition?: { id: number; name: string };
}

export interface StudyMilestone {
  id: number;
  study_id: number;
  title: string;
  description: string | null;
  milestone_type: string;
  target_date: string | null;
  actual_date: string | null;
  status: string;
  assigned_to: number | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  assigned_to_user?: { id: number; name: string; email: string } | null;
}

export interface StudyArtifact {
  id: number;
  study_id: number;
  artifact_type: string;
  title: string;
  description: string | null;
  version: string;
  file_path: string | null;
  file_size_bytes: number | null;
  mime_type: string | null;
  url: string | null;
  metadata: Record<string, unknown> | null;
  uploaded_by: number;
  is_current: boolean;
  created_at: string;
  updated_at: string;
  uploaded_by_user?: { id: number; name: string; email: string };
}

export interface StudyActivityLogEntry {
  id: number;
  study_id: number;
  user_id: number | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  ip_address: string | null;
  occurred_at: string;
  created_at: string;
  user?: { id: number; name: string; email: string } | null;
}

export interface StudyTransitionResponse {
  data: Study;
  message: string;
  allowed_transitions: string[];
}
