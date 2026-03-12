import apiClient from "@/lib/api-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HecateSemanticSearchResult {
  concept_id: number;
  concept_name: string;
  domain_id: string;
  vocabulary_id: string;
  concept_class_id: string;
  standard_concept: string | null;
  score: number;
}

export interface HecateAutocompleteResult {
  concept_id: number;
  concept_name: string;
  domain_id: string;
}

export interface HecateConceptRelationship {
  relationship_id: string;
  concept_id: number;
  concept_name: string;
  vocabulary_id: string;
}

export interface HecatePhoebeRecommendation {
  concept_id: number;
  concept_name: string;
  score: number;
}

export interface HecateConceptDefinition {
  concept_id: number;
  definition: string;
}

export interface HecateConceptExpand {
  concept_id: number;
  concept_name: string;
  domain_id: string;
  vocabulary_id: string;
  concept_class_id: string;
  standard_concept: string | null;
  level: number;
}

export interface SemanticSearchParams {
  q: string;
  domain_id?: string;
  vocabulary_id?: string;
  standard_concept?: string;
  limit?: number;
}

export interface StandardSearchParams {
  q: string;
  limit?: number;
}

// ---------------------------------------------------------------------------
// API functions
// ---------------------------------------------------------------------------

const BASE = "/vocabulary/semantic";

export async function semanticSearch(
  params: SemanticSearchParams,
): Promise<HecateSemanticSearchResult[]> {
  const { data } = await apiClient.get(`${BASE}/search`, { params });
  return data.data ?? data ?? [];
}

export async function semanticSearchStandard(
  params: StandardSearchParams,
): Promise<HecateSemanticSearchResult[]> {
  const { data } = await apiClient.get(`${BASE}/search/standard`, { params });
  return data.data ?? data ?? [];
}

export async function autocomplete(
  q: string,
): Promise<HecateAutocompleteResult[]> {
  const { data } = await apiClient.get(`${BASE}/autocomplete`, {
    params: { q },
  });
  return data.data ?? data ?? [];
}

export async function getConceptRelationships(
  id: number,
): Promise<HecateConceptRelationship[]> {
  const { data } = await apiClient.get(`${BASE}/concepts/${id}/relationships`);
  return data.data ?? data ?? [];
}

export async function getConceptPhoebe(
  id: number,
): Promise<HecatePhoebeRecommendation[]> {
  const { data } = await apiClient.get(`${BASE}/concepts/${id}/phoebe`);
  return data.data ?? data ?? [];
}

export async function getConceptDefinition(
  id: number,
): Promise<HecateConceptDefinition> {
  const { data } = await apiClient.get(`${BASE}/concepts/${id}/definition`);
  return data.data ?? data;
}

export async function getConceptExpand(
  id: number,
): Promise<HecateConceptExpand[]> {
  const { data } = await apiClient.get(`${BASE}/concepts/${id}/expand`);
  return data.data ?? data ?? [];
}
