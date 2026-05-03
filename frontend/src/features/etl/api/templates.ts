import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import {
  isTerminal,
  type Template,
  type TemplateManifest,
  type TemplateRun,
  type TemplateRunArtifact,
  type TemplateRunLog,
  type TemplateRunStatus,
} from "../types/templates";

interface ApiEnvelope<T> {
  data: T;
}

const BASE = "/ingestion/templates";

// ── Catalog ────────────────────────────────────────────────────────────────

export function useTemplates(): UseQueryResult<Template[]> {
  return useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<Template[]>>(BASE);
      return data.data;
    },
    staleTime: 60_000,
  });
}

export function useTemplate(
  id: string | null,
): UseQueryResult<TemplateManifest> {
  return useQuery({
    queryKey: ["templates", id],
    enabled: id !== null,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<TemplateManifest>>(
        `${BASE}/${id}`,
      );
      return data.data;
    },
  });
}

// ── Runs ───────────────────────────────────────────────────────────────────

export function templateRunRefetchInterval(
  run: TemplateRun | undefined,
): number | false {
  if (!run) return 2000;
  if (isTerminal(run.status)) return false;
  return 2000;
}

export interface SubmitTemplateRunInput {
  templateId: string;
  version: string;
  parameters: Record<string, unknown>;
}

export interface SubmitTemplateRunResponse {
  id: number;
}

export function useSubmitTemplateRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: SubmitTemplateRunInput,
    ): Promise<SubmitTemplateRunResponse> => {
      const { data } = await apiClient.post<
        ApiEnvelope<SubmitTemplateRunResponse>
      >(`${BASE}/${input.templateId}/runs`, {
        version: input.version,
        parameters: input.parameters,
      });
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["template-runs"] });
    },
  });
}

export function useTemplateRun(
  runId: number | null,
): UseQueryResult<TemplateRun> {
  return useQuery({
    queryKey: ["template-runs", runId],
    enabled: runId !== null,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<TemplateRun>>(
        `${BASE}/runs/${runId}`,
      );
      return data.data;
    },
    refetchInterval: (q) => templateRunRefetchInterval(q.state.data),
  });
}

export function useTemplateRunLogs(
  runId: number | null,
  status: TemplateRunStatus | undefined,
): UseQueryResult<TemplateRunLog[]> {
  return useQuery({
    queryKey: ["template-runs", runId, "logs"],
    enabled: runId !== null,
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<TemplateRunLog[]>>(
        `${BASE}/runs/${runId}/logs`,
      );
      return data.data;
    },
    refetchInterval: status && !isTerminal(status) ? 2000 : false,
  });
}

export function useTemplateRunArtifacts(
  runId: number | null,
  status: TemplateRunStatus | undefined,
): UseQueryResult<TemplateRunArtifact[]> {
  return useQuery({
    queryKey: ["template-runs", runId, "artifacts"],
    enabled: runId !== null && status !== undefined && isTerminal(status),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiEnvelope<TemplateRunArtifact[]>>(
        `${BASE}/runs/${runId}/artifacts`,
      );
      return data.data;
    },
  });
}

export function useCancelTemplateRun(runId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<{ ok: true }> => {
      const { data } = await apiClient.delete<ApiEnvelope<{ ok: true }>>(
        `${BASE}/runs/${runId}`,
      );
      return data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["template-runs", runId] });
      qc.invalidateQueries({ queryKey: ["template-runs"] });
    },
  });
}

// ── Run history ────────────────────────────────────────────────────────────

export interface TemplateRunHistoryParams {
  page: number;
  pageSize: number;
  statuses?: TemplateRunStatus[];
}

export interface TemplateRunHistoryResponse {
  data: TemplateRun[];
  meta: { total: number; page: number; per_page: number };
}

export function useTemplateRunHistory(
  params: TemplateRunHistoryParams,
): UseQueryResult<TemplateRunHistoryResponse> {
  return useQuery({
    queryKey: ["template-runs", "history", params],
    queryFn: async () => {
      const search = new URLSearchParams();
      search.set("page", String(params.page));
      search.set("per_page", String(params.pageSize));
      if (params.statuses?.length) {
        for (const s of params.statuses) search.append("status[]", s);
      }
      const { data } = await apiClient.get<TemplateRunHistoryResponse>(
        `${BASE}/runs?${search.toString()}`,
      );
      return data;
    },
    refetchInterval: 5_000,
  });
}
