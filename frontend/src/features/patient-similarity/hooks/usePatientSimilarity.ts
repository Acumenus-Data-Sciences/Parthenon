import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchDimensions,
  fetchComputeStatus,
  searchSimilarPatients,
  triggerCompute,
  searchFromCohort,
  exportCohort,
  comparePatients,
} from "../api/patientSimilarityApi";
import type {
  SimilaritySearchParams,
  CohortSimilaritySearchParams,
  CohortExportParams,
} from "../types/patientSimilarity";

export const SIMILARITY_KEYS = {
  dimensions: ["patient-similarity", "dimensions"] as const,
  status: (sourceId: number) =>
    ["patient-similarity", "status", sourceId] as const,
  search: (params: SimilaritySearchParams) =>
    ["patient-similarity", "search", params] as const,
  compare: (personA: number, personB: number, sourceId: number) =>
    ["patient-similarity", "compare", personA, personB, sourceId] as const,
};

export function useSimilarityDimensions() {
  return useQuery({
    queryKey: SIMILARITY_KEYS.dimensions,
    queryFn: fetchDimensions,
    staleTime: 60 * 60 * 1000, // 1 hour — dimensions rarely change
  });
}

export function useComputeStatus(sourceId: number) {
  return useQuery({
    queryKey: SIMILARITY_KEYS.status(sourceId),
    queryFn: () => fetchComputeStatus(sourceId),
    enabled: sourceId > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useSimilaritySearch() {
  return useMutation({
    mutationFn: (params: SimilaritySearchParams) =>
      searchSimilarPatients(params),
  });
}

export function useTriggerCompute() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      sourceId,
      force,
    }: {
      sourceId: number;
      force?: boolean;
    }) => triggerCompute(sourceId, force),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: SIMILARITY_KEYS.status(variables.sourceId),
      });
    },
  });
}

// ── Cohort Integration ────────────────────────────────────────────

export function useCohortSimilaritySearch() {
  return useMutation({
    mutationFn: (params: CohortSimilaritySearchParams) =>
      searchFromCohort(params),
  });
}

export function useExportCohort() {
  return useMutation({
    mutationFn: (params: CohortExportParams) => exportCohort(params),
  });
}

// ── Patient Comparison ────────────────────────────────────────────

export function useComparePatients(
  personA: number,
  personB: number,
  sourceId: number,
) {
  return useQuery({
    queryKey: SIMILARITY_KEYS.compare(personA, personB, sourceId),
    queryFn: () => comparePatients(personA, personB, sourceId),
    enabled: personA > 0 && personB > 0 && sourceId > 0,
    staleTime: 5 * 60 * 1000,
  });
}
