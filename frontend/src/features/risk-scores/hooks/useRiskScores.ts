import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCatalogue,
  fetchEligibility,
  fetchSourceResults,
  fetchScoreDetail,
  runRiskScores,
} from "../api/riskScoreApi";

export const RISK_SCORE_KEYS = {
  catalogue: ["risk-scores", "catalogue"] as const,
  eligibility: (sourceId: number) =>
    ["risk-scores", "eligibility", sourceId] as const,
  results: (sourceId: number) =>
    ["risk-scores", "results", sourceId] as const,
  detail: (sourceId: number, scoreId: string) =>
    ["risk-scores", "detail", sourceId, scoreId] as const,
};

export function useRiskScoreCatalogue() {
  return useQuery({
    queryKey: RISK_SCORE_KEYS.catalogue,
    queryFn: fetchCatalogue,
    staleTime: 60 * 60 * 1000, // 1 hour — catalogue is static
  });
}

export function useRiskScoreEligibility(sourceId: number) {
  return useQuery({
    queryKey: RISK_SCORE_KEYS.eligibility(sourceId),
    queryFn: () => fetchEligibility(sourceId),
    enabled: sourceId > 0,
  });
}

export function useRiskScoreResults(sourceId: number) {
  return useQuery({
    queryKey: RISK_SCORE_KEYS.results(sourceId),
    queryFn: () => fetchSourceResults(sourceId),
    enabled: sourceId > 0,
  });
}

export function useRiskScoreDetail(sourceId: number, scoreId: string) {
  return useQuery({
    queryKey: RISK_SCORE_KEYS.detail(sourceId, scoreId),
    queryFn: () => fetchScoreDetail(sourceId, scoreId),
    enabled: sourceId > 0 && scoreId.length > 0,
  });
}

export function useRunRiskScores(sourceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (scoreIds?: string[]) => runRiskScores(sourceId, scoreIds),
    onSuccess: () => {
      qc.invalidateQueries({
        queryKey: RISK_SCORE_KEYS.results(sourceId),
      });
      qc.invalidateQueries({
        queryKey: RISK_SCORE_KEYS.eligibility(sourceId),
      });
    },
  });
}
