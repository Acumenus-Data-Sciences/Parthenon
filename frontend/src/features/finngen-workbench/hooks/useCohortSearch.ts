// frontend/src/features/finngen-workbench/hooks/useCohortSearch.ts
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";

export type CohortSummary = {
  id: number;
  name: string;
  description?: string | null;
  latest_generation?: { person_count?: number | null } | null;
};

type CohortListResponse = {
  data: CohortSummary[];
  total?: number;
};

/**
 * Lightweight typeahead search against /api/v1/cohort-definitions. Returns
 * up to 20 matches; relies on the existing Solr-backed search when available
 * with a SQL LIKE fallback inside the controller.
 */
export function useCohortSearch(query: string, limit = 20) {
  return useQuery<CohortSummary[]>({
    queryKey: ["finngen", "workbench", "cohort-search", query, limit],
    queryFn: async () => {
      const { data } = await apiClient.get<CohortListResponse>("/cohort-definitions", {
        params: { search: query, per_page: limit },
      });
      return data.data ?? [];
    },
    // Don't fire empty queries — caller can render a neutral empty state.
    enabled: query.trim().length > 0,
    staleTime: 30_000,
  });
}

/**
 * Single-cohort fetch by id, used when the picker has a pre-selected value
 * but we want to show the name next to the input.
 */
export function useCohortById(id: number | null) {
  return useQuery<CohortSummary | null>({
    queryKey: ["finngen", "workbench", "cohort-by-id", id],
    queryFn: async () => {
      if (id === null) return null;
      const { data } = await apiClient.get<{ data: CohortSummary }>(
        `/cohort-definitions/${id}`,
      );
      return data.data ?? null;
    },
    enabled: id !== null,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Unfiltered browse (default sort) for the Import Cohorts step. Unlike
 * useCohortSearch, this fires on empty query too so the step has something
 * to show the researcher before they type. Pagination via page + per_page.
 */
export function useCohortBrowse(args: { search?: string; page?: number; perPage?: number } = {}) {
  const { search = "", page = 1, perPage = 50 } = args;
  return useQuery<{ items: CohortSummary[]; total: number }>({
    queryKey: ["finngen", "workbench", "cohort-browse", search, page, perPage],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: CohortSummary[]; total?: number }>(
        "/cohort-definitions",
        { params: { search, page, per_page: perPage } },
      );
      return { items: data.data ?? [], total: data.total ?? (data.data?.length ?? 0) };
    },
    staleTime: 30_000,
  });
}
