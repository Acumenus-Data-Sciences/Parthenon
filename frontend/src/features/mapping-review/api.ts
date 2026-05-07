// Phase 3 Plan 7 Task 6 (T-024B) — TanStack Query hooks for Harmonia review.
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type {
  ApproveBody,
  EscalateBody,
  PaginatedQueue,
  QueueDetail,
  QueueFilters,
  QueueStats,
  RejectBody,
} from "./types";

const ROOT_KEY = ["mapping-review"] as const;

function queueKey(filters: QueueFilters) {
  return [
    ...ROOT_KEY,
    "queue",
    filters.status ?? "pending",
    filters.source_vocab ?? "",
    filters.q ?? "",
    filters.sort_by ?? "confidence_asc",
    filters.per_page ?? 50,
    filters.page ?? 1,
  ] as const;
}

function detailKey(queueId: number) {
  return [...ROOT_KEY, "detail", queueId] as const;
}

const statsKey = [...ROOT_KEY, "stats"] as const;

function buildParams(filters: QueueFilters): Record<string, string> {
  const params: Record<string, string> = {};
  if (filters.status && filters.status !== "all") params.status = filters.status;
  if (filters.status === "all") params.status = "all";
  if (filters.source_vocab) params.source_vocab = filters.source_vocab;
  if (filters.q) params.q = filters.q;
  if (filters.sort_by) params.sort_by = filters.sort_by;
  if (filters.per_page) params.per_page = String(filters.per_page);
  if (filters.page) params.page = String(filters.page);
  return params;
}

export function useMappingReviewQueue(filters: QueueFilters) {
  return useQuery<PaginatedQueue>({
    queryKey: queueKey(filters),
    queryFn: async () => {
      const { data } = await apiClient.get<PaginatedQueue>(
        "/mapping-review/queue",
        { params: buildParams(filters) },
      );
      return data;
    },
    placeholderData: keepPreviousData,
    staleTime: 10 * 1000,
  });
}

export function useMappingReviewStats() {
  return useQuery<QueueStats>({
    queryKey: statsKey,
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: QueueStats }>(
        "/mapping-review/queue/stats",
      );
      return data.data;
    },
    refetchInterval: 5 * 1000,
    staleTime: 0,
  });
}

export function useMappingReviewDetail(queueId: number | null) {
  return useQuery<QueueDetail>({
    queryKey: detailKey(queueId ?? 0),
    enabled: queueId !== null && Number.isFinite(queueId) && queueId > 0,
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: QueueDetail }>(
        `/mapping-review/queue/${queueId}`,
      );
      return data.data;
    },
    staleTime: 10 * 1000,
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({ queryKey: ROOT_KEY });
}

export function useApproveMappingMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { queueId: number; body: ApproveBody }>({
    mutationFn: async ({ queueId, body }) => {
      const { data } = await apiClient.post(
        `/mapping-review/queue/${queueId}/approve`,
        body,
      );
      return data;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useRejectMappingMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { queueId: number; body: RejectBody }>({
    mutationFn: async ({ queueId, body }) => {
      const { data } = await apiClient.post(
        `/mapping-review/queue/${queueId}/reject`,
        body,
      );
      return data;
    },
    onSuccess: () => invalidateAll(qc),
  });
}

export function useEscalateMappingMutation() {
  const qc = useQueryClient();
  return useMutation<unknown, Error, { queueId: number; body: EscalateBody }>({
    mutationFn: async ({ queueId, body }) => {
      const { data } = await apiClient.post(
        `/mapping-review/queue/${queueId}/escalate`,
        body,
      );
      return data;
    },
    onSuccess: () => invalidateAll(qc),
  });
}
