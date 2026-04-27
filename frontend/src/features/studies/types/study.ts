// ---------------------------------------------------------------------------
// Study Orchestrator Types
// ---------------------------------------------------------------------------

import type { AnalysisExecution } from "@/features/analyses/types/analysis";
import type { ApiMessageEnvelope } from "@/types/api";

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

export interface StudyTransitionResponse extends ApiMessageEnvelope {
  data: Study;
  allowed_transitions: string[];
}

// ---------------------------------------------------------------------------
// Study Design Compiler Types
// ---------------------------------------------------------------------------

export interface StudyDesignSession {
  id: number;
  study_id: number;
  created_by: number;
  active_version_id: number | null;
  title: string;
  status: string;
  source_mode: string;
  settings_json: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  active_version?: StudyDesignVersion | null;
}

export interface StudyDesignVersion {
  id: number;
  session_id: number;
  version_number: number;
  status: string;
  spec_json?: Record<string, unknown> | null;
  intent_json: Record<string, unknown> | null;
  normalized_spec_json: Record<string, unknown> | null;
  lint_results_json?: StudyDesignLintResults | null;
  provenance_json: Record<string, unknown> | null;
  accepted_by: number | null;
  accepted_at: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
  assets?: StudyDesignAsset[];
}

export interface StudyDesignLintResults {
  status?: string;
  issues?: StudyDesignLintIssue[];
}

export interface StudyDesignLintIssue {
  field?: string;
  severity?: string;
  message?: string;
}

export type StudyCompilerStageId =
  | "intent"
  | "current_assets"
  | "phenotypes"
  | "concept_sets"
  | "cohorts"
  | "feasibility"
  | "analysis"
  | "lock";

export type StudyCompilerStageStatus = "complete" | "active" | "blocked" | "pending";

export type StudyCompilerActionType =
  | "upload_protocol"
  | "generate_intent"
  | "save_review"
  | "accept_intent"
  | "import_current_assets"
  | "review_compatibility"
  | "recommend_phenotypes"
  | "accept_recommendation"
  | "draft_concept_sets"
  | "verify_concept_draft"
  | "repair_concept_draft"
  | "materialize_concept_set"
  | "draft_cohorts"
  | "verify_cohort_draft"
  | "link_materialized_cohort"
  | "run_feasibility"
  | "review_feasibility"
  | "draft_analysis_plans"
  | "verify_analysis_plan"
  | "materialize_analysis_plan"
  | "install_hades_package"
  | "lock_package"
  | "download_package_summary"
  | "resolve_readiness_blockers"
  | "review_package";

interface StudyCompilerActionBase {
  type?: StudyCompilerActionType | (string & {});
  stage_id?: StudyCompilerStageId;
  label?: string;
  detail?: string;
  target?: string;
  href?: string | null;
}

export interface StudyCompilerAction extends StudyCompilerActionBase {
  type: StudyCompilerActionType | (string & {});
  label: string;
}

export interface StudyCompilerStage {
  id: StudyCompilerStageId;
  label: string;
  status: StudyCompilerStageStatus;
  detail: string;
  actionLabel?: string;
  action?: StudyCompilerAction;
  blocker?: string | null;
}

export interface StudyCompilerGuidance {
  currentStage: StudyCompilerStage;
  nextAction: {
    label: string;
    detail: string;
    stageId: StudyCompilerStageId;
    action?: StudyCompilerAction;
  };
  stages: StudyCompilerStage[];
  blockers: string[];
  warnings: string[];
  metrics: {
    recommendations: number;
    acceptedRecommendations: number;
    conceptDrafts: number;
    materializedConceptSets: number;
    cohortDrafts: number;
    linkedCohorts: number;
    feasibilityRuns: number;
    materializedAnalyses: number;
  };
}

export interface StudyDesignBackendGuidanceAction extends StudyCompilerActionBase {
  type?: StudyCompilerActionType | (string & {});
  label?: string;
  priority?: "blocking" | "high" | "medium" | "low" | (string & {});
  details?: Record<string, unknown>;
  issues?: StudyReadinessIssue[];
  section?: string;
}

export interface StudyDesignBackendGuidanceSection {
  id: string;
  label?: string;
  status?: string;
  summary?: string;
  counts?: Record<string, unknown>;
  blockers?: StudyReadinessIssue[];
  warnings?: StudyReadinessIssue[];
  actions?: StudyDesignBackendGuidanceAction[];
}

export interface StudyDesignBackendGuidance {
  schema_version?: string;
  generated_at?: string;
  mode?: string;
  policy?: string;
  initial_gate?: {
    status?: string;
    summary?: string;
    blocking_count?: number;
    issues?: StudyReadinessIssue[];
    action?: StudyDesignBackendGuidanceAction | null;
  };
  sections?: StudyDesignBackendGuidanceSection[];
  next_best_actions?: StudyDesignBackendGuidanceAction[];
  action_targets?: StudyReadinessAction[];
  provenance?: Record<string, unknown>;
}

