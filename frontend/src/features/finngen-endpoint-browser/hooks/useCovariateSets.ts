// Phase 15 (Plan 15-05) — query hook for GET /finngen/gwas-covariate-sets.
//
// The covariate-set list rarely changes (admin-maintained). 5-minute staleTime
// avoids refetch churn in a session; on 404 the underlying `fetchCovariateSets`
// returns a hard-coded default so the RunGwasPanel picker always renders.
import { useQuery } from "@tanstack/react-query";
import { fetchCovariateSets, type CovariateSetSummary } from "../api";

export function useCovariateSets() {
  return useQuery<CovariateSetSummary[]>({
    queryKey: ["finngen", "covariate-sets"],
    queryFn: fetchCovariateSets,
    staleTime: 5 * 60_000,
  });
}
