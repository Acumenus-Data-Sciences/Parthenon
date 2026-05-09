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

const BASE = "/ingestion/templates";

// ── Catalog ────────────────────────────────────────────────────────────────
//
// All `/ingestion/templates/*` endpoints (except run history) return their
// payload directly — no `{data: ...}` envelope. The Laravel TemplatePresenter
// flattens upstream Kubernetes-style manifests into the SPA's flat shape.
// See backend/tests/Feature/Templates/TemplatesController*.php for the
// authoritative contract.

export function useTemplates(): UseQueryResult<Template[]> {
  return useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const { data } = await apiClient.get<Template[]>(BASE);
      return data;
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
      const { data } = await apiClient.get<TemplateManifest>(`${BASE}/${id}`);
      return data;
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
  template_run_id: number;
  ingestion_job_id: number | null;
  status: TemplateRunStatus;
}

export function useSubmitTemplateRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      input: SubmitTemplateRunInput,
    ): Promise<SubmitTemplateRunResponse> => {
      const { data } = await apiClient.post<SubmitTemplateRunResponse>(
        `${BASE}/${input.templateId}/runs`,
        {
          version: input.version,
          parameters: input.parameters,
        },
      );
      return data;
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
      const { data } = await apiClient.get<TemplateRun>(
        `${BASE}/runs/${runId}`,
      );
      return data;
    },
    refetchInterval: (q) => templateRunRefetchInterval(q.state.data),
  });
}

interface RunLogsResponse {
  lines: TemplateRunLog[];
}

interface RunArtifactsResponse {
  artifacts: TemplateRunArtifact[];
}

export function useTemplateRunLogs(
  runId: number | null,
  status: TemplateRunStatus | undefined,
): UseQueryResult<TemplateRunLog[]> {
  return useQuery({
    queryKey: ["template-runs", runId, "logs"],
    enabled: runId !== null,
    queryFn: async () => {
      const { data } = await apiClient.get<RunLogsResponse>(
        `${BASE}/runs/${runId}/logs`,
      );
      return data.lines ?? [];
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
      const { data } = await apiClient.get<RunArtifactsResponse>(
        `${BASE}/runs/${runId}/artifacts`,
      );
      return data.artifacts ?? [];
    },
  });
}

interface CancelRunResponse {
  ok: boolean;
  id: number;
  status: TemplateRunStatus;
}

export function useCancelTemplateRun(runId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<CancelRunResponse> => {
      const { data } = await apiClient.delete<CancelRunResponse>(
        `${BASE}/runs/${runId}`,
      );
      return data;
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
