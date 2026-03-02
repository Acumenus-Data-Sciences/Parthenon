import apiClient from "@/lib/api-client";
import type {
  CohortDefinition,
  CohortGeneration,
  CohortDefinitionListParams,
  PaginatedResponse,
  CreateCohortDefinitionPayload,
  UpdateCohortDefinitionPayload,
} from "../types/cohortExpression";

const BASE = "/cohort-definitions";

// ---------------------------------------------------------------------------
// CRUD
// ---------------------------------------------------------------------------

export async function getCohortDefinitions(
  params?: CohortDefinitionListParams,
): Promise<PaginatedResponse<CohortDefinition>> {
  const { data } = await apiClient.get<PaginatedResponse<CohortDefinition>>(
    BASE,
    { params },
  );
  return data;
}

export async function getCohortDefinition(
  id: number,
): Promise<CohortDefinition> {
  const { data } = await apiClient.get<CohortDefinition>(`${BASE}/${id}`);
  return data;
}

export async function createCohortDefinition(
  payload: CreateCohortDefinitionPayload,
): Promise<CohortDefinition> {
  const { data } = await apiClient.post<CohortDefinition>(BASE, payload);
  return data;
}

export async function updateCohortDefinition(
  id: number,
  payload: UpdateCohortDefinitionPayload,
): Promise<CohortDefinition> {
  const { data } = await apiClient.put<CohortDefinition>(
    `${BASE}/${id}`,
    payload,
  );
  return data;
}

export async function deleteCohortDefinition(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

export async function copyCohortDefinition(
  id: number,
): Promise<CohortDefinition> {
  const { data } = await apiClient.post<CohortDefinition>(
    `${BASE}/${id}/copy`,
  );
  return data;
}

// ---------------------------------------------------------------------------
// Generation
// ---------------------------------------------------------------------------

export async function generateCohort(
  id: number,
  payload: { source_id: number },
): Promise<CohortGeneration> {
  const { data } = await apiClient.post<CohortGeneration>(
    `${BASE}/${id}/generate`,
    payload,
  );
  return data;
}

export async function getCohortGenerations(
  id: number,
): Promise<CohortGeneration[]> {
  const { data } = await apiClient.get<CohortGeneration[]>(
    `${BASE}/${id}/generations`,
  );
  return data;
}

export async function getCohortGeneration(
  defId: number,
  genId: number,
): Promise<CohortGeneration> {
  const { data } = await apiClient.get<CohortGeneration>(
    `${BASE}/${defId}/generations/${genId}`,
  );
  return data;
}

// ---------------------------------------------------------------------------
// SQL Preview
// ---------------------------------------------------------------------------

export async function previewCohortSql(
  id: number,
  payload: { source_id: number },
): Promise<{ sql: string }> {
  const { data } = await apiClient.post<{ sql: string }>(
    `${BASE}/${id}/sql`,
    payload,
  );
  return data;
}
