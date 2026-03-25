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

// Domain Continuity
export async function fetchDomainContinuity(sourceId: number): Promise<DomainContinuityPoint[]> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/domain-continuity`);
  return unwrap<DomainContinuityPoint[]>(data);
}
