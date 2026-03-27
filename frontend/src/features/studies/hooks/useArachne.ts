import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type {
  ArachneNode,
  ArachneDistributePayload,
  ArachneDistributeResponse,
  ArachneStatusResponse,
} from "../types/study";

// ---------------------------------------------------------------------------
// Arachne Federated Execution Hooks
// ---------------------------------------------------------------------------

export function useArachneNodes() {
  return useQuery({
    queryKey: ["arachne", "nodes"],
    queryFn: async (): Promise<ArachneNode[]> => {
      const { data } = await apiClient.get<{ data: ArachneNode[] }>("/arachne/nodes");
      return data.data;
    },
    staleTime: 60_000,
  });
}

export function useDistributeStudy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: ArachneDistributePayload): Promise<ArachneDistributeResponse> => {
      const { data } = await apiClient.post<{ data: ArachneDistributeResponse }>(
        "/arachne/distribute",
        payload,
      );
      return data.data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["arachne", "status", variables.study_slug] });
    },
  });
}

export function useArachneStatus(studySlug: string) {
  return useQuery({
    queryKey: ["arachne", "status", studySlug],
    queryFn: async (): Promise<ArachneStatusResponse> => {
      const { data } = await apiClient.get<{ data: ArachneStatusResponse }>(
        `/arachne/studies/${studySlug}/status`,
      );
      return data.data;
    },
    enabled: studySlug !== "",
    refetchInterval: (query) => {
      const executions = query.state.data?.executions ?? [];
      const hasActive = executions.some((ex) =>
        ex.submissions.some((s) => s.status === "PENDING" || s.status === "EXECUTING"),
      );
      return hasActive ? 15_000 : false;
    },
  });
}

export function useArachneResults(studySlug: string, executionId: number) {
  return useQuery({
    queryKey: ["arachne", "results", studySlug, executionId],
    queryFn: async (): Promise<Record<string, unknown>> => {
      const { data } = await apiClient.get<{ data: Record<string, unknown> }>(
        `/arachne/studies/${studySlug}/results/${executionId}`,
      );
      return data.data;
    },
    enabled: executionId > 0,
  });
}
