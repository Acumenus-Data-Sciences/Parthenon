import apiClient from "@/lib/api-client";

// ── Types ──────────────────────────────────────────────────────────────────

export interface MappingCandidate {
  concept_id: number;
  concept_name: string;
  vocabulary_id: string;
  domain_id: string;
  standard_concept: string | null;
  match_type: "verbatim" | "vector" | "llm";
  confidence: number;
}

export interface MappingResult {
  source_term: string;
  candidates: MappingCandidate[];
  best_match: MappingCandidate | null;
  match_type: string;
}

export interface CleanedTerm {
  original: string;
  cleaned: string;
}

export interface VectorResult {
  concept_id: number;
  concept_name: string;
  similarity: number;
  vocabulary_id: string;
  domain_id: string;
}

// ── Request param types ────────────────────────────────────────────────────

export interface MapTermsParams {
  source_terms: string[];
  target_vocabularies?: string[];
  target_domains?: string[];
}

export interface VectorSearchParams {
  term: string;
  max_results?: number;
  vocabulary_id?: string;
  domain_id?: string;
}

// ── API functions ──────────────────────────────────────────────────────────

/**
 * Map source terms to standard OMOP concepts via Ariadne.
 * POST /api/v1/ariadne/map
 */
export async function mapTerms(params: MapTermsParams): Promise<MappingResult[]> {
  const { data } = await apiClient.post("/ariadne/map", params);
  // Response may be: { data: { mappings: [...] } } or { mappings: [...] } or [...]
  const inner = data?.data ?? data;
  if (Array.isArray(inner)) return inner;
  if (inner?.mappings && Array.isArray(inner.mappings)) return inner.mappings;
  return [];
}

/**
 * Clean and normalise messy source terms.
 * POST /api/v1/ariadne/clean-terms
 */
export async function cleanTerms(terms: string[]): Promise<CleanedTerm[]> {
  const { data } = await apiClient.post("/ariadne/clean-terms", { terms });
  const inner = data?.data ?? data;
  if (Array.isArray(inner)) return inner;
  if (inner?.cleaned && Array.isArray(inner.cleaned)) return inner.cleaned;
  return [];
}

/**
 * Vector similarity search against the concept embedding index.
 * POST /api/v1/ariadne/vector-search
 */
export async function vectorSearch(params: VectorSearchParams): Promise<VectorResult[]> {
  const { data } = await apiClient.post("/ariadne/vector-search", params);
  const inner = data?.data ?? data;
  if (Array.isArray(inner)) return inner;
  if (inner?.results && Array.isArray(inner.results)) return inner.results;
  return [];
}
