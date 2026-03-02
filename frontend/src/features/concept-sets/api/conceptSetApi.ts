import apiClient from "@/lib/api-client";
import type {
  ConceptSet,
  ConceptSetItem,
  ConceptSetResolveResult,
  ConceptSetListParams,
  PaginatedResponse,
  CreateConceptSetPayload,
  UpdateConceptSetPayload,
  AddConceptSetItemPayload,
  UpdateConceptSetItemPayload,
} from "../types/conceptSet";

const BASE = "/concept-sets";

export async function getConceptSets(
  params?: ConceptSetListParams,
): Promise<PaginatedResponse<ConceptSet>> {
  const { data } = await apiClient.get<PaginatedResponse<ConceptSet>>(BASE, {
    params,
  });
  return data;
}

export async function getConceptSet(id: number): Promise<ConceptSet> {
  const { data } = await apiClient.get<ConceptSet>(`${BASE}/${id}`);
  return data;
}

export async function createConceptSet(
  payload: CreateConceptSetPayload,
): Promise<ConceptSet> {
  const { data } = await apiClient.post<ConceptSet>(BASE, payload);
  return data;
}

export async function updateConceptSet(
  id: number,
  payload: UpdateConceptSetPayload,
): Promise<ConceptSet> {
  const { data } = await apiClient.put<ConceptSet>(`${BASE}/${id}`, payload);
  return data;
}

export async function deleteConceptSet(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

export async function resolveConceptSet(
  id: number,
): Promise<ConceptSetResolveResult> {
  const { data } = await apiClient.get<ConceptSetResolveResult>(
    `${BASE}/${id}/resolve`,
  );
  return data;
}

export async function addConceptSetItem(
  setId: number,
  payload: AddConceptSetItemPayload,
): Promise<ConceptSetItem> {
  const { data } = await apiClient.post<ConceptSetItem>(
    `${BASE}/${setId}/items`,
    payload,
  );
  return data;
}

export async function updateConceptSetItem(
  setId: number,
  itemId: number,
  payload: UpdateConceptSetItemPayload,
): Promise<ConceptSetItem> {
  const { data } = await apiClient.put<ConceptSetItem>(
    `${BASE}/${setId}/items/${itemId}`,
    payload,
  );
  return data;
}

export async function removeConceptSetItem(
  setId: number,
  itemId: number,
): Promise<void> {
  await apiClient.delete(`${BASE}/${setId}/items/${itemId}`);
}
