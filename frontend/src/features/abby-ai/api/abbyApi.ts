import apiClient from "@/lib/api-client";
import type {
  AbbyBuildRequest,
  AbbyBuildResponse,
  AbbySuggestRequest,
  AbbySuggestResponse,
  AbbyExplainResponse,
  AbbyRefineRequest,
} from "../types/abby";

const BASE = "/abby";

export async function buildCohort(
  data: AbbyBuildRequest,
): Promise<AbbyBuildResponse> {
  const { data: result } = await apiClient.post<AbbyBuildResponse>(
    `${BASE}/build-cohort`,
    data,
  );
  return result;
}

export async function suggestCriteria(
  data: AbbySuggestRequest,
): Promise<AbbySuggestResponse> {
  const { data: result } = await apiClient.post<AbbySuggestResponse>(
    `${BASE}/suggest-criteria`,
    data,
  );
  return result;
}

export async function explainExpression(
  expression: Record<string, unknown>,
): Promise<AbbyExplainResponse> {
  const { data: result } = await apiClient.post<AbbyExplainResponse>(
    `${BASE}/explain`,
    { expression },
  );
  return result;
}

export async function refineCohort(
  data: AbbyRefineRequest,
): Promise<AbbyBuildResponse> {
  const { data: result } = await apiClient.post<AbbyBuildResponse>(
    `${BASE}/refine`,
    data,
  );
  return result;
}