export interface StudyDesignAsset {
  id: number;
  session_id: number;
  version_id: number | null;
  asset_type: string;
  role: string | null;
  status: string;
  draft_payload_json: Record<string, unknown> | null;
  canonical_type: string | null;
  canonical_id: number | null;
  provenance_json: Record<string, unknown> | null;
  verification_status: string;
  verification_json: Record<string, unknown> | null;
  verified_at: string | null;
  rank_score: number | null;
  rank_score_json: Record<string, unknown> | null;
  materialized_type: string | null;
  materialized_id: number | null;
  materialized_at: string | null;
  review_notes: string | null;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface StudyDesignReadiness {
  ready: boolean;
  status?: string;
  can_lock?: boolean;
  locked?: boolean;
  blocking_reasons?: string[];
  blockers?: StudyReadinessIssue[];
  warnings?: StudyReadinessIssue[];
  summary?: {
    accepted_recommendations?: number;
    materialized_concept_sets?: number;
    linked_cohorts?: number;
    feasibility_status?: string | null;
    materialized_analysis_plans?: number;
    package_assets?: number;
    [key: string]: unknown;
  };
  checklist?: StudyDesignLockChecklistItem[];
  abby_final_review?: {
    status?: string;
    summary?: string;
    recommendation?: string;
    risk_notes?: string[];
  };
  manifest_preview?: StudyDesignManifestPreview;
  cohorts?: {
    ready: boolean;
    cohort_asset_count: number;
    materialized_verified_count: number;
    blocked_count: number;
  };
  feasibility_ready?: boolean;
  analysis_plan_ready?: boolean;
  package_artifact?: StudyArtifact | null;
  provenance_summary?: {
    study_id?: number;
    version_status: string;
    accepted_at: string | null;
    ai_events: number;
    reviewed_assets: number;
    verified_assets: number;
    package_manifest_sha256: string | null;
  };
}

export interface StudyCohortReadiness {
  ready: boolean;
  status?: string;
  ready_for_feasibility?: boolean;
  cohort_asset_count: number;
  materialized_verified_count: number;
  blocked_count: number;
  required_roles?: string[];
  present_roles?: Record<string, number>;
  missing_roles?: string[];
  linked_cohorts?: Array<{
    id: number;
    role: string;
    label?: string | null;
    cohort_definition_id?: number | null;
    cohort_definition_name?: string | null;
    concept_set_ids?: number[];
  }>;
  materialized_unlinked_assets?: Array<{
    id: number;
    role?: string;
    title?: string;
    cohort_definition_id?: number | null;
  }>;
  action_targets?: StudyReadinessAction[];
  blockers?: StudyReadinessIssue[];
  warnings?: StudyReadinessIssue[];
  drafts?: {
    total?: number;
    materialized?: number;
    linked?: number;
    [key: string]: unknown;
  };
}

export type StudyDesignLockReadiness = StudyDesignReadiness;

export interface StudyDesignLockChecklistItem {
  id?: string;
  label?: string;
  status?: string;
  message?: string;
  blockers?: StudyReadinessIssue[];
  warnings?: StudyReadinessIssue[];
}

export interface StudyDesignManifestPreview {
  schema_version?: string;
  study?: Record<string, unknown>;
  design_session?: Record<string, unknown>;
  design_version?: Record<string, unknown>;
  contents?: {
    accepted_recommendations?: number;
    concept_sets?: number;
    cohorts?: number;
    feasibility?: string | null;
    analysis_plans?: number;
    [key: string]: unknown;
  };
  artifact?: {
    id?: number;
    title?: string;
    url?: string | null;
    sha256?: string | null;
    file_size_bytes?: number | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export interface StudyReadinessAction extends StudyCompilerActionBase {
  role?: string;
  asset_id?: number | null;
  asset_ids?: number[];
  study_cohort_id?: number;
  cohort_definition_ids?: number[];
  requires_selection?: boolean;
  [key: string]: unknown;
}

export type StudyReadinessIssue = string | {
  code?: string;
  message?: string;
  severity?: string;
  action?: StudyReadinessAction;
  [key: string]: unknown;
};

export interface StudyFeasibilityResult {
  status: string;
  ready_for_analysis?: boolean;
  ready_source_count: number;
  source_count: number;
  min_cell_count?: number;
  ran_at: string;
  action_targets?: StudyReadinessAction[];
  previous_run?: {
    asset_id?: number;
    status?: string | null;
    ready_source_count?: number;
    source_count?: number;
    min_cell_count?: number | null;
    ran_at?: string | null;
    delta_ready_source_count?: number;
    delta_source_count?: number;
    threshold_changed?: boolean;
  } | null;
  sources?: Array<{
    source_id?: number;
    source_name?: string;
    ready_for_analysis?: boolean;
    cohorts?: Array<{
      study_cohort_id?: number;
      role: string;
      label?: string | null;
      person_count?: number | null;
      person_count_suppressed?: boolean;
      attrition?: Array<{
        name?: string;
        person_count?: number | null;
        person_count_suppressed?: boolean;
        [key: string]: unknown;
      }>;
    }>;
    blockers?: StudyReadinessIssue[];
    warnings?: StudyReadinessIssue[];
    coverage?: {
      date_coverage?: {
        start_date?: string | null;
        end_date?: string | null;
      };
      observation_period?: {
        record_count?: number | null;
      };
      freshness?: {
        status?: string;
        days_since_release?: number | null;
      };
      [key: string]: unknown;
    };
    domain_availability?: {
      available_role_count?: number;
      role_count?: number;
      [key: string]: unknown;
    };
    source_quality?: {
      dqd?: {
        pass_rate?: number | null;
        [key: string]: unknown;
      };
      [key: string]: unknown;
    };
  }>;
  blockers?: StudyReadinessIssue[];
  warnings?: StudyReadinessIssue[];
}

export interface StudyAnalysisPlanDraft {
  schema_version?: string;
  title?: string;
  analysis_type?: string;
  analysis_family?: {
    id?: string;
    label?: string;
    hades_package?: string;
    recommended?: boolean;
    fit_score?: number;
    reason?: string;
  };
  description?: string;
  hades_package?: string;
  hades_capability?: { installed?: boolean; package?: string; status?: string; version?: string | null };
  hades_remediation?: {
    package?: string;
    message?: string;
    action?: StudyReadinessAction;
  } | null;
  required_roles?: string[];
  cohort_role_map?: Record<string, unknown>;
  feasibility?: { status?: string | null; ready_source_count?: number; source_count?: number; ran_at?: string | null };
  design_json?: Record<string, unknown>;
  parameter_review?: Array<{
    name?: string;
    label?: string;
    value?: unknown;
    status?: string;
    message?: string;
  }>;
  blockers?: StudyReadinessIssue[];
  warnings?: StudyReadinessIssue[];
}

export interface StudyDesignDraftConcept {
  concept_id: number;
  is_excluded?: boolean;
  include_descendants?: boolean;
  include_mapped?: boolean;
  rationale?: string | null;
  concept?: {
    concept_id: number;
    concept_name: string;
    domain_id: string;
    vocabulary_id: string;
    concept_class_id: string;
    standard_concept: string | null;
    concept_code: string;
    invalid_reason: string | null;
  };
}

export interface StudyDesignSpec {
  schema_version?: string;
  study?: Record<string, unknown>;
  pico?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface StudyProtocolImportResult {
  study: Study;
  session: StudyDesignSession;
  version: StudyDesignVersion;
  extracted: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface StudyDesignProtocolImportResult {
  version: StudyDesignVersion;
  extracted: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Results & Synthesis
// ---------------------------------------------------------------------------

export interface StudyResult {
  id: number;
  study_id: number;
  study_analysis_id: number | null;
  execution_id: number | null;
  site_id: number | null;
  result_type: string;
  summary_data: Record<string, unknown> | null;
  diagnostics: Record<string, unknown> | null;
  is_primary: boolean;
  is_publishable: boolean;
  reviewed_by: number | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  site?: { id: number; source?: { id: number; source_name: string } } | null;
  reviewed_by_user?: { id: number; name: string; email: string } | null;
}

export interface StudySynthesis {
  id: number;
  study_id: number;
  study_analysis_id: number | null;
  synthesis_type: string;
  input_result_ids: number[];
  method_settings: Record<string, unknown> | null;
  output: Record<string, unknown> | null;
  generated_by: number | null;
  generated_at: string | null;
  created_at: string;
  updated_at: string;
  generated_by_user?: { id: number; name: string; email: string } | null;
}

// ---------------------------------------------------------------------------
// Arachne Federated Execution Types
// ---------------------------------------------------------------------------

export interface ArachneNode {
  id: number;
  name: string;
  description: string | null;
  status: "ONLINE" | "OFFLINE" | "UNKNOWN";
  cdm_version: string | null;
  patient_count: number | null;
  last_seen_at: string | null;
}

export interface ArachneSubmission {
  id: number;
  node_id: number;
  node_name: string;
  status: "PENDING" | "EXECUTING" | "COMPLETED" | "FAILED";
  submitted_at: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
}

export interface ArachneDistributePayload {
  study_slug: string;
  node_ids: number[];
  analysis_spec?: Record<string, unknown>;
}

export interface ArachneDistributeResponse {
  arachne_analysis_id: number;
  submissions: ArachneSubmission[];
}

export interface ArachneStatusResponse {
  executions: Array<{
    id: number;
    execution_engine: string;
    status: string;
    arachne_analysis_id: number;
    submissions: ArachneSubmission[];
  }>;
}
