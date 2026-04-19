// Phase 15 (Plan 15-05) — mutation hook for POST /finngen/endpoints/{name}/gwas.
//
// On success we invalidate two query keys so the UI refreshes without a manual
// refetch: the endpoint detail drawer (which renders the gwas_runs history
// table) and the eligible-controls picker (dispatch may have consumed a
// cohort slot or caused re-ranking per source).
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  dispatchGwas,
  type DispatchGwasPayload,
  type DispatchGwasResponse,
  type GwasDispatchRefusal,
} from "../api";

export function useDispatchGwas(endpointName: string) {
  const qc = useQueryClient();
  return useMutation<DispatchGwasResponse, GwasDispatchRefusal | Error, DispatchGwasPayload>({
    mutationFn: (payload) => dispatchGwas(endpointName, payload),
    onSuccess: (_res, variables) => {
      qc.invalidateQueries({
        queryKey: ["finngen-endpoints", "detail", endpointName],
      });
      qc.invalidateQueries({
        queryKey: [
          "finngen-endpoints",
          endpointName,
          "eligible-controls",
          variables.source_key,
        ],
      });
    },
  });
}
