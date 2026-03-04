import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listIncidenceRates,
  getIncidenceRate,
  createIncidenceRate,
  updateIncidenceRate,
  deleteIncidenceRate,
  executeIncidenceRate,
  listIRExecutions,
  getIRExecution,
} from "../api/incidenceRateApi";
import type { IncidenceRateDesign } from "../types/analysis";

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useIncidenceRates(page?: number, search?: string) {
  return useQuery({
    queryKey: ["incidence-rates", { page, search }],
    queryFn: () => listIncidenceRates({ page, search }),
  });
}

export function useIncidenceRate(id: number | null) {
  return useQuery({
    queryKey: ["incidence-rates", id],
    queryFn: () => getIncidenceRate(id!),
    enabled: id != null && id > 0,
  });
}

export function useIncidenceRateExecutions(id: number | null) {
  return useQuery({
    queryKey: ["incidence-rates", id, "executions"],
    queryFn: () => listIRExecutions(id!),
    enabled: id != null && id > 0,
  });
}

export function useIncidenceRateExecution(
  id: number | null,
  executionId: number | null,
) {
  return useQuery({
    queryKey: ["incidence-rates", id, "executions", executionId],
    queryFn: () => getIRExecution(id!, executionId!),
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

export function useCreateIncidenceRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      name: string;
      description?: string;
      design_json: IncidenceRateDesign;
    }) => createIncidenceRate(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidence-rates"] });
    },
  });
}

export function useUpdateIncidenceRate() {
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
        design_json: IncidenceRateDesign;
      }>;
    }) => updateIncidenceRate(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["incidence-rates", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["incidence-rates"] });
    },
  });
}

export function useDeleteIncidenceRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteIncidenceRate(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["incidence-rates"] });
    },
  });
}

export function useExecuteIncidenceRate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, sourceId }: { id: number; sourceId: number }) =>
      executeIncidenceRate(id, sourceId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["incidence-rates", variables.id, "executions"],
      });
      queryClient.invalidateQueries({
        queryKey: ["incidence-rates", variables.id],
      });
    },
  });
}
