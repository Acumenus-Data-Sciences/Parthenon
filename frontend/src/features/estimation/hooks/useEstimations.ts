import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listEstimations,
  getEstimation,
  createEstimation,
  updateEstimation,
  deleteEstimation,
  executeEstimation,
  listEstimationExecutions,
  getEstimationExecution,
} from "../api/estimationApi";
import type { EstimationDesign } from "../types/estimation";

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useEstimations(page?: number) {
  return useQuery({
    queryKey: ["estimations", { page }],
    queryFn: () => listEstimations({ page }),
  });
}

export function useEstimation(id: number | null) {
  return useQuery({
    queryKey: ["estimations", id],
    queryFn: () => getEstimation(id!),
    enabled: id != null && id > 0,
  });
}

export function useEstimationExecutions(id: number | null) {
  return useQuery({
    queryKey: ["estimations", id, "executions"],
    queryFn: () => listEstimationExecutions(id!),
    enabled: id != null && id > 0,
  });
}

export function useEstimationExecution(
  id: number | null,
  executionId: number | null,
) {
  return useQuery({
    queryKey: ["estimations", id, "executions", executionId],
    queryFn: () => getEstimationExecution(id!, executionId!),
    enabled:
      id != null && id > 0 && executionId != null && executionId > 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (
        status === "running" ||
        status === "queued" ||
        status === "pending"
      ) {
        return 2000;
      }
      return false;
    },
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateEstimation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      name: string;
      description?: string;
      design_json: EstimationDesign;
    }) => createEstimation(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimations"] });
    },
  });
}

export function useUpdateEstimation() {
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
        design_json: EstimationDesign;
      }>;
    }) => updateEstimation(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["estimations", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["estimations"] });
    },
  });
}

export function useDeleteEstimation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteEstimation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["estimations"] });
    },
  });
}

export function useExecuteEstimation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, sourceId }: { id: number; sourceId: number }) =>
      executeEstimation(id, sourceId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["estimations", variables.id, "executions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["estimations", variables.id],
      });
    },
  });
}
