import { useQuery, useMutation } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types — WhiteRabbit Source Profiler
// ---------------------------------------------------------------------------

export interface ScanRequest {
  source_id: number;
  tables?: string[];
}

export interface ColumnProfile {
  name: string;
  type: string;
  n_rows: number;
  fraction_empty: number;
  unique_count: number;
  values?: Record<string, number>;
  is_potential_pii?: boolean;
  pii_type?: string | null;
}

export interface TableProfile {
  table_name: string;
  row_count: number;
  column_count: number;
  columns: ColumnProfile[];
}

export interface ScanResult {
  status: string;
  tables: TableProfile[];
  scan_time_seconds: number;
}

export interface WhiteRabbitHealth {
  available: boolean;
  version?: string;
}

// ---------------------------------------------------------------------------
// Types — Synthea Generator
// ---------------------------------------------------------------------------

export interface SyntheaGenerateRequest {
  source_id: number;
  patient_count: number;
  synthea_csv_folder: string;
  cdm_version?: string;
}

export interface SyntheaGenerateResult {
  status: string;
  summary: {
    person_count: number;
    total_rows: number;
    tables: Record<string, number>;
  };
  elapsed_seconds: number;
}

export interface SyntheaStatus {
  available: boolean;
  version: string;
  capabilities: string[];
}

// ---------------------------------------------------------------------------
// API functions — WhiteRabbit
// ---------------------------------------------------------------------------

export async function scanDatabase(request: ScanRequest): Promise<ScanResult> {
  const { data } = await apiClient.post<ScanResult | { data: ScanResult }>(
    "/etl/scan",
    request,
  );
  // unwrap Laravel envelope if present
  if ("data" in data && typeof (data as { data: unknown }).data === "object") {
    return (data as { data: ScanResult }).data;
  }
  return data as ScanResult;
}

export async function fetchWhiteRabbitHealth(): Promise<WhiteRabbitHealth> {
  const { data } = await apiClient.get<
    { data: { status: string; service: string; version?: string } } | WhiteRabbitHealth
  >("/etl/scan/health");

  // WhiteRabbit returns { data: { status: "ok", service: "whiterabbit" } }
  // Map to the expected { available, version } shape
  const raw =
    "data" in data && typeof (data as { data: unknown }).data === "object"
      ? (data as { data: { status?: string; version?: string } }).data
      : (data as { status?: string; version?: string });

  return {
    available: raw.status === "ok",
    version: raw.version,
  };
}

// ---------------------------------------------------------------------------
// API functions — Synthea
// ---------------------------------------------------------------------------

export async function generateSynthea(
  request: SyntheaGenerateRequest,
): Promise<SyntheaGenerateResult> {
  const { data } = await apiClient.post<
    SyntheaGenerateResult | { data: SyntheaGenerateResult }
  >("/etl/synthea/generate", request);
  if ("data" in data && typeof (data as { data: unknown }).data === "object") {
    return (data as { data: SyntheaGenerateResult }).data;
  }
  return data as SyntheaGenerateResult;
}

export async function fetchSyntheaStatus(): Promise<SyntheaStatus> {
  const { data } = await apiClient.get<SyntheaStatus | { data: SyntheaStatus }>(
    "/etl/synthea/status",
  );
  if ("data" in data && typeof (data as { data: unknown }).data === "object") {
    return (data as { data: SyntheaStatus }).data;
  }
  return data as SyntheaStatus;
}

// ---------------------------------------------------------------------------
// TanStack Query hooks
// ---------------------------------------------------------------------------

export function useWhiteRabbitHealth() {
  return useQuery({
    queryKey: ["etl", "whiterabbit-health"],
    queryFn: fetchWhiteRabbitHealth,
    staleTime: 30_000,
    retry: false,
  });
}

export function useSyntheaStatus() {
  return useQuery({
    queryKey: ["etl", "synthea-status"],
    queryFn: fetchSyntheaStatus,
    staleTime: 30_000,
    retry: false,
  });
}

export function useScanDatabase() {
  return useMutation({
    mutationFn: scanDatabase,
  });
}

export function useGenerateSynthea() {
  return useMutation({
    mutationFn: generateSynthea,
  });
}

// ---------------------------------------------------------------------------
// Types — Source Profiler (persisted)
// ---------------------------------------------------------------------------

export interface ProfileSummary {
  id: number;
  source_id: number;
  scan_type: string;
  scan_time_seconds: number;
  overall_grade: string;
  table_count: number;
  column_count: number;
  total_rows: number;
  summary_json: {
    high_null_columns: number;
    empty_tables: number;
    low_cardinality_columns: number;
    single_value_columns: number;
  };
  created_at: string;
}

export interface PersistedFieldProfile {
  id: number;
  source_profile_id: number;
  table_name: string;
  row_count: number;
  column_name: string;
  column_index: number;
  inferred_type: string;
  null_percentage: number;
  distinct_count: number;
  sample_values: Record<string, number> | null;
  is_potential_pii: boolean;
  pii_type: string | null;
}

