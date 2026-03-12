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
