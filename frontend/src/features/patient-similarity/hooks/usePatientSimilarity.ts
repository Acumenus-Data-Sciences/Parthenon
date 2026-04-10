import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchDimensions,
  fetchComputeStatus,
  searchSimilarPatients,
  triggerCompute,
  searchFromCohort,
  exportCohort,
  fetchCohortProfile,
  comparePatients,
  expandCohort,
  compareCohorts,
  crossCohortSearch,
  propensityMatch,
  discoverPhenotypes,
} from "../api/patientSimilarityApi";
import type {
  SimilaritySearchParams,
  CohortSimilaritySearchParams,
  CohortExportParams,
  ExpandCohortParams,
  CohortComparisonParams,
  CrossCohortSearchParams,
  PropensityMatchParams,
  PhenotypeDiscoveryParams,
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

// ── Cohort Profile ────────────────────────────────────────────────

export function useCohortProfile(
  cohortDefinitionId: number | undefined,
  sourceId: number,
) {
  return useQuery({
    queryKey: ["patient-similarity", "cohort-profile", cohortDefinitionId, sourceId] as const,
    queryFn: () => fetchCohortProfile(cohortDefinitionId!, sourceId),
    enabled: !!cohortDefinitionId && cohortDefinitionId > 0 && sourceId > 0,
    staleTime: 5 * 60 * 1000,
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

// ── Cohort Expansion ────────────────────────────────────────────

export function useExpandCohort() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: ExpandCohortParams) => expandCohort(params),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ["patient-similarity", "cohort-profile", variables.cohort_definition_id],
      });
    },
  });
}

// ── Cohort Comparison ────────────────────────────────────────────

export function useCompareCohorts() {
  return useMutation({
    mutationFn: (params: CohortComparisonParams) => compareCohorts(params),
  });
}

export function useCrossCohortSearch() {
  return useMutation({
    mutationFn: (params: CrossCohortSearchParams) => crossCohortSearch(params),
  });
}

// ── Propensity Score Matching ────────────────────────────────────

export function usePropensityMatch() {
  return useMutation({
    mutationFn: (params: PropensityMatchParams) => propensityMatch(params),
  });
}

// ── Phenotype Discovery ────────────────────────────────────────

export function usePhenotypeDiscovery() {
  return useMutation({
    mutationFn: (params: PhenotypeDiscoveryParams) =>
      discoverPhenotypes(params),
  });
}
