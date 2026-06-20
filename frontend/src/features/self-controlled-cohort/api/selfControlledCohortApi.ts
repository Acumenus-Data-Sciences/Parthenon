import apiClient, { toLaravelPaginated } from "@/lib/api-client";
import type {
  SelfControlledCohortAnalysis,
  SelfControlledCohortDesign,
} from "../types/selfControlledCohort";
import type {
  AnalysisExecution,
  PaginatedResponse,
} from "@/features/analyses/types/analysis";

const BASE = "/self-controlled-cohorts";

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function listSelfControlledCohorts(params?: {
  page?: number;
  search?: string;
}): Promise<PaginatedResponse<SelfControlledCohortAnalysis>> {
  const { data } = await apiClient.get(BASE, { params });
  return toLaravelPaginated<SelfControlledCohortAnalysis>(data);
}

export async function getSelfControlledCohort(
  id: number,
): Promise<SelfControlledCohortAnalysis> {
  const { data } = await apiClient.get(`${BASE}/${id}`);
  return data.data ?? data;
}

export async function createSelfControlledCohort(payload: {
  name: string;
  description?: string;
  design_json: SelfControlledCohortDesign;
}): Promise<SelfControlledCohortAnalysis> {
  const { data } = await apiClient.post(BASE, payload);
  return data.data ?? data;
}

export async function updateSelfControlledCohort(
  id: number,
  payload: Partial<{
    name: string;
    description: string;
    design_json: SelfControlledCohortDesign;
  }>,
): Promise<SelfControlledCohortAnalysis> {
  const { data } = await apiClient.put(`${BASE}/${id}`, payload);
  return data.data ?? data;
}

export async function deleteSelfControlledCohort(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export async function executeSelfControlledCohort(
  id: number,
  sourceId: number,
): Promise<AnalysisExecution> {
  const { data } = await apiClient.post(`${BASE}/${id}/execute`, {
    source_id: sourceId,
  });
  return data.data ?? data;
}

export async function listSelfControlledCohortsExecutions(
  id: number,
): Promise<AnalysisExecution[]> {
  const { data } = await apiClient.get(`${BASE}/${id}/executions`);
  return data.data ?? data;
}

export async function getSelfControlledCohortExecution(
  id: number,
  executionId: number,
): Promise<AnalysisExecution> {
  const { data } = await apiClient.get(
    `${BASE}/${id}/executions/${executionId}`,
  );
  return data.data ?? data;
}
