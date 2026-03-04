import apiClient, { toLaravelPaginated } from "@/lib/api-client";
import type {
  PathwayAnalysis,
  PathwayDesign,
} from "../types/pathway";
import type {
  AnalysisExecution,
  PaginatedResponse,
} from "@/features/analyses/types/analysis";

const BASE = "/pathways";

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listPathways(params?: {
  page?: number;
  search?: string;
}): Promise<PaginatedResponse<PathwayAnalysis>> {
  const { data } = await apiClient.get(BASE, { params });
  return toLaravelPaginated<PathwayAnalysis>(data);
}

export async function getPathway(id: number): Promise<PathwayAnalysis> {
  const { data } = await apiClient.get(`${BASE}/${id}`);
  return data.data ?? data;
}

export async function createPathway(payload: {
  name: string;
  description?: string;
  design_json: PathwayDesign;
}): Promise<PathwayAnalysis> {
  const { data } = await apiClient.post(BASE, payload);
  return data.data ?? data;
}

export async function updatePathway(
  id: number,
  payload: Partial<{
    name: string;
    description: string;
    design_json: PathwayDesign;
  }>,
): Promise<PathwayAnalysis> {
  const { data } = await apiClient.put(`${BASE}/${id}`, payload);
  return data.data ?? data;
}

export async function deletePathway(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export async function executePathway(
  id: number,
  sourceId: number,
): Promise<AnalysisExecution> {
  const { data } = await apiClient.post(
    `${BASE}/${id}/execute`,
    { source_id: sourceId },
  );
  return data.data ?? data;
}

export async function listPathwayExecutions(
  id: number,
): Promise<AnalysisExecution[]> {
  const { data } = await apiClient.get<AnalysisExecution[]>(
    `${BASE}/${id}/executions`,
  );
  return data;
}

export async function getPathwayExecution(
  id: number,
  executionId: number,
): Promise<AnalysisExecution> {
  const { data } = await apiClient.get<AnalysisExecution>(
    `${BASE}/${id}/executions/${executionId}`,
  );
  return data;
}
