import apiClient from "@/lib/api-client";
import type {
  ConditionBundle,
  QualityMeasure,
  BundleOverlapRule,
  CareGapEvaluation,
  PopulationSummary,
  CreateBundlePayload,
  UpdateBundlePayload,
  BundleListParams,
  PaginatedResponse,
} from "../types/careGap";

const BASE = "/care-gaps/bundles";

// ---------------------------------------------------------------------------
// Bundles CRUD
// ---------------------------------------------------------------------------

export async function listBundles(
  params?: BundleListParams,
): Promise<PaginatedResponse<ConditionBundle>> {
  const { data } = await apiClient.get<PaginatedResponse<ConditionBundle>>(
    BASE,
    { params },
  );
  return data;
}

export async function getBundle(id: number): Promise<ConditionBundle> {
  const { data } = await apiClient.get<ConditionBundle>(`${BASE}/${id}`);
  return data;
}

export async function createBundle(
  payload: CreateBundlePayload,
): Promise<ConditionBundle> {
  const { data } = await apiClient.post<ConditionBundle>(BASE, payload);
  return data;
}

export async function updateBundle(
  id: number,
  payload: UpdateBundlePayload,
): Promise<ConditionBundle> {
  const { data } = await apiClient.put<ConditionBundle>(
    `${BASE}/${id}`,
    payload,
  );
  return data;
}

export async function deleteBundle(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

// ---------------------------------------------------------------------------
// Bundle Measures
// ---------------------------------------------------------------------------

export async function getBundleMeasures(
  bundleId: number,
): Promise<QualityMeasure[]> {
  const { data } = await apiClient.get<QualityMeasure[]>(
    `${BASE}/${bundleId}/measures`,
  );
  return data;
}

export async function addBundleMeasure(
  bundleId: number,
  measureId: number,
  ordinal: number,
): Promise<void> {
  await apiClient.post(`${BASE}/${bundleId}/measures`, {
    measure_id: measureId,
    ordinal,
  });
}

export async function removeBundleMeasure(
  bundleId: number,
  measureId: number,
): Promise<void> {
  await apiClient.delete(`${BASE}/${bundleId}/measures/${measureId}`);
}

// ---------------------------------------------------------------------------
// Evaluations
// ---------------------------------------------------------------------------

export async function evaluateBundle(
  bundleId: number,
  sourceId: number,
  cohortDefinitionId?: number,
): Promise<CareGapEvaluation> {
  const { data } = await apiClient.post<CareGapEvaluation>(
    `${BASE}/${bundleId}/evaluate`,
    {
      source_id: sourceId,
      cohort_definition_id: cohortDefinitionId ?? null,
    },
  );
  return data;
}

export async function listEvaluations(
  bundleId: number,
): Promise<CareGapEvaluation[]> {
  const { data } = await apiClient.get<CareGapEvaluation[]>(
    `${BASE}/${bundleId}/evaluations`,
  );
  return data;
}

export async function getEvaluation(
  bundleId: number,
  evaluationId: number,
): Promise<CareGapEvaluation> {
  const { data } = await apiClient.get<CareGapEvaluation>(
    `${BASE}/${bundleId}/evaluations/${evaluationId}`,
  );
  return data;
}

// ---------------------------------------------------------------------------
// Overlap Rules
// ---------------------------------------------------------------------------

export async function getOverlapRules(): Promise<BundleOverlapRule[]> {
  const { data } = await apiClient.get<BundleOverlapRule[]>(
    "/care-gaps/overlap-rules",
  );
  return data;
}

// ---------------------------------------------------------------------------
// Population Summary
// ---------------------------------------------------------------------------

export async function getPopulationSummary(
  sourceId: number,
): Promise<PopulationSummary> {
  const { data } = await apiClient.get<PopulationSummary>(
    "/care-gaps/population-summary",
    { params: { source_id: sourceId } },
  );
  return data;
}
