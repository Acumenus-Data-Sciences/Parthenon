import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listPathways,
  getPathway,
  createPathway,
  updatePathway,
  deletePathway,
  executePathway,
  listPathwayExecutions,
  getPathwayExecution,
} from "../api/pathwayApi";
import type { PathwayDesign } from "../types/pathway";

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function usePathways(page?: number) {
  return useQuery({
    queryKey: ["pathways", { page }],
    queryFn: () => listPathways({ page }),
  });
}

export function usePathway(id: number | null) {
  return useQuery({
    queryKey: ["pathways", id],
    queryFn: () => getPathway(id!),
    enabled: id != null && id > 0,
  });
}

export function usePathwayExecutions(id: number | null) {
  return useQuery({
    queryKey: ["pathways", id, "executions"],
    queryFn: () => listPathwayExecutions(id!),
    enabled: id != null && id > 0,
  });
}

export function usePathwayExecution(
  id: number | null,
  executionId: number | null,
) {
  return useQuery({
    queryKey: ["pathways", id, "executions", executionId],
    queryFn: () => getPathwayExecution(id!, executionId!),
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

export function useCreatePathway() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      name: string;
      description?: string;
      design_json: PathwayDesign;
    }) => createPathway(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pathways"] });
    },
  });
}

export function useUpdatePathway() {
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
        design_json: PathwayDesign;
      }>;
    }) => updatePathway(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["pathways", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["pathways"] });
    },
  });
}

export function useDeletePathway() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deletePathway(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pathways"] });
    },
  });
}

export function useExecutePathway() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, sourceId }: { id: number; sourceId: number }) =>
      executePathway(id, sourceId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["pathways", variables.id, "executions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["pathways", variables.id],
      });
    },
  });
}
