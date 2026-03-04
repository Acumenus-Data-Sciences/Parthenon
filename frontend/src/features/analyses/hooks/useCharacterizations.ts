import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listCharacterizations,
  getCharacterization,
  createCharacterization,
  updateCharacterization,
  deleteCharacterization,
  executeCharacterization,
  listExecutions,
  getExecution,
} from "../api/characterizationApi";
import type { CharacterizationDesign } from "../types/analysis";

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useCharacterizations(page?: number, search?: string) {
  return useQuery({
    queryKey: ["characterizations", { page, search }],
    queryFn: () => listCharacterizations({ page, search }),
  });
}

export function useCharacterization(id: number | null) {
  return useQuery({
    queryKey: ["characterizations", id],
    queryFn: () => getCharacterization(id!),
    enabled: id != null && id > 0,
  });
}

export function useCharacterizationExecutions(id: number | null) {
  return useQuery({
    queryKey: ["characterizations", id, "executions"],
    queryFn: () => listExecutions(id!),
    enabled: id != null && id > 0,
  });
}

export function useCharacterizationExecution(
  id: number | null,
  executionId: number | null,
) {
  return useQuery({
    queryKey: ["characterizations", id, "executions", executionId],
    queryFn: () => getExecution(id!, executionId!),
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

export function useCreateCharacterization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      name: string;
      description?: string;
      design_json: CharacterizationDesign;
    }) => createCharacterization(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["characterizations"] });
    },
  });
}

export function useUpdateCharacterization() {
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
        design_json: CharacterizationDesign;
      }>;
    }) => updateCharacterization(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["characterizations", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["characterizations"] });
    },
  });
}

export function useDeleteCharacterization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteCharacterization(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["characterizations"] });
    },
  });
}

export function useExecuteCharacterization() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, sourceId }: { id: number; sourceId: number }) =>
      executeCharacterization(id, sourceId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["characterizations", variables.id, "executions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["characterizations", variables.id],
      });
    },
  });
}
