export interface SourceRelease {
  id: number;
  source_id: number;
  release_key: string;
  release_name: string;
  release_type: "scheduled_etl" | "snapshot";
  cdm_version: string | null;
  vocabulary_version: string | null;
  etl_version: string | null;
  person_count: number;
  record_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChartAnnotation {
  id: number;
  source_id: number | null;
  chart_type: string;
  chart_context: Record<string, unknown>;
  x_value: string;
  y_value: number | null;
  annotation_text: string;
  created_by: number;
  creator?: { id: number; name: string };
  source?: { id: number; source_name: string };
  created_at: string;
  updated_at: string;
}

export interface StoreReleasePayload {
  release_name: string;
  release_type: "scheduled_etl" | "snapshot";
  cdm_version?: string;
  vocabulary_version?: string;
  etl_version?: string;
  notes?: string;
}

export interface UpdateReleasePayload {
  release_name?: string;
  cdm_version?: string;
  vocabulary_version?: string;
  etl_version?: string;
  notes?: string;
}

export interface StoreAnnotationPayload {
  chart_type: string;
  chart_context: Record<string, unknown>;
  x_value: string;
  y_value?: number;
  annotation_text: string;
}

export interface UpdateAnnotationPayload {
  annotation_text: string;
}

export type AresSection =
  | "hub"
  | "network-overview"
  | "concept-comparison"
  | "dq-history"
  | "coverage"
  | "feasibility"
  | "diversity"
  | "releases"
  | "unmapped-codes"
  | "cost"
  | "annotations";

// DQ History types
export interface DqTrendPoint {
  release_id: number;
  release_name: string;
  created_at: string;
  pass_rate: number;
  total: number;
  passed: number;
}

export interface DqCategoryTrendPoint {
  release_id: number;
  release_name: string;
  created_at: string;
  categories: Record<string, number>;
}

export interface DqDomainTrendPoint {
  release_id: number;
  release_name: string;
  created_at: string;
  domains: Record<string, number>;
}

export interface DqDelta {
  id: number;
  source_id: number;
  current_release_id: number;
  previous_release_id: number | null;
  check_id: string;
  delta_status: "new" | "existing" | "resolved" | "stable";
  current_passed: boolean;
  previous_passed: boolean | null;
  created_at: string;
}

// Unmapped codes types
export interface UnmappedCodeSummary {
  cdm_table: string;
  cdm_field: string;
  code_count: number;
  total_records: number;
}

export interface UnmappedCode {
  id: number;
  source_id: number;
  release_id: number;
  source_code: string;
  source_vocabulary_id: string;
  cdm_table: string;
  cdm_field: string;
  record_count: number;
  created_at: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    per_page: number;
    last_page: number;
  };
}

// Domain continuity types
export interface DomainContinuityPoint {
  release_id: number;
  release_name: string;
  created_at: string;
  domains: Record<string, number>;
}

// Hub KPI types
export interface AresHubKpis {
  source_count: number;
  avg_dq_score: number | null;
  total_unmapped_codes: number;
  annotation_count: number;
  latest_releases: SourceRelease[];
  sources_needing_attention: number;
}

// ── Network comparison types ─────────────────────────────────────────────

export interface ConceptSearchResult {
  concept_id: number;
  concept_name: string;
  domain_id: string;
  vocabulary_id: string;
}

export interface ConceptComparison {
  source_id: number;
  source_name: string;
  count: number;
  rate_per_1000: number;
  person_count: number;
}

// ── Coverage matrix types ────────────────────────────────────────────────

export interface CoverageMatrix {
  sources: Array<{ id: number; name: string }>;
  domains: string[];
  matrix: Array<Record<string, CoverageCell>>;
}

export interface CoverageCell {
  record_count: number;
  has_data: boolean;
  density_per_person: number;
}

// ── Diversity types ──────────────────────────────────────────────────────

export interface DiversitySource {
  source_id: number;
  source_name: string;
  person_count: number;
  gender: Record<string, number>;
  race: Record<string, number>;
  ethnicity: Record<string, number>;
}

// ── Feasibility types ────────────────────────────────────────────────────

export interface FeasibilityCriteria {
  required_domains: string[];
  required_concepts?: number[];
  visit_types?: number[];
  date_range?: { start: string; end: string };
  min_patients?: number;
}

export interface FeasibilityAssessment {
  id: number;
  name: string;
  criteria: FeasibilityCriteria;
  sources_assessed: number;
  sources_passed: number;
  created_by: number;
  created_at: string;
  results?: FeasibilityResult[];
}

export interface FeasibilityResult {
  id: number;
  assessment_id: number;
  source_id: number;
  source_name: string;
  domain_pass: boolean;
  concept_pass: boolean;
  visit_pass: boolean;
  date_pass: boolean;
  patient_pass: boolean;
  overall_pass: boolean;
  details: Record<string, unknown>;
}

// ── Network overview types ───────────────────────────────────────────────

export interface NetworkOverview {
  source_count: number;
  avg_dq_score: number | null;
  total_unmapped_codes: number;
  sources_needing_attention: number;
  dq_summary: NetworkDqSource[];
}

export interface NetworkDqSource {
  source_id: number;
  source_name: string;
  pass_rate: number;
  trend: "up" | "down" | "stable" | null;
  release_name: string | null;
}
