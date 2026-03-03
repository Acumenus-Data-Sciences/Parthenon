import apiClient, { toLaravelPaginated } from "@/lib/api-client";
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
  const { data } = await apiClient.get(BASE, { params });
  return toLaravelPaginated<ConceptSet>(data);
}

export async function getConceptSet(id: number): Promise<ConceptSet> {
  const { data } = await apiClient.get(`${BASE}/${id}`);
  return data.data ?? data;
}

export async function createConceptSet(
  payload: CreateConceptSetPayload,
): Promise<ConceptSet> {
  const { data } = await apiClient.post(BASE, payload);
  return data.data ?? data;
}

export async function updateConceptSet(
  id: number,
  payload: UpdateConceptSetPayload,
): Promise<ConceptSet> {
  const { data } = await apiClient.put(`${BASE}/${id}`, payload);
  return data.data ?? data;
}

export async function deleteConceptSet(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/${id}`);
}

export async function resolveConceptSet(
  id: number,
): Promise<ConceptSetResolveResult> {
  const { data } = await apiClient.get(`${BASE}/${id}/resolve`);
  return data.data ?? data;
}

export async function addConceptSetItem(
  setId: number,
  payload: AddConceptSetItemPayload,
): Promise<ConceptSetItem> {
  const { data } = await apiClient.post(`${BASE}/${setId}/items`, payload);
  return data.data ?? data;
}

export async function updateConceptSetItem(
  setId: number,
  itemId: number,
  payload: UpdateConceptSetItemPayload,
): Promise<ConceptSetItem> {
  const { data } = await apiClient.put(
    `${BASE}/${setId}/items/${itemId}`,
    payload,
  );
  return data.data ?? data;
}

export async function removeConceptSetItem(
  setId: number,
  itemId: number,
): Promise<void> {
  await apiClient.delete(`${BASE}/${setId}/items/${itemId}`);
}

// ---------------------------------------------------------------------------
// §9.2 — Import / Export
// ---------------------------------------------------------------------------

export interface ImportConceptSetPayload {
  name: string;
  description?: string;
  expression: {
    items: {
      concept: Record<string, unknown>;
      isExcluded?: boolean;
      includeDescendants?: boolean;
      includeMapped?: boolean;
    }[];
  };
}

export interface ImportConceptSetResult {
  imported: number;
  skipped: number;
  failed: number;
  results: { name: string; status: string; id?: number; reason?: string }[];
}

export async function importConceptSets(
  payload: ImportConceptSetPayload | ImportConceptSetPayload[],
): Promise<ImportConceptSetResult> {
  const { data } = await apiClient.post<ImportConceptSetResult>(
    `${BASE}/import`,
    payload,
  );
  return data;
}

export async function exportConceptSet(id: number): Promise<unknown> {
  const { data } = await apiClient.get(`${BASE}/${id}/export`);
  return data;
}
