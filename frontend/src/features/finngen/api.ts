import apiClient from "@/lib/api-client";
import type {
  FinnGenCo2AnalysisResult,
  FinnGenCohortOperationsResult,
  FinnGenHadesExtrasResult,
  FinnGenRun,
  FinnGenRomopapiResult,
  FinnGenServicesResponse,
  FinnGenSource,
} from "./types";

export async function fetchFinnGenServices(): Promise<FinnGenServicesResponse> {
  const { data } = await apiClient.get("/study-agent/services");
  const payload = data.data ?? data;

  return {
    services: Array.isArray(payload?.services)
      ? payload.services.filter((service: { name?: string }) => {
          const name = String(service?.name ?? "");
          return name.startsWith("finngen_") || name.startsWith("community_");
        })
      : [],
    warnings: Array.isArray(payload?.warnings) ? payload.warnings : [],
  };
}

export async function previewFinnGenCohortOperations(payload: {
  source: FinnGenSource;
  cohort_definition: Record<string, unknown>;
  execution_mode?: string;
  import_mode?: string;
  operation_type?: string;
  atlas_cohort_ids?: number[];
  atlas_import_behavior?: string;
  cohort_table_name?: string;
  file_name?: string;
  file_format?: string;
  file_row_count?: number;
  file_columns?: string[];
  file_contents?: string;
  selected_cohort_ids?: number[];
  selected_cohort_labels?: string[];
  primary_cohort_id?: number | null;
  matching_enabled?: boolean;
  matching_strategy?: string;
  matching_target?: string;
  matching_covariates?: string[];
  matching_ratio?: number;
  matching_caliper?: number;
  export_target?: string;
}): Promise<FinnGenCohortOperationsResult> {
  const { data } = await apiClient.post("/study-agent/finngen/cohort-operations", payload);
  return data.data ?? data;
}

export async function previewFinnGenCo2Analysis(payload: {
  source: FinnGenSource;
  module_key: string;
  cohort_label?: string;
  outcome_name?: string;
  cohort_context?: Record<string, unknown>;
  comparator_label?: string;
  sensitivity_label?: string;
  burden_domain?: string;
  exposure_window?: string;
  stratify_by?: string;
  time_window_unit?: string;
  time_window_count?: number;
  gwas_trait?: string;
  gwas_method?: string;
}): Promise<FinnGenCo2AnalysisResult> {
  const { data } = await apiClient.post("/study-agent/finngen/co2-analysis", payload);
  return data.data ?? data;
}

export async function previewFinnGenHadesExtras(payload: {
  source: FinnGenSource;
  sql_template: string;
  package_name?: string;
  render_target?: string;
  config_profile?: string;
  artifact_mode?: string;
  package_skeleton?: string;
  cohort_table?: string;
  config_yaml?: string;
}): Promise<FinnGenHadesExtrasResult> {
  const { data } = await apiClient.post("/study-agent/finngen/hades-extras", payload);
  return data.data ?? data;
}

export async function previewFinnGenRomopapi(payload: {
  source: FinnGenSource;
  schema_scope?: string;
  query_template?: string;
  concept_domain?: string;
  stratify_by?: string;
  result_limit?: number;
  lineage_depth?: number;
  request_method?: string;
  response_format?: string;
  cache_mode?: string;
  report_format?: string;
}): Promise<FinnGenRomopapiResult> {
  const { data } = await apiClient.post("/study-agent/finngen/romopapi", payload);
  return data.data ?? data;
}

export async function fetchFinnGenRuns(params: {
  service_name?: string;
  source_id?: number;
  limit?: number;
}): Promise<FinnGenRun[]> {
  const { data } = await apiClient.get("/study-agent/finngen/runs", { params });
  const payload = data.data ?? data;
  return Array.isArray(payload?.runs) ? payload.runs : [];
}

export async function fetchFinnGenRun(runId: number): Promise<FinnGenRun | null> {
  const { data } = await apiClient.get(`/study-agent/finngen/runs/${runId}`);
  const payload = data.data ?? data;
  return payload?.run ?? null;
}

export async function replayFinnGenRun(runId: number): Promise<FinnGenRun | null> {
  const { data } = await apiClient.post(`/study-agent/finngen/runs/${runId}/replay`);
  const payload = data.data ?? data;
  return payload?.run ?? null;
}

export async function exportFinnGenRun(runId: number): Promise<Record<string, unknown> | null> {
  const { data } = await apiClient.get(`/study-agent/finngen/runs/${runId}/export`);
  const payload = data.data ?? data;
  return payload ?? null;
}
