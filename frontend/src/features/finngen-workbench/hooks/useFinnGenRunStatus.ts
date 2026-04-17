// frontend/src/features/finngen-workbench/hooks/useFinnGenRunStatus.ts
//
// Polls `/api/v1/finngen/runs/{id}` every 2s until the run reaches a terminal
// status, then falls silent so the UI doesn't keep hammering. Used by both
// the Match step (MatchingResults) and the Materialize step — the Run shape
// is the same across all finngen analysis types, so this hook is generic by
// design. Name was previously `useMatchRunStatus` in `useMatchCohort.ts`,
// which misled readers into thinking it was match-specific.
import { useQuery } from "@tanstack/react-query";
import apiClient from "@/lib/api-client";
import type { MatchCohortRunResponse } from "../api";

const TERMINAL_STATUSES = new Set(["succeeded", "failed", "canceled", "canceling"]);

export function useFinnGenRunStatus(runId: string | null) {
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
      if (status !== undefined && TERMINAL_STATUSES.has(status)) return false;
      return 2_000;
    },
  });
}
