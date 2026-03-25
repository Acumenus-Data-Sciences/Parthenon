import apiClient from "@/lib/api-client";
import type {
  DqTrendPoint,
  DqCategoryTrendPoint,
  DqDomainTrendPoint,
  DqDelta,
  UnmappedCodeSummary,
  UnmappedCode,
  PaginatedResponse,
  DomainContinuityPoint,
  MappingSuggestion,
  AcceptedMapping,
} from "../types/ares";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap<T>(body: any): T {
  if (body && typeof body === "object" && "data" in body && !Array.isArray(body)) {
    return body.data as T;
  }
  return body as T;
}

// DQ History
export async function fetchDqHistory(sourceId: number): Promise<DqTrendPoint[]> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/dq-history`);
  return unwrap<DqTrendPoint[]>(data);
}

export async function fetchDqDeltas(sourceId: number, releaseId: number): Promise<DqDelta[]> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/dq-history/deltas`, {
    params: { release_id: releaseId },
  });
  return unwrap<DqDelta[]>(data);
}

export async function fetchDqCategoryTrends(sourceId: number): Promise<DqCategoryTrendPoint[]> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/dq-history/category-trends`);
  return unwrap<DqCategoryTrendPoint[]>(data);
}

export async function fetchDqDomainTrends(sourceId: number): Promise<DqDomainTrendPoint[]> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/dq-history/domain-trends`);
  return unwrap<DqDomainTrendPoint[]>(data);
}

// DQ Heatmap
export interface DqHeatmapData {
  releases: Array<{ id: number; name: string; date: string }>;
  categories: string[];
  cells: Array<{ release_id: number; category: string; pass_rate: number }>;
}

export async function fetchDqHeatmap(sourceId: number): Promise<DqHeatmapData> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/dq-history/heatmap`);
  return unwrap<DqHeatmapData>(data);
}

// DQ Check Sparklines
export async function fetchDqCheckSparklines(
  sourceId: number,
  releaseId: number,
): Promise<Record<string, Array<boolean | null>>> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/dq-history/sparklines`, {
    params: { release_id: releaseId },
  });
  return unwrap<Record<string, Array<boolean | null>>>(data);
}

// Unmapped Codes
export async function fetchUnmappedCodesSummary(
  sourceId: number,
  releaseId: number,
): Promise<UnmappedCodeSummary[]> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/unmapped-codes/summary`, {
    params: { release_id: releaseId },
  });
  return unwrap<UnmappedCodeSummary[]>(data);
}

export async function fetchUnmappedCodes(
  sourceId: number,
  releaseId: number,
  filters: { table?: string; field?: string; search?: string; page?: number; per_page?: number } = {},
): Promise<PaginatedResponse<UnmappedCode>> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/unmapped-codes`, {
    params: { release_id: releaseId, ...filters },
  });
  return data as PaginatedResponse<UnmappedCode>;
}

// Unmapped Codes — Pareto
export async function fetchUnmappedCodesPareto(
  sourceId: number,
  releaseId: number,
): Promise<{ codes: Array<{ source_code: string; record_count: number; cumulative_percent: number }>; top_20_coverage: number }> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/unmapped-codes/pareto`, {
    params: { release_id: releaseId },
  });
  return unwrap(data);
}

// Unmapped Codes — Progress
export async function fetchUnmappedCodesProgress(
  sourceId: number,
  releaseId: number,
): Promise<{ total: number; mapped: number; deferred: number; excluded: number; pending: number }> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/unmapped-codes/progress`, {
    params: { release_id: releaseId },
  });
  return unwrap(data);
}

// Unmapped Codes — Treemap
export async function fetchUnmappedCodesTreemap(
  sourceId: number,
  releaseId: number,
): Promise<Array<{ name: string; value: number; code_count: number }>> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/unmapped-codes/treemap`, {
    params: { release_id: releaseId },
  });
  return unwrap(data);
}

// Unmapped Codes — Export
export async function fetchUnmappedCodesExport(
  sourceId: number,
  releaseId: number,
  format: "usagi" | "csv" = "csv",
): Promise<unknown> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/unmapped-codes/export`, {
    params: { release_id: releaseId, format },
  });
  return unwrap(data);
}

// Domain Continuity
export async function fetchDomainContinuity(sourceId: number): Promise<DomainContinuityPoint[]> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/domain-continuity`);
  return unwrap<DomainContinuityPoint[]>(data);
}

// Mapping Suggestions (AI-powered via pgvector)
export async function fetchMappingSuggestions(
  sourceId: number,
  codeId: number,
): Promise<MappingSuggestion[]> {
  const { data } = await apiClient.get(
    `/sources/${sourceId}/ares/unmapped-codes/${codeId}/suggestions`,
  );
  return unwrap<MappingSuggestion[]>(data);
}

// Accept mapping suggestion
export async function acceptMappingSuggestion(
  sourceId: number,
  codeId: number,
  payload: { target_concept_id: number; confidence_score?: number },
): Promise<AcceptedMapping> {
  const { data } = await apiClient.post(
    `/sources/${sourceId}/ares/unmapped-codes/${codeId}/map`,
    payload,
  );
  return unwrap<AcceptedMapping>(data);
}

// DQ Radar
import type { DqRadarProfile, DqSlaTarget, DqSlaCompliance, DqSlaTargetInput } from "../types/ares";

export async function fetchDqRadar(sourceId: number): Promise<DqRadarProfile> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/dq-radar`);
  return unwrap<DqRadarProfile>(data);
}

// DQ SLA
export async function fetchDqSlaTargets(sourceId: number): Promise<DqSlaTarget[]> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/dq-sla`);
  return unwrap<DqSlaTarget[]>(data);
}

export async function storeDqSlaTargets(
  sourceId: number,
  targets: DqSlaTargetInput[],
): Promise<DqSlaTarget[]> {
  const { data } = await apiClient.post(`/sources/${sourceId}/ares/dq-sla`, { targets });
  return unwrap<DqSlaTarget[]>(data);
}

export async function fetchDqSlaCompliance(sourceId: number): Promise<DqSlaCompliance[]> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/dq-sla/compliance`);
  return unwrap<DqSlaCompliance[]>(data);
}

// DQ History Export
export async function fetchDqHistoryExport(
  sourceId: number,
  format: string = "csv",
): Promise<{ format: string; filename: string; content: string }> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/dq-history/export`, {
    params: { format },
  });
  return unwrap(data);
}
