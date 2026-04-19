// Phase 15 (Plan 15-05) — query hook for GET /finngen/endpoints/{name}/eligible-controls.
//
// The picker is source-scoped: a cohort is "eligible" only if it has been
// generated for the currently-active source. staleTime 30s keeps the picker
// snappy while still picking up newly-generated cohorts within a session.
import { useQuery } from "@tanstack/react-query";
import { fetchEligibleControls, type EligibleControlCohort } from "../api";

export function useEligibleControlCohorts(args: {
  endpointName: string;
  sourceKey: string;
}) {
  const { endpointName, sourceKey } = args;
  return useQuery<EligibleControlCohort[]>({
    queryKey: [
      "finngen-endpoints",
      endpointName,
      "eligible-controls",
      sourceKey,
    ],
    queryFn: () => fetchEligibleControls(endpointName, sourceKey),
    enabled: !!endpointName && !!sourceKey,
    staleTime: 30_000,
  });
}
