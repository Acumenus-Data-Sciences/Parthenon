import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchDimensions,
  fetchComputeStatus,
  searchSimilarPatients,
  triggerCompute,
} from "../api/patientSimilarityApi";
import type { SimilaritySearchParams } from "../types/patientSimilarity";

export const SIMILARITY_KEYS = {
  dimensions: ["patient-similarity", "dimensions"] as const,
  status: (sourceId: number) =>
    ["patient-similarity", "status", sourceId] as const,
  search: (params: SimilaritySearchParams) =>
    ["patient-similarity", "search", params] as const,
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
