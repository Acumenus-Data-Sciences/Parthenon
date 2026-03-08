import apiClient, { toLaravelPaginated } from "@/lib/api-client";
import type { SccsAnalysis, SccsDesign } from "../types/sccs";
import type {
  AnalysisExecution,
  PaginatedResponse,
} from "@/features/analyses/types/analysis";

const BASE = "/sccs";

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listSccs(params?: {
  page?: number;
  search?: string;
}): Promise<PaginatedResponse<SccsAnalysis>> {
  const { data } = await apiClient.get(BASE, { params });
  return toLaravelPaginated<SccsAnalysis>(data);
}

export async function getSccs(id: number): Promise<SccsAnalysis> {
  const { data } = await apiClient.get(`${BASE}/${id}`);
  return data.data ?? data;
}

export async function createSccs(payload: {
  name: string;
  description?: string;
  design_json: SccsDesign;
}): Promise<SccsAnalysis> {
  const { data } = await apiClient.post(BASE, payload);
  return data.data ?? data;
}

export async function updateSccs(
  id: number,
  payload: Partial<{
    name: string;
    description: string;
    design_json: SccsDesign;
  }>,
): Promise<SccsAnalysis> {
  const { data } = await apiClient.put(`${BASE}/${id}`, payload);
  return data.data ?? data;
}

export async function deleteSccs(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export async function executeSccs(
  id: number,
  sourceId: number,
): Promise<AnalysisExecution> {
  const { data } = await apiClient.post(`${BASE}/${id}/execute`, {
    source_id: sourceId,
  });
  return data.data ?? data;
}

export async function listSccsExecutions(
  id: number,
): Promise<AnalysisExecution[]> {
  const { data } = await apiClient.get(
    `${BASE}/${id}/executions`,
  );
  return data.data ?? data;
}

export async function getSccsExecution(
  id: number,
  executionId: number,
): Promise<AnalysisExecution> {
  const { data } = await apiClient.get(
    `${BASE}/${id}/executions/${executionId}`,
  );
  return data.data ?? data;
}
