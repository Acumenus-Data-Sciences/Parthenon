import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCatalogue,
  fetchEligibility,
  fetchSourceResults,
  fetchScoreDetail,
  runRiskScores,
  listAnalyses,
  getAnalysisStats,
  getAnalysis,
  createAnalysis,
  updateAnalysis,
  deleteAnalysis,
  recommendScores,
  executeAnalysis,
  getExecutionDetail,
  getExecutionPatients,
  createCohortFromTier,
} from "../api/riskScoreApi";
import type {
  RiskScoreAnalysisCreatePayload,
  RiskScoreAnalysisUpdatePayload,
  CreateCohortPayload,
} from "../types/riskScore";

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

// ── v2 Analysis Hooks ────────────────────────────────────────────

export const ANALYSIS_KEYS = {
  all: ["risk-score-analyses"] as const,
  list: (params: Record<string, unknown>) =>
    ["risk-score-analyses", params] as const,
  stats: ["risk-score-analyses", "stats"] as const,
  detail: (id: number | string) =>
    ["risk-score-analyses", id] as const,
  execution: (analysisId: number | string, executionId: number | string) =>
    ["risk-score-analyses", analysisId, "executions", executionId] as const,
  patients: (
    analysisId: number | string,
    executionId: number | string,
    params: Record<string, unknown>,
  ) =>
    [
      "risk-score-analyses",
      analysisId,
      "executions",
      executionId,
      "patients",
      params,
    ] as const,
  recommend: (sourceId: number, cohortId: number) =>
    ["risk-score-analyses", "recommend", sourceId, cohortId] as const,
};

export function useRiskScoreAnalyses(
  page?: number,
  search?: string,
  filters?: { status?: string; category?: string },
) {
  return useQuery({
    queryKey: ANALYSIS_KEYS.list({ page, search, ...filters }),
    queryFn: () =>
      listAnalyses({
        page: page ?? 1,
        search: search || undefined,
        status: filters?.status ?? undefined,
        category: filters?.category ?? undefined,
      }),
    staleTime: 30_000,
  });
}

export function useAllRiskScoreAnalyses() {
  return useQuery({
    queryKey: ANALYSIS_KEYS.list({ all: true }),
    queryFn: () => listAnalyses({ per_page: 200 }),
    staleTime: 30_000,
  });
}

export function useRiskScoreAnalysisStats() {
  return useQuery({
    queryKey: ANALYSIS_KEYS.stats,
    queryFn: getAnalysisStats,
    staleTime: 30_000,
  });
}

export function useRiskScoreAnalysis(id: number | string | null) {
  return useQuery({
    queryKey: ANALYSIS_KEYS.detail(id ?? 0),
    queryFn: () => getAnalysis(id!),
    enabled: id != null && id !== "" && id !== 0,
  });
}

export function useRecommendScores(
  sourceId: number,
  cohortDefinitionId: number,
) {
  return useQuery({
    queryKey: ANALYSIS_KEYS.recommend(sourceId, cohortDefinitionId),
    queryFn: () => recommendScores(sourceId, cohortDefinitionId),
    enabled: sourceId > 0 && cohortDefinitionId > 0,
    staleTime: 60_000,
  });
}

export function useExecutionDetail(
  analysisId: number | string | null,
  executionId: number | string | null,
) {
  return useQuery({
    queryKey: ANALYSIS_KEYS.execution(analysisId ?? 0, executionId ?? 0),
    queryFn: () => getExecutionDetail(analysisId!, executionId!),
    enabled: analysisId != null && executionId != null,
  });
}

export function useExecutionPatients(
  analysisId: number | string | null,
  executionId: number | string | null,
  params?: {
    page?: number;
    per_page?: number;
    score_id?: string;
    risk_tier?: string;
  },
) {
  return useQuery({
    queryKey: ANALYSIS_KEYS.patients(
      analysisId ?? 0,
      executionId ?? 0,
      params ?? {},
    ),
    queryFn: () => getExecutionPatients(analysisId!, executionId!, params),
    enabled: analysisId != null && executionId != null,
  });
}

export function useCreateRiskScoreAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: RiskScoreAnalysisCreatePayload) =>
      createAnalysis(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ANALYSIS_KEYS.all });
    },
  });
}

export function useUpdateRiskScoreAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number | string;
      payload: RiskScoreAnalysisUpdatePayload;
    }) => updateAnalysis(id, payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ANALYSIS_KEYS.all });
      qc.invalidateQueries({
        queryKey: ANALYSIS_KEYS.detail(variables.id),
      });
    },
  });
}

export function useDeleteRiskScoreAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number | string) => deleteAnalysis(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ANALYSIS_KEYS.all });
    },
  });
}

export function useExecuteRiskScoreAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      analysisId,
      sourceId,
    }: {
      analysisId: number | string;
      sourceId: number;
    }) => executeAnalysis(analysisId, sourceId),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: ANALYSIS_KEYS.detail(variables.analysisId),
      });
      qc.invalidateQueries({ queryKey: ANALYSIS_KEYS.stats });
    },
  });
}

export function useCreateCohortFromTier() {
  return useMutation({
    mutationFn: ({
      analysisId,
      payload,
    }: {
      analysisId: number | string;
      payload: CreateCohortPayload;
    }) => createCohortFromTier(analysisId, payload),
  });
}
