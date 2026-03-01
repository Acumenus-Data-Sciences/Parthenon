export type IngestionStep =
  | "profiling"
  | "schema_mapping"
  | "concept_mapping"
  | "review"
  | "cdm_writing"
  | "validation";

export type ExecutionStatus =
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export interface IngestionJob {
  id: number;
  source_id: number;
  status: ExecutionStatus;
  current_step: IngestionStep | null;
  progress_percentage: number;
  config_json: Record<string, unknown> | null;
  stats_json: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  source?: { id: number; source_name: string; source_key: string };
  profiles?: SourceProfile[];
}

export interface SourceProfile {
  id: number;
  ingestion_job_id: number;
  file_name: string;
  file_format: string;
  file_size: number;
  row_count: number | null;
  column_count: number | null;
  format_metadata: Record<string, unknown> | null;
  fields?: FieldProfile[];
}

export interface FieldProfile {
  id: number;
  source_profile_id: number;
  column_name: string;
  column_index: number;
  inferred_type: string;
  non_null_count: number;
  null_count: number;
  null_percentage: number;
  distinct_count: number;
  distinct_percentage: number;
  top_values: Array<{ value: string; count: number }> | null;
  sample_values: string[] | null;
  statistics: { min?: number; max?: number; mean?: number } | null;
  is_potential_pii: boolean;
  pii_type: string | null;
}

export type ReviewTier = 'auto_accepted' | 'quick_review' | 'full_review' | 'unmappable';
export type MappingAction = 'approve' | 'reject' | 'remap';

export interface ConceptMapping {
  id: number;
  ingestion_job_id: number;
  source_code: string;
  source_description: string | null;
  source_vocabulary_id: string | null;
  source_table: string | null;
  source_column: string | null;
  source_frequency: number | null;
  target_concept_id: number;
  confidence: number;
  strategy: string;
  is_reviewed: boolean;
  review_tier: ReviewTier | null;
  reviewer_id: number | null;
  candidates?: MappingCandidate[];
}

export interface MappingCandidate {
  id: number;
  concept_mapping_id: number;
  target_concept_id: number;
  concept_name: string;
  domain_id: string;
  vocabulary_id: string;
  standard_concept: string | null;
  score: number;
  strategy: string;
  strategy_scores: Record<string, number> | null;
  rank: number;
}

export interface MappingStats {
  total: number;
  auto_accepted: number;
  quick_review: number;
  full_review: number;
  unmappable: number;
  reviewed: number;
  pending: number;
}

export interface ReviewRequest {
  action: MappingAction;
  target_concept_id?: number;
  comment?: string;
}

export interface BatchReviewRequest {
  reviews: Array<{
    mapping_id: number;
    action: MappingAction;
    target_concept_id?: number;
  }>;
}

// Schema Mapping types
export type MappingLogic = 'direct' | 'transform' | 'concat' | 'lookup' | 'constant';

export interface SchemaMapping {
  id: number;
  ingestion_job_id: number;
  source_table: string;
  source_column: string;
  cdm_table: string;
  cdm_column: string;
  confidence: number;
  mapping_logic: MappingLogic;
  transform_config: Record<string, unknown> | null;
  is_confirmed: boolean;
  created_at: string;
  updated_at: string;
}

// Validation types
export type CheckCategory = 'completeness' | 'conformance' | 'plausibility';
export type CheckSeverity = 'error' | 'warning' | 'info';

export interface ValidationResult {
  id: number;
  ingestion_job_id: number;
  check_name: string;
  check_category: CheckCategory;
  cdm_table: string;
  cdm_column: string | null;
  severity: CheckSeverity;
  passed: boolean;
  violated_rows: number;
  total_rows: number;
  violation_percentage: number;
  description: string;
  details: Record<string, unknown> | null;
}

export interface ValidationSummary {
  total_checks: number;
  passed: number;
  failed: number;
  by_category: Record<CheckCategory, { passed: number; failed: number; total: number }>;
  by_severity: Record<CheckSeverity, { passed: number; failed: number; total: number }>;
}
