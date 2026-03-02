import apiClient from "@/lib/api-client";
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
}): Promise<PaginatedResponse<Characterization>> {
  const { data } = await apiClient.get<PaginatedResponse<Characterization>>(
    BASE,
    { params },
  );
  return data;
}

export async function getCharacterization(
  id: number,
): Promise<Characterization> {
  const { data } = await apiClient.get<Characterization>(`${BASE}/${id}`);
  return data;
}

export async function createCharacterization(payload: {
  name: string;
  description?: string;
  design_json: CharacterizationDesign;
}): Promise<Characterization> {
  const { data } = await apiClient.post<Characterization>(BASE, payload);
  return data;
}

export async function updateCharacterization(
  id: number,
  payload: Partial<{
    name: string;
    description: string;
    design_json: CharacterizationDesign;
  }>,
): Promise<Characterization> {
  const { data } = await apiClient.put<Characterization>(
    `${BASE}/${id}`,
    payload,
  );
  return data;
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
  const { data } = await apiClient.post<AnalysisExecution>(
    `${BASE}/${id}/execute`,
    { source_id: sourceId },
  );
  return data;
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