export interface PersistedProfile extends ProfileSummary {
  fields: PersistedFieldProfile[];
}

export interface PaginatedProfiles {
  data: ProfileSummary[];
  current_page: number;
  last_page: number;
  total: number;
}

// ---------------------------------------------------------------------------
// API functions — Source Profiler (persisted)
// ---------------------------------------------------------------------------

export async function fetchProfileHistory(sourceId: number): Promise<PaginatedProfiles> {
  const { data } = await apiClient.get<PaginatedProfiles>(
    `/sources/${sourceId}/scan-profiles`,
  );
  return data;
}

export async function fetchProfile(sourceId: number, profileId: number): Promise<PersistedProfile> {
  const { data } = await apiClient.get<{ data: PersistedProfile }>(
    `/sources/${sourceId}/scan-profiles/${profileId}`,
  );
  return data.data;
}

export async function runPersistedScan(
  sourceId: number,
  request: { tables?: string[]; sample_rows?: number },
): Promise<ProfileSummary> {
  const { data } = await apiClient.post<{ data: ProfileSummary }>(
    `/sources/${sourceId}/scan-profiles/scan`,
    request,
  );
  return data.data;
}

export async function deleteProfile(sourceId: number, profileId: number): Promise<void> {
  await apiClient.delete(`/sources/${sourceId}/scan-profiles/${profileId}`);
}

// ---------------------------------------------------------------------------
// Types — Scan Comparison
// ---------------------------------------------------------------------------

export interface ComparisonData {
  summary: {
    grade_change: { baseline: string; current: string };
    regressions: number;
    improvements: number;
    schema_changes: number;
    row_count_delta: { baseline: number; current: number; delta_pct: number };
  };
  regressions: Array<{
    table: string;
    column: string;
    metric: string;
    baseline: number;
    current: number;
    delta: number;
  }>;
  improvements: Array<{
    table: string;
    column: string;
    metric: string;
    baseline: number;
    current: number;
    delta: number;
  }>;
  schema_changes: Array<{
    table: string;
    column: string;
    change: string;
    type: string;
  }>;
}

// ---------------------------------------------------------------------------
// API functions — Scan Comparison
// ---------------------------------------------------------------------------

export async function fetchComparison(
  sourceId: number,
  currentId: number,
  baselineId: number,
): Promise<ComparisonData> {
  const { data } = await apiClient.get<{ data: ComparisonData }>(
    `/sources/${sourceId}/scan-profiles/compare`,
    { params: { current: currentId, baseline: baselineId } },
  );
  return data.data;
}

// ---------------------------------------------------------------------------
// Types — Aqueduct ETL Mapping
// ---------------------------------------------------------------------------

export interface EtlProject {
  id: number;
  source_id: number;
  cdm_version: string;
  name: string;
  status: 'draft' | 'in_review' | 'approved' | 'archived';
  created_by: number;
  scan_profile_id: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  table_mappings?: EtlTableMapping[];
  source?: { id: number; source_name: string };
}

export interface EtlTableMapping {
  id: number;
  etl_project_id: number;
  source_table: string;
  target_table: string;
  logic: string | null;
  is_completed: boolean;
  is_stem: boolean;
  sort_order: number;
  updated_at: string;
  field_mappings_count?: number;
  field_mappings?: EtlFieldMapping[];
}

export interface EtlFieldMapping {
  id: number;
  etl_table_mapping_id: number;
  source_column: string | null;
  target_column: string;
  mapping_type: 'direct' | 'transform' | 'lookup' | 'constant' | 'concat' | 'expression';
  logic: string | null;
  is_required: boolean;
  confidence: number | null;
  is_ai_suggested: boolean;
  is_reviewed: boolean;
}

export interface ProjectProgress {
  mapped_tables: number;
  total_cdm_tables: number;
  field_coverage_pct: number;
}

// ---------------------------------------------------------------------------
// API functions — Aqueduct ETL Mapping
// ---------------------------------------------------------------------------

export async function fetchEtlProjects(): Promise<{ data: EtlProject[]; total: number }> {
  const { data } = await apiClient.get<{ data: EtlProject[]; total: number }>('/etl-projects');
  return data;
}

export async function fetchEtlProject(projectId: number): Promise<{ project: EtlProject; progress: ProjectProgress }> {
  const { data } = await apiClient.get<{ data: EtlProject; progress: ProjectProgress }>(`/etl-projects/${projectId}`);
  return { project: data.data, progress: data.progress };
}

export async function createEtlProject(request: {
  source_id: number;
  cdm_version: string;
  scan_profile_id: number;
  notes?: string;
}): Promise<EtlProject> {
  const { data } = await apiClient.post<{ data: EtlProject }>('/etl-projects', request);
  return data.data;
}

export async function updateEtlProject(projectId: number, updates: {
  name?: string;
  status?: string;
  notes?: string;
}): Promise<EtlProject> {
  const { data } = await apiClient.put<{ data: EtlProject }>(`/etl-projects/${projectId}`, updates);
  return data.data;
}

