import apiClient from "@/lib/api-client";
import type {
  RiskScoreCatalogue,
  EligibilityMap,
  RiskScoreSourceResults,
  RiskScoreDetail,
  RunOutcome,
  RiskScoreAnalysis,
  RiskScoreAnalysisCreatePayload,
  RiskScoreAnalysisUpdatePayload,
  RiskScoreAnalysisStats,
  RecommendationResponse,
  ExecutionDetailResponse,
  RiskScorePatientResult,
  CreateCohortPayload,
  CreateCohortResponse,
} from "../types/riskScore";

export async function fetchCatalogue(): Promise<RiskScoreCatalogue> {
  const { data } = await apiClient.get<RiskScoreCatalogue>(
    "/risk-scores/catalogue",
  );
  return data;
}

export async function fetchEligibility(
  sourceId: number,
): Promise<EligibilityMap> {
  const { data } = await apiClient.get<EligibilityMap>(
    `/sources/${sourceId}/risk-scores/eligibility`,
  );
  return data;
}

export async function fetchSourceResults(
  sourceId: number,
): Promise<RiskScoreSourceResults> {
  const { data } = await apiClient.get<RiskScoreSourceResults>(
    `/sources/${sourceId}/risk-scores`,
  );
  return data;
}

export async function fetchScoreDetail(
  sourceId: number,
  scoreId: string,
): Promise<RiskScoreDetail> {
  const { data } = await apiClient.get<RiskScoreDetail>(
    `/sources/${sourceId}/risk-scores/${scoreId}`,
  );
  return data;
}

export async function runRiskScores(
  sourceId: number,
  scoreIds?: string[],
): Promise<RunOutcome> {
  const { data } = await apiClient.post<RunOutcome>(
    `/sources/${sourceId}/risk-scores/run`,
    scoreIds ? { score_ids: scoreIds } : {},
  );
  return data;
}

// ── v2 Analysis API ──────────────────────────────────────────────

export async function listAnalyses(params?: {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
  category?: string;
}): Promise<{
  data: RiskScoreAnalysis[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
  facets?: Record<string, Record<string, number>>;
}> {
  const { data } = await apiClient.get("/risk-score-analyses", { params });
  return data;
}

export async function getAnalysisStats(): Promise<RiskScoreAnalysisStats> {
  const { data } = await apiClient.get("/risk-score-analyses/stats");
  return data.data ?? data;
}

export async function getAnalysis(
  id: number | string,
): Promise<RiskScoreAnalysis> {
  const { data } = await apiClient.get(`/risk-score-analyses/${id}`);
  return data.data ?? data;
}

export async function createAnalysis(
  payload: RiskScoreAnalysisCreatePayload,
): Promise<RiskScoreAnalysis> {
  const { data } = await apiClient.post("/risk-score-analyses", payload);
  return data.data ?? data;
}

export async function updateAnalysis(
  id: number | string,
  payload: RiskScoreAnalysisUpdatePayload,
): Promise<RiskScoreAnalysis> {
  const { data } = await apiClient.put(
    `/risk-score-analyses/${id}`,
    payload,
  );
  return data.data ?? data;
}

export async function deleteAnalysis(id: number | string): Promise<void> {
  await apiClient.delete(`/risk-score-analyses/${id}`);
}

export async function recommendScores(
  sourceId: number,
  cohortDefinitionId: number,
): Promise<RecommendationResponse> {
  const { data } = await apiClient.post<{ data: RecommendationResponse }>(
    `/sources/${sourceId}/risk-scores/recommend`,
    { cohort_definition_id: cohortDefinitionId },
  );
  return data.data ?? data;
}

export async function executeAnalysis(
  analysisId: number | string,
  sourceId: number,
): Promise<{
  execution_id: number;
  status: string;
  steps: unknown[];
}> {
  const { data } = await apiClient.post(
    `/risk-score-analyses/${analysisId}/execute`,
    { source_id: sourceId },
  );
  return data;
}

export async function getExecutionDetail(
  analysisId: number | string,
  executionId: number | string,
): Promise<ExecutionDetailResponse> {
  const { data } = await apiClient.get(
    `/risk-score-analyses/${analysisId}/executions/${executionId}`,
  );
  return data;
}

export async function getExecutionPatients(
  analysisId: number | string,
  executionId: number | string,
  params?: {
    page?: number;
    per_page?: number;
    score_id?: string;
    risk_tier?: string;
  },
): Promise<{
  data: RiskScorePatientResult[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;
}> {
  const { data } = await apiClient.get(
    `/risk-score-analyses/${analysisId}/executions/${executionId}/patients`,
    { params },
  );
  return data;
}

export async function createCohortFromTier(
  analysisId: number | string,
  payload: CreateCohortPayload,
): Promise<CreateCohortResponse> {
  const { data } = await apiClient.post(
    `/risk-score-analyses/${analysisId}/create-cohort`,
    payload,
  );
  return data;
}
