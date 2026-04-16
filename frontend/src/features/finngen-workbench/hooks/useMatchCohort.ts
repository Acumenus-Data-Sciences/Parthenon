// frontend/src/features/finngen-workbench/hooks/useMatchCohort.ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import { finngenWorkbenchApi, type MatchCohortPayload, type MatchCohortRunResponse } from "../api";

const TERMINAL_STATUSES = new Set(["succeeded", "failed", "canceled", "canceling"]);

/**
 * SP4 Phase D — dispatch a cohort matching run. Returns the run record
 * immediately (status=queued); the UI then uses useMatchRunStatus to poll
 * for completion.
 */
export function useMatchCohort() {
  const qc = useQueryClient();
  return useMutation<MatchCohortRunResponse, Error, MatchCohortPayload>({
    mutationFn: (payload) => finngenWorkbenchApi.matchCohort(payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finngen", "runs"] });
    },
  });
}

/**
 * Polls /api/v1/finngen/runs/{id} every 2s until the run reaches a terminal
 * status. Falls silent (no refetchInterval) once terminal so the UI doesn't
 * keep hammering.
 */
export function useMatchRunStatus(runId: string | null) {
  return useQuery<MatchCohortRunResponse>({
    queryKey: ["finngen", "runs", runId],
    queryFn: async () => {
      const { data } = await apiClient.get<{ data: MatchCohortRunResponse }>(
        `/finngen/runs/${encodeURIComponent(runId!)}`,
      );
      return data.data;
    },
    enabled: runId !== null,
    refetchInterval: (query) => {
      const status = (query.state.data as MatchCohortRunResponse | undefined)?.status;
      if (status && TERMINAL_STATUSES.has(status)) return false;
      return 2_000;
    },
  });
}