export async function deleteEtlProject(projectId: number): Promise<void> {
  await apiClient.delete(`/etl-projects/${projectId}`);
}

export async function fetchTableMappings(projectId: number): Promise<EtlTableMapping[]> {
  const { data } = await apiClient.get<{ data: EtlTableMapping[] }>(`/etl-projects/${projectId}/table-mappings`);
  return data.data;
}

export async function createTableMapping(projectId: number, request: {
  source_table: string;
  target_table: string;
  logic?: string;
  is_stem?: boolean;
}): Promise<EtlTableMapping> {
  const { data } = await apiClient.post<{ data: EtlTableMapping }>(`/etl-projects/${projectId}/table-mappings`, request);
  return data.data;
}

export async function updateTableMapping(projectId: number, mappingId: number, updates: {
  logic?: string;
  is_completed?: boolean;
}): Promise<EtlTableMapping> {
  const { data } = await apiClient.put<{ data: EtlTableMapping }>(`/etl-projects/${projectId}/table-mappings/${mappingId}`, updates);
  return data.data;
}

export async function deleteTableMapping(projectId: number, mappingId: number): Promise<void> {
  await apiClient.delete(`/etl-projects/${projectId}/table-mappings/${mappingId}`);
}

export async function fetchFieldMappings(projectId: number, mappingId: number): Promise<EtlFieldMapping[]> {
  const { data } = await apiClient.get<{ data: EtlFieldMapping[] }>(`/etl-projects/${projectId}/table-mappings/${mappingId}/fields`);
  return data.data;
}

export async function bulkUpsertFieldMappings(
  projectId: number,
  mappingId: number,
  fields: Array<Partial<EtlFieldMapping> & { target_column: string }>,
  updatedAt: string,
): Promise<EtlFieldMapping[]> {
  const { data } = await apiClient.put<{ data: EtlFieldMapping[] }>(
    `/etl-projects/${projectId}/table-mappings/${mappingId}/fields`,
    { fields, updated_at: updatedAt },
  );
  return data.data;
}

export async function suggestMappings(projectId: number): Promise<{ table_mappings: number; field_mappings: number }> {
  const { data } = await apiClient.post<{ data: { table_mappings: number; field_mappings: number } }>(
    `/etl-projects/${projectId}/suggest`,
  );
  return data.data;
}

export async function downloadExport(projectId: number, format: 'markdown' | 'sql' | 'json'): Promise<void> {
  const response = await apiClient.get(`/etl-projects/${projectId}/export/${format}`, {
    responseType: format === 'sql' ? 'blob' : format === 'json' ? 'json' : 'text',
  });

  const ext = format === 'markdown' ? 'md' : format === 'sql' ? 'zip' : 'json';
  const mimeType = format === 'sql' ? 'application/zip' : format === 'json' ? 'application/json' : 'text/markdown';

  const blob = format === 'sql'
    ? new Blob([response.data as BlobPart], { type: mimeType })
    : new Blob([typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2)], { type: mimeType });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `etl-export.${ext}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// --- SSE Progress types ---
export interface ScanProgressEvent {
  event: string;
  scan_id?: string;
  total_tables?: number;
  table?: string;
  index?: number;
  of?: number;
  rows?: number;
  columns?: number;
  elapsed_ms?: number;
  total_elapsed_ms?: number;
  succeeded?: number;
  failed?: number;
  message?: string;
}

export async function startAsyncScan(
  sourceId: number,
  request: { tables?: string[]; sample_rows?: number },
): Promise<{ scan_id: string; source_id: number }> {
  const { data } = await apiClient.post<{ data: { scan_id: string; source_id: number } }>(
    `/sources/${sourceId}/scan-profiles/scan-async`,
    request,
  );
  return data.data;
}

export function subscribeScanProgress(
  sourceId: number,
  scanId: string,
  onEvent: (event: ScanProgressEvent) => void,
  onDone: () => void,
  onError: (error: Event) => void,
): () => void {
  const baseUrl = apiClient.defaults.baseURL ?? "";
  const token = localStorage.getItem("auth_token") ?? "";
  const url = `${baseUrl}/sources/${sourceId}/scan-profiles/scan-progress/${scanId}?token=${token}`;

  const eventSource = new EventSource(url);

  eventSource.onmessage = (e) => {
    try {
      const parsed: ScanProgressEvent = JSON.parse(e.data);
      onEvent(parsed);
      if (parsed.event === "completed" || parsed.event === "completed_with_errors") {
        eventSource.close();
        onDone();
      }
    } catch {
      // ignore parse errors
    }
  };

  eventSource.onerror = (e) => {
    eventSource.close();
    onError(e);
  };

  return () => eventSource.close();
}

export async function completeScan(
  sourceId: number,
  scanId: string,
): Promise<ProfileSummary> {
  const { data } = await apiClient.post<{ data: ProfileSummary }>(
    `/sources/${sourceId}/scan-profiles/scan-complete/${scanId}`,
  );
  return data.data;
}
