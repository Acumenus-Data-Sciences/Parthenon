import apiClient, { toLaravelPaginated } from "@/lib/api-client";
import type {
  PredictionAnalysis,
  PredictionDesign,
} from "../types/prediction";
import type {
  AnalysisExecution,
  PaginatedResponse,
} from "@/features/analyses/types/analysis";

const BASE = "/predictions";

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listPredictions(params?: {
  page?: number;
  search?: string;
}): Promise<PaginatedResponse<PredictionAnalysis>> {
  const { data } = await apiClient.get(BASE, { params });
  return toLaravelPaginated<PredictionAnalysis>(data);
}

export async function getPrediction(
  id: number,
): Promise<PredictionAnalysis> {
  const { data } = await apiClient.get(`${BASE}/${id}`);
  return data.data ?? data;
}

export async function createPrediction(payload: {
  name: string;
  description?: string;
  design_json: PredictionDesign;
}): Promise<PredictionAnalysis> {
  const { data } = await apiClient.post(BASE, payload);
  return data.data ?? data;
}

export async function updatePrediction(
  id: number,
  payload: Partial<{
    name: string;
    description: string;
    design_json: PredictionDesign;
  }>,
): Promise<PredictionAnalysis> {
  const { data } = await apiClient.put(`${BASE}/${id}`, payload);
  return data.data ?? data;
}

export async function deletePrediction(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export async function executePrediction(
  id: number,
  sourceId: number,
): Promise<AnalysisExecution> {
  const { data } = await apiClient.post(
    `${BASE}/${id}/execute`,
    { source_id: sourceId },
  );
  return data.data ?? data;
}

export async function listPredictionExecutions(
  id: number,
): Promise<AnalysisExecution[]> {
  const { data } = await apiClient.get(
    `${BASE}/${id}/executions`,
  );
  return data.data ?? data;
}

export async function getPredictionExecution(
  id: number,
  executionId: number,
): Promise<AnalysisExecution> {
  const { data } = await apiClient.get(
    `${BASE}/${id}/executions/${executionId}`,
  );
  return data.data ?? data;
}
