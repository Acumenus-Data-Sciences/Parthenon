// frontend/src/features/finngen-workbench/hooks/useMaterializeCohort.ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { finngenWorkbenchApi, type MaterializeCohortPayload, type MaterializeCohortResponse } from "../api";

/**
 * SP4 Polish 2 — dispatch a materialize run. Returns the Run envelope plus
 * the new cohort_definition_id. Caller polls /api/v1/finngen/runs/{id} via
 * useMatchRunStatus (same poller — the Run shape is shared) and persists
 * the cohort_definition_id in session_state so the Handoff step can link to
 * the materialized cohort.
 */
export function useMaterializeCohort() {
  const qc = useQueryClient();
  return useMutation<MaterializeCohortResponse, Error, MaterializeCohortPayload>({
    mutationFn: (payload) => finngenWorkbenchApi.materializeCohort(payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finngen", "runs"] });
      qc.invalidateQueries({ queryKey: ["cohort-definitions"] });
    },
  });
}
