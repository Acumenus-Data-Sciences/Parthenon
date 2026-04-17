// frontend/src/features/finngen-workbench/hooks/usePromoteMatchedCohort.ts
//
// SP4 Phase D.3 — promote a succeeded cohort.match run's matched output into
// a first-class app.cohort_definitions row. Idempotent: re-calling for the
// same run_id returns the prior record with already_promoted=true.
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  finngenWorkbenchApi,
  type PromoteMatchedCohortPayload,
  type PromoteMatchedCohortResponse,
} from "../api";

export function usePromoteMatchedCohort() {
  const qc = useQueryClient();
  return useMutation<PromoteMatchedCohortResponse, Error, PromoteMatchedCohortPayload>({
    mutationFn: (payload) =>
      finngenWorkbenchApi.promoteMatchedCohort(payload).then((r) => r.data),
    onSuccess: () => {
      // A new promotion appears in cohort-search results; invalidate the
      // shared cohort-search cache so pickers refresh.
      qc.invalidateQueries({ queryKey: ["finngen", "cohort-search"] });
    },
  });
}
