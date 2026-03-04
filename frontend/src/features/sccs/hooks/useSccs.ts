import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listSccs,
  getSccs,
  createSccs,
  updateSccs,
  deleteSccs,
  executeSccs,
  listSccsExecutions,
  getSccsExecution,
} from "../api/sccsApi";
import type { SccsDesign } from "../types/sccs";

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useSccsAnalyses(page?: number, search?: string) {
  return useQuery({
    queryKey: ["sccs", { page, search }],
    queryFn: () => listSccs({ page, search }),
  });
}

export function useSccsAnalysis(id: number | null) {
  return useQuery({
    queryKey: ["sccs", id],
    queryFn: () => getSccs(id!),
    enabled: id != null && id > 0,
  });
}

export function useSccsExecutions(id: number | null) {
  return useQuery({
    queryKey: ["sccs", id, "executions"],
    queryFn: () => listSccsExecutions(id!),
    enabled: id != null && id > 0,
  });
}

export function useSccsExecution(
  id: number | null,
  executionId: number | null,
) {
  return useQuery({
    queryKey: ["sccs", id, "executions", executionId],
    queryFn: () => getSccsExecution(id!, executionId!),
    enabled:
      id != null && id > 0 && executionId != null && executionId > 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "running" || status === "queued" || status === "pending") {
        return 2000;
      }
      return false;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateSccs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      name: string;
      description?: string;
      design_json: SccsDesign;
    }) => createSccs(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sccs"] });
    },
  });
}

export function useUpdateSccs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: Partial<{
        name: string;
        description: string;
        design_json: SccsDesign;
      }>;
    }) => updateSccs(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["sccs", variables.id] });
      queryClient.invalidateQueries({ queryKey: ["sccs"] });
    },
  });
}

export function useDeleteSccs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteSccs(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sccs"] });
    },
  });
}

export function useExecuteSccs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, sourceId }: { id: number; sourceId: number }) =>
      executeSccs(id, sourceId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["sccs", variables.id, "executions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["sccs", variables.id],
      });
    },
  });
}
