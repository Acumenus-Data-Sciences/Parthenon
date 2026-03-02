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
} from "../types/vocabulary";

const BASE = "/vocabulary";

export async function searchConcepts(
  params: ConceptSearchParams,
): Promise<ConceptSearchResult> {
  const { data } = await apiClient.get<ConceptSearchResult>(
    `${BASE}/search`,
    { params },
  );
  return data;
}

export async function getConcept(id: number): Promise<Concept> {
  const { data } = await apiClient.get<Concept>(`${BASE}/concepts/${id}`);
  return data;
}

export async function getConceptRelationships(
  id: number,
  page?: number,
): Promise<PaginatedRelationships> {
  const { data } = await apiClient.get<PaginatedRelationships>(
    `${BASE}/concepts/${id}/relationships`,
    { params: page != null ? { page } : undefined },
  );
  return data;
}

export async function getConceptAncestors(
  id: number,
): Promise<Concept[]> {
  const { data } = await apiClient.get<Concept[]>(
    `${BASE}/concepts/${id}/ancestors`,
  );
  return data;
}

export async function getConceptDescendants(
  id: number,
  page?: number,
): Promise<ConceptSearchResult> {
  const { data } = await apiClient.get<ConceptSearchResult>(
    `${BASE}/concepts/${id}/descendants`,
    { params: page != null ? { page } : undefined },
  );
  return data;
}

export async function getConceptHierarchy(
  id: number,
): Promise<ConceptHierarchyNode> {
  const { data } = await apiClient.get<ConceptHierarchyNode>(
    `${BASE}/concepts/${id}/hierarchy`,
  );
  return data;
}

export async function getDomains(): Promise<DomainInfo[]> {
  const { data } = await apiClient.get<DomainInfo[]>(`${BASE}/domains`);
  return data;
}

export async function getVocabularies(): Promise<VocabularyInfo[]> {
  const { data } = await apiClient.get<VocabularyInfo[]>(
    `${BASE}/vocabularies`,
  );
  return data;
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

export type { ConceptRelationship };
