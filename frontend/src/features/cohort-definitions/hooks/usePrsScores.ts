// Phase 17 GENOMICS-08 — TanStack Query hooks for the cohort PRS endpoints.
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCohortPrsScores,
  fetchPgsCatalogScores,
  dispatchComputePrs,
  type ComputePrsRequest,
  type ComputePrsResponse,
  type CohortPrsResponse,
  type PgsCatalogScoresResponse,
} from "../api/prs";

export function useCohortPrsScores(cohortId: number, bins = 50) {
  return useQuery<CohortPrsResponse>({
    queryKey: ["cohort", cohortId, "prs", bins],
    queryFn: () => fetchCohortPrsScores(cohortId, bins),
    enabled: Number.isFinite(cohortId) && cohortId > 0,
    staleTime: 30 * 1000,
  });
}

export function usePgsCatalogScores() {
  return useQuery<PgsCatalogScoresResponse>({
    queryKey: ["pgs-catalog", "scores"],
    queryFn: fetchPgsCatalogScores,
    staleTime: 5 * 60 * 1000,
  });
}

export function useComputePrsMutation(endpointName: string, cohortId: number) {
  const qc = useQueryClient();
  return useMutation<ComputePrsResponse, Error, ComputePrsRequest>({
    mutationFn: (req: ComputePrsRequest) =>
      dispatchComputePrs(endpointName, req),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cohort", cohortId, "prs"] });
    },
  });
}
