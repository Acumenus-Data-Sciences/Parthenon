import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listPredictions,
  getPrediction,
  createPrediction,
  updatePrediction,
  deletePrediction,
  executePrediction,
  listPredictionExecutions,
  getPredictionExecution,
} from "../api/predictionApi";
import type { PredictionDesign } from "../types/prediction";

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function usePredictions(page?: number) {
  return useQuery({
    queryKey: ["predictions", { page }],
    queryFn: () => listPredictions({ page }),
  });
}

export function usePrediction(id: number | null) {
  return useQuery({
    queryKey: ["predictions", id],
    queryFn: () => getPrediction(id!),
    enabled: id != null && id > 0,
  });
}

export function usePredictionExecutions(id: number | null) {
  return useQuery({
    queryKey: ["predictions", id, "executions"],
    queryFn: () => listPredictionExecutions(id!),
    enabled: id != null && id > 0,
  });
}

export function usePredictionExecution(
  id: number | null,
  executionId: number | null,
) {
  return useQuery({
    queryKey: ["predictions", id, "executions", executionId],
    queryFn: () => getPredictionExecution(id!, executionId!),
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

export function useCreatePrediction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      name: string;
      description?: string;
      design_json: PredictionDesign;
    }) => createPrediction(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["predictions"] });
    },
  });
}

export function useUpdatePrediction() {
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
        design_json: PredictionDesign;
      }>;
    }) => updatePrediction(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["predictions", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["predictions"] });
    },
  });
}

export function useDeletePrediction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deletePrediction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["predictions"] });
    },
  });
}

export function useExecutePrediction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, sourceId }: { id: number; sourceId: number }) =>
      executePrediction(id, sourceId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["predictions", variables.id, "executions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["predictions", variables.id],
      });
    },
  });
}
