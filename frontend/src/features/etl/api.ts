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
  const { data } = await apiClient.get<WhiteRabbitHealth | { data: WhiteRabbitHealth }>(
    "/etl/scan/health",
  );
  if ("data" in data && typeof (data as { data: unknown }).data === "object") {
    return (data as { data: WhiteRabbitHealth }).data;
  }
  return data as WhiteRabbitHealth;
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
