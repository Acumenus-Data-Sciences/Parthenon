import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createAnalysis,
  executeAnalysis,
  fetchExecution,
  fetchExecutions,
} from "../api";

export function useCreateAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      apiPrefix,
      payload,
    }: {
      apiPrefix: string;
      payload: Record<string, unknown>;
    }) => createAnalysis(apiPrefix, payload),
  });
}

export function useExecuteAnalysis() {
  return useMutation({
    mutationFn: ({
      apiPrefix,
      analysisId,
      sourceId,
    }: {
      apiPrefix: string;
      analysisId: number;
      sourceId?: number;
    }) => executeAnalysis(apiPrefix, analysisId, sourceId),
  });
}

export function useExecution(
  apiPrefix: string,
  analysisId: number,
  executionId: number | null,
) {
  return useQuery({
    queryKey: ["execution", apiPrefix, analysisId, executionId],
    queryFn: () => fetchExecution(apiPrefix, analysisId, executionId!),
    enabled: !!executionId && !!analysisId,
    refetchInterval: (query) => {
      const status = (
        query.state.data as Record<string, unknown> | undefined
      )?.status as string | undefined;
      if (!status) return 2000;
      const isTerminal = ["completed", "failed", "cancelled"].includes(status);
      return isTerminal ? false : 2000;
    },
  });
}

export function useExecutions(apiPrefix: string, analysisId: number) {
  return useQuery({
    queryKey: ["executions", apiPrefix, analysisId],
    queryFn: () => fetchExecutions(apiPrefix, analysisId),
    enabled: !!analysisId,
  });
}
