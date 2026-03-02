import apiClient from "@/lib/api-client";
import type {
  EstimationAnalysis,
  EstimationDesign,
} from "../types/estimation";
import type {
  AnalysisExecution,
  PaginatedResponse,
} from "@/features/analyses/types/analysis";

const BASE = "/estimations";

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listEstimations(params?: {
  page?: number;
}): Promise<PaginatedResponse<EstimationAnalysis>> {
  const { data } = await apiClient.get<PaginatedResponse<EstimationAnalysis>>(
    BASE,
    { params },
  );
  return data;
}

export async function getEstimation(
  id: number,
): Promise<EstimationAnalysis> {
  const { data } = await apiClient.get<EstimationAnalysis>(`${BASE}/${id}`);
  return data;
}

export async function createEstimation(payload: {
  name: string;
  description?: string;
  design_json: EstimationDesign;
}): Promise<EstimationAnalysis> {
  const { data } = await apiClient.post<EstimationAnalysis>(BASE, payload);
  return data;
}

export async function updateEstimation(
  id: number,
  payload: Partial<{
    name: string;
    description: string;
    design_json: EstimationDesign;
  }>,
): Promise<EstimationAnalysis> {
  const { data } = await apiClient.put<EstimationAnalysis>(
    `${BASE}/${id}`,
    payload,
  );
  return data;
}

export async function deleteEstimation(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export async function executeEstimation(
  id: number,
  sourceId: number,
): Promise<AnalysisExecution> {
  const { data } = await apiClient.post<AnalysisExecution>(
    `${BASE}/${id}/execute`,
    { source_id: sourceId },
  );
  return data;
}

export async function listEstimationExecutions(
  id: number,
): Promise<AnalysisExecution[]> {
  const { data } = await apiClient.get<AnalysisExecution[]>(
    `${BASE}/${id}/executions`,
  );
  return data;
}

export async function getEstimationExecution(
  id: number,
  executionId: number,
): Promise<AnalysisExecution> {
  const { data } = await apiClient.get<AnalysisExecution>(
    `${BASE}/${id}/executions/${executionId}`,
  );
  return data;
}
