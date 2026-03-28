import apiClient from "@/lib/api-client";
import type {
  RiskScoreCatalogue,
  EligibilityMap,
  RiskScoreSourceResults,
  RiskScoreDetail,
  RunOutcome,
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
