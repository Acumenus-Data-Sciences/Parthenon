import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  compareBatch,
  compareConcept,
  fetchCoverage,
  fetchDiversity,
  fetchFeasibilityAssessment,
  fetchFeasibilityList,
  fetchNetworkDqSummary,
  fetchNetworkOverview,
  runFeasibility,
  searchConceptsForComparison,
} from "../api/networkAresApi";
import type { FeasibilityCriteria } from "../types/ares";

export function useNetworkOverview() {
  return useQuery({
    queryKey: ["ares", "network", "overview"],
    queryFn: fetchNetworkOverview,
    staleTime: 5 * 60 * 1000,
  });
}

export function useConceptComparison(conceptId: number | null) {
  return useQuery({
    queryKey: ["ares", "network", "compare", conceptId],
    queryFn: () => compareConcept(conceptId!),
    enabled: !!conceptId,
  });
}

export function useConceptSearch(query: string) {
  return useQuery({
    queryKey: ["ares", "network", "compare-search", query],
    queryFn: () => searchConceptsForComparison(query),
    enabled: query.length >= 2,
    staleTime: 60 * 1000,
  });
}

export function useBatchComparison(conceptIds: number[]) {
  return useQuery({
    queryKey: ["ares", "network", "compare-batch", conceptIds],
    queryFn: () => compareBatch(conceptIds),
    enabled: conceptIds.length > 0,
  });
}

export function useCoverage() {
  return useQuery({
    queryKey: ["ares", "network", "coverage"],
    queryFn: fetchCoverage,
    staleTime: 10 * 60 * 1000,
  });
}

export function useDiversity() {
  return useQuery({
    queryKey: ["ares", "network", "diversity"],
    queryFn: fetchDiversity,
    staleTime: 10 * 60 * 1000,
  });
}

export function useRunFeasibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, criteria }: { name: string; criteria: FeasibilityCriteria }) =>
      runFeasibility(name, criteria),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ares", "network", "feasibility"] }),
  });
}

export function useFeasibilityAssessment(id: number | null) {
  return useQuery({
    queryKey: ["ares", "network", "feasibility", id],
    queryFn: () => fetchFeasibilityAssessment(id!),
    enabled: !!id,
  });
}

export function useFeasibilityList() {
  return useQuery({
    queryKey: ["ares", "network", "feasibility"],
    queryFn: fetchFeasibilityList,
  });
}

export function useNetworkDqSummary() {
  return useQuery({
    queryKey: ["ares", "network", "dq-summary"],
    queryFn: fetchNetworkDqSummary,
    staleTime: 5 * 60 * 1000,
  });
}
