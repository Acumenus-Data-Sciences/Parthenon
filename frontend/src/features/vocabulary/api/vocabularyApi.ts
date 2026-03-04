import apiClient from "@/lib/api-client";
import type {
  Concept,
  ConceptSearchParams,
  ConceptSearchResult,
  ConceptRelationship,
  PaginatedRelationships,
  ConceptHierarchyNode,
  DomainInfo,
  VocabularyInfo,
  SemanticSearchResult,
  ConceptComparisonEntry,
  MapsFromResult,
} from "../types/vocabulary";

const BASE = "/vocabulary";

export async function searchConcepts(
  params: ConceptSearchParams,
): Promise<ConceptSearchResult> {
  const { data } = await apiClient.get(`${BASE}/search`, { params });
  return {
    items: data.data ?? [],
    total: data.total ?? data.count ?? 0,
    page: params.page ?? 1,
    limit: params.limit ?? 25,
  };
}

export async function getConcept(id: number): Promise<Concept> {
  const { data } = await apiClient.get(`${BASE}/concepts/${id}`);
  return data.data ?? data;
}

export async function getConceptRelationships(
  id: number,
  page: number = 1,
  limit: number = 25,
): Promise<PaginatedRelationships> {
  const offset = (page - 1) * limit;
  const { data } = await apiClient.get(
    `${BASE}/concepts/${id}/relationships`,
    { params: { offset, limit } },
  );
  return {
    items: (data.data ?? []).map((rel: Record<string, unknown>) => ({
      concept_id_1: rel.concept_id_1,
      concept_id_2: rel.concept_id_2,
      relationship_id: rel.relationship_id,
      related_concept: rel.concept2 ?? rel.related_concept,
    })),
    total: data.total ?? data.count ?? 0,
    page,
    limit,
  };
}

export async function getConceptAncestors(
  id: number,
): Promise<Concept[]> {
  const { data } = await apiClient.get(
    `${BASE}/concepts/${id}/ancestors`,
  );
  const items = data.data ?? data;
  if (!Array.isArray(items)) return [];
  return items.map((item: Record<string, unknown>) => {
    // Backend nests the concept under an `ancestor` key
    const concept = (item.ancestor ?? item) as Concept;
    return concept;
  });
}

export async function getConceptDescendants(
  id: number,
  page?: number,
): Promise<ConceptSearchResult> {
  const { data } = await apiClient.get(
    `${BASE}/concepts/${id}/descendants`,
    { params: page != null ? { page } : undefined },
  );
  const items = data.data ?? [];
  return {
    items: Array.isArray(items) ? items : [],
    total: data.count ?? data.total ?? 0,
    page: page ?? 1,
    limit: 25,
  };
}

export async function getConceptHierarchy(
  id: number,
): Promise<ConceptHierarchyNode> {
  const { data } = await apiClient.get(
    `${BASE}/concepts/${id}/hierarchy`,
  );
  return data.data ?? data;
}

export async function getDomains(): Promise<DomainInfo[]> {
  const { data } = await apiClient.get(`${BASE}/domains`);
  return data.data ?? data;
}

export async function getVocabularies(): Promise<VocabularyInfo[]> {
  const { data } = await apiClient.get(`${BASE}/vocabularies-list`);
  return data.data ?? data;
}

export async function semanticSearch(
  query: string,
  topK?: number,
): Promise<SemanticSearchResult[]> {
  const { data } = await apiClient.post<SemanticSearchResult[]>(
    `${BASE}/semantic-search`,
    { query, top_k: topK },
  );
  return data;
}

export async function compareConcepts(
  ids: number[],
): Promise<ConceptComparisonEntry[]> {
  const { data } = await apiClient.get(`${BASE}/compare`, {
    params: { ids },
  });
  return data.data ?? data;
}

export async function getConceptMapsFrom(
  id: number,
  limit?: number,
  offset?: number,
): Promise<MapsFromResult> {
  const { data } = await apiClient.get(`${BASE}/concepts/${id}/maps-from`, {
    params: { limit, offset },
  });
  return data;
}

export type { ConceptRelationship };
