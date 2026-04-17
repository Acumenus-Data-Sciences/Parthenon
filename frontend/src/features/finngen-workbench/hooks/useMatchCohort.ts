// frontend/src/features/finngen-workbench/hooks/useMatchCohort.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { finngenWorkbenchApi, type MatchCohortPayload, type MatchCohortRunResponse } from "../api";

/**
 * SP4 Phase D — dispatch a cohort matching run. Returns the run record
 * immediately (status=queued); the UI then uses `useFinnGenRunStatus` (in
 * ./useFinnGenRunStatus.ts) to poll for completion.
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
