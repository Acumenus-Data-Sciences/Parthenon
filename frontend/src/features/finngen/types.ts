import type { Source } from "@/types/models";

export interface FinnGenUiHints {
  title?: string;
  summary?: string;
  accent?: string;
  repository?: string;
  workspace?: string;
  visualizations?: string[];
}

export interface FinnGenService {
  name: string;
  endpoint: string;
  description?: string;
  mcp_tools?: string[];
  input?: string[];
  output?: string[];
  validation?: string[];
  ui_hints?: FinnGenUiHints;
  implemented?: boolean;
  source?: string;
}

export interface FinnGenServicesResponse {
  services: FinnGenService[];
  warnings: string[];
}

export interface FinnGenRun {
  id: number;
  service_name: string;
  status: string;
  source: Record<string, unknown>;
  submitted_by?: string | null;
  submitted_at?: string | null;
  completed_at?: string | null;
  runtime?: Record<string, unknown>;
  artifacts?: FinnGenArtifact[];
  summary?: Record<string, unknown>;
  request_payload?: Record<string, unknown>;
  result_payload?: Record<string, unknown>;
}

export type FinnGenSource = Pick<
  Source,
  "id" | "source_name" | "source_key" | "source_dialect" | "daimons"
>;

export interface FinnGenArtifact {
  name: string;
  type?: string;
  summary?: string;
}

export interface FinnGenSelectedCohort {
  id: number;
  name: string;
  description?: string | null;
}

export interface FinnGenRuntime {
  service: string;
  mode: "parthenon_native" | "external_command" | "external_service" | string;
  mode_label: string;
  adapter_configured: boolean;
  adapter_command?: string | null;
  adapter_base_url?: string | null;
  adapter_label?: string | null;
  upstream_repo_path?: string | null;
  upstream_package?: string | null;
  upstream_ready?: boolean | null;
  compatibility_mode?: boolean | null;
  missing_dependencies?: string[];
  fallback_active: boolean;
  status: string;
  last_error?: string;
  capabilities?: Record<string, boolean>;
  notes?: string[];
}

export interface FinnGenTimelineStep {
  step?: number;
  title?: string;
  stage?: string;
  label?: string;
  status: string;
  window?: string;
  detail?: string;
  duration_ms?: number;
}

export interface FinnGenMetricPoint {
  label: string;
  value?: string | number;
  count?: number;
  percent?: number;
  effect?: number;
  lower?: number;
  upper?: number;
}

export interface FinnGenCohortOperationsResult {
  status: string;
  runtime: FinnGenRuntime;
  source: Record<string, unknown>;
  compile_summary: Record<string, unknown>;
  attrition: FinnGenMetricPoint[];
  criteria_timeline: FinnGenTimelineStep[];
  selected_cohorts?: FinnGenSelectedCohort[];
  operation_summary?: Record<string, unknown>;
  operation_evidence?: Array<{ label: string; value: number; emphasis?: string }>;
  operation_comparison?: Array<{ label: string; value: string | number }>;
  import_review?: Array<{ label: string; status: string; detail: string }>;
  cohort_table_summary?: Record<string, unknown>;
  matching_summary?: Record<string, unknown>;
  matching_review?: {
    matched_samples?: Array<Record<string, unknown>>;
    excluded_samples?: Array<Record<string, unknown>>;
    balance_notes?: string[];
  };
  export_summary?: Record<string, unknown>;
  artifacts: FinnGenArtifact[];
  sql_preview?: string;
  sample_rows?: Array<Record<string, unknown>>;
}

export interface FinnGenCo2AnalysisResult {
  status: string;
  runtime: FinnGenRuntime;
  source: Record<string, unknown>;
  analysis_summary: Record<string, unknown>;
  cohort_context?: Record<string, unknown>;
  handoff_impact?: Array<{ label: string; value: string | number; emphasis?: string }>;
  module_setup?: Record<string, unknown>;
  module_family?: string;
  family_evidence?: Array<{ label: string; value: string | number; emphasis?: string }>;
  family_notes?: string[];
  family_spotlight?: Array<{ label: string; value: string | number; detail?: string }>;
  family_segments?: Array<{ label: string; count: number; share?: number }>;
  module_validation?: Array<{ label: string; status: string; detail: string }>;
  family_result_summary?: Record<string, unknown>;
  result_table?: Array<Record<string, unknown>>;
  subgroup_summary?: Array<{ label: string; value: string }>;
  temporal_windows?: Array<{ label: string; count: number; detail?: string }>;
  module_gallery: Array<{ name: string; family: string; status: string }>;
  forest_plot: FinnGenMetricPoint[];
  heatmap: Array<{ label: string; value: number }>;
  time_profile?: Array<{ label: string; count: number }>;
  overlap_matrix?: Array<{ label: string; value: number }>;
  top_signals: Array<{ label: string; count: number }>;
  utilization_trend: Array<{ label: string; count: number }>;
  execution_timeline: FinnGenTimelineStep[];
}

export interface FinnGenHadesExtrasResult {
  status: string;
  runtime: FinnGenRuntime;
  source: Record<string, unknown>;
  package_setup?: Record<string, unknown>;
  render_summary: Record<string, unknown>;
  config_summary?: Record<string, unknown>;
  sql_preview: { template: string; rendered: string };
  artifact_pipeline: Array<{ name: string; status: string }>;
  artifacts: FinnGenArtifact[];
  package_manifest?: Array<{ path: string; kind: string; summary?: string }>;
  package_bundle?: {
    name?: string;
    format?: string;
    entrypoints?: string[];
    download_name?: string;
  };
  sql_lineage?: Array<{ stage: string; detail: string }>;
  cohort_summary?: Array<{ label: string; value: string }>;
  explain_plan?: Array<Record<string, string | number>>;
}

export interface FinnGenRomopapiResult {
  status: string;
  runtime: FinnGenRuntime;
  source: Record<string, unknown>;
  query_controls?: Record<string, unknown>;
  metadata_summary: Record<string, unknown>;
  schema_nodes: Array<{ name: string; group: string; connections: number; estimated_rows?: number }>;
  lineage_trace: Array<{ step: number; label: string; detail: string }>;
  query_plan: {
    template?: string;
    joins?: number;
    filters?: number;
    estimated_rows?: number;
    [key: string]: unknown;
  };
  code_counts?: Array<{ concept: string; count: number; domain?: string; stratum?: string }>;
  stratified_counts?: Array<{ label: string; count: number; percent?: number }>;
  report_content?: {
    markdown?: string;
    html?: string;
    manifest?: Array<{ name: string; kind: string; summary?: string }>;
  };
  report_artifacts?: FinnGenArtifact[];
  result_profile: Array<{ label: string; value: string }>;
}
