import { useQuery } from "@tanstack/react-query";
import {
  fetchDqHistory,
  fetchDqDeltas,
  fetchDqCategoryTrends,
  fetchDqDomainTrends,
  fetchUnmappedCodesSummary,
  fetchUnmappedCodes,
  fetchDomainContinuity,
} from "../api/dqHistoryApi";

export function useDqHistory(sourceId: number | null) {
  return useQuery({
    queryKey: ["ares", "dq-history", sourceId],
    queryFn: () => fetchDqHistory(sourceId!),
    enabled: !!sourceId,
  });
}

export function useDqDeltas(sourceId: number | null, releaseId: number | null) {
  return useQuery({
    queryKey: ["ares", "dq-deltas", sourceId, releaseId],
    queryFn: () => fetchDqDeltas(sourceId!, releaseId!),
    enabled: !!sourceId && !!releaseId,
  });
}

export function useDqCategoryTrends(sourceId: number | null) {
  return useQuery({
    queryKey: ["ares", "dq-category-trends", sourceId],
    queryFn: () => fetchDqCategoryTrends(sourceId!),
    enabled: !!sourceId,
  });
}

export function useDqDomainTrends(sourceId: number | null) {
  return useQuery({
    queryKey: ["ares", "dq-domain-trends", sourceId],
    queryFn: () => fetchDqDomainTrends(sourceId!),
    enabled: !!sourceId,
  });
}

export function useUnmappedCodesSummary(sourceId: number | null, releaseId: number | null) {
  return useQuery({
    queryKey: ["ares", "unmapped-summary", sourceId, releaseId],
    queryFn: () => fetchUnmappedCodesSummary(sourceId!, releaseId!),
    enabled: !!sourceId && !!releaseId,
  });
}

export function useUnmappedCodes(
  sourceId: number | null,
  releaseId: number | null,
  filters: { table?: string; field?: string; search?: string; page?: number; per_page?: number } = {},
) {
  return useQuery({
    queryKey: ["ares", "unmapped-codes", sourceId, releaseId, filters],
    queryFn: () => fetchUnmappedCodes(sourceId!, releaseId!, filters),
    enabled: !!sourceId && !!releaseId,
  });
}

export function useDomainContinuity(sourceId: number | null) {
  return useQuery({
    queryKey: ["ares", "domain-continuity", sourceId],
    queryFn: () => fetchDomainContinuity(sourceId!),
    enabled: !!sourceId,
  });
}
