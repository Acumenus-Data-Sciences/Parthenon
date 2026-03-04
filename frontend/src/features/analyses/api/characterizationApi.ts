import apiClient, { toLaravelPaginated } from "@/lib/api-client";
import type {
  Characterization,
  CharacterizationDesign,
  AnalysisExecution,
  PaginatedResponse,
} from "../types/analysis";

const BASE = "/characterizations";

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listCharacterizations(params?: {
  page?: number;
  search?: string;
}): Promise<PaginatedResponse<Characterization>> {
  const { data } = await apiClient.get(BASE, { params });
  return toLaravelPaginated<Characterization>(data);
}

export async function getCharacterization(
  id: number,
): Promise<Characterization> {
  const { data } = await apiClient.get(`${BASE}/${id}`);
  return data.data ?? data;
}

export async function createCharacterization(payload: {
  name: string;
  description?: string;
  design_json: CharacterizationDesign;
}): Promise<Characterization> {
  const { data } = await apiClient.post(BASE, payload);
  return data.data ?? data;
}

export async function updateCharacterization(
  id: number,
  payload: Partial<{
    name: string;
    description: string;
    design_json: CharacterizationDesign;
  }>,
): Promise<Characterization> {
  const { data } = await apiClient.put(`${BASE}/${id}`, payload);
  return data.data ?? data;
}

export async function deleteCharacterization(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export async function executeCharacterization(
  id: number,
  sourceId: number,
): Promise<AnalysisExecution> {
  const { data } = await apiClient.post(
    `${BASE}/${id}/execute`,
    { source_id: sourceId },
  );
  return data.data ?? data;
}

export async function listExecutions(
  id: number,
): Promise<AnalysisExecution[]> {
  const { data } = await apiClient.get<AnalysisExecution[]>(
    `${BASE}/${id}/executions`,
  );
  return data;
}

export async function getExecution(
  id: number,
  executionId: number,
): Promise<AnalysisExecution> {
  const { data } = await apiClient.get<AnalysisExecution>(
    `${BASE}/${id}/executions/${executionId}`,
  );
  return data;
}
