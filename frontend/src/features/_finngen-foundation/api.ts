import apiClient from "@/lib/api-client";

import type {
  CreateFinnGenRunBody,
  FinnGenAnalysisModule,
  FinnGenRun,
  FinnGenRunsListResponse,
} from "./types";

export type ListRunsParams = {
  status?: string;
  analysis_type?: string;
  source_key?: string;
  pinned?: boolean;
  page?: number;
  per_page?: number;
};

export const finngenApi = {
  listRuns: async (params?: ListRunsParams): Promise<FinnGenRunsListResponse> => {
    const { data } = await apiClient.get<FinnGenRunsListResponse>("/finngen/runs", { params });
    return data;
  },

  getRun: async (id: string): Promise<FinnGenRun> => {
    const { data } = await apiClient.get<FinnGenRun>(`/finngen/runs/${id}`);
    return data;
  },

  createRun: async (
    body: CreateFinnGenRunBody,
    idempotencyKey: string,
  ): Promise<FinnGenRun> => {
    const { data } = await apiClient.post<FinnGenRun>("/finngen/runs", body, {
      headers: { "Idempotency-Key": idempotencyKey },
    });
    return data;
  },

  cancelRun: async (id: string): Promise<FinnGenRun> => {
    const { data } = await apiClient.post<FinnGenRun>(`/finngen/runs/${id}/cancel`);
    return data;
  },

  pinRun: async (id: string): Promise<FinnGenRun> => {
    const { data } = await apiClient.post<FinnGenRun>(`/finngen/runs/${id}/pin`);
    return data;
  },

  unpinRun: async (id: string): Promise<FinnGenRun> => {
    const { data } = await apiClient.delete<FinnGenRun>(`/finngen/runs/${id}/pin`);
    return data;
  },

  /**
   * Sync read proxy. `path` is the tail of the endpoint beneath /finngen/sync/,
   * e.g. "romopapi/code-counts" or "hades/overlap".
   */
  syncRead: async <T = unknown>(
    path: string,
    params: Record<string, unknown>,
    opts: { refresh?: boolean } = {},
  ): Promise<T> => {
    const { data } = await apiClient.get<T>(`/finngen/sync/${path}`, {
      params: { ...params, ...(opts.refresh ? { refresh: "true" } : {}) },
    });
    return data;
  },

  listModules: async (): Promise<{ data: FinnGenAnalysisModule[] }> => {
    const { data } = await apiClient.get<{ data: FinnGenAnalysisModule[] }>(
      "/finngen/analyses/modules",
    );
    return data;
  },
};
