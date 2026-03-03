import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listEvidenceSynthesis,
  getEvidenceSynthesis,
  createEvidenceSynthesis,
  updateEvidenceSynthesis,
  deleteEvidenceSynthesis,
  executeEvidenceSynthesis,
  listEvidenceSynthesisExecutions,
  getEvidenceSynthesisExecution,
} from "../api/evidenceSynthesisApi";
import type { EvidenceSynthesisDesign } from "../types/evidenceSynthesis";

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useEvidenceSynthesisAnalyses(page?: number) {
  return useQuery({
    queryKey: ["evidence-synthesis", { page }],
    queryFn: () => listEvidenceSynthesis({ page }),
  });
}

export function useEvidenceSynthesisAnalysis(id: number | null) {
  return useQuery({
    queryKey: ["evidence-synthesis", id],
    queryFn: () => getEvidenceSynthesis(id!),
    enabled: id != null && id > 0,
  });
}

export function useEvidenceSynthesisExecutions(id: number | null) {
  return useQuery({
    queryKey: ["evidence-synthesis", id, "executions"],
    queryFn: () => listEvidenceSynthesisExecutions(id!),
    enabled: id != null && id > 0,
  });
}

export function useEvidenceSynthesisExecution(
  id: number | null,
  executionId: number | null,
) {
  return useQuery({
    queryKey: ["evidence-synthesis", id, "executions", executionId],
    queryFn: () => getEvidenceSynthesisExecution(id!, executionId!),
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

export function useCreateEvidenceSynthesis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      name: string;
      description?: string;
      design_json: EvidenceSynthesisDesign;
    }) => createEvidenceSynthesis(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidence-synthesis"] });
    },
  });
}

export function useUpdateEvidenceSynthesis() {
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
        design_json: EvidenceSynthesisDesign;
      }>;
    }) => updateEvidenceSynthesis(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["evidence-synthesis", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["evidence-synthesis"] });
    },
  });
}

export function useDeleteEvidenceSynthesis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteEvidenceSynthesis(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evidence-synthesis"] });
    },
  });
}

export function useExecuteEvidenceSynthesis() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => executeEvidenceSynthesis(id),
    onSuccess: (_data, id) => {
      queryClient.invalidateQueries({
        queryKey: ["evidence-synthesis", id, "executions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["evidence-synthesis", id],
      });
    },
  });
}
