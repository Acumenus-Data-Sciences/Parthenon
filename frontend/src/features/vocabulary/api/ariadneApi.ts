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
  const { data } = await apiClient.post<{ data: MappingResult[] } | MappingResult[]>(
    "/ariadne/map",
    params,
  );
  // Unwrap Laravel envelope if present
  if (data && typeof data === "object" && "data" in data && Array.isArray((data as { data: MappingResult[] }).data)) {
    return (data as { data: MappingResult[] }).data;
  }
  return data as MappingResult[];
}

/**
 * Clean and normalise messy source terms.
 * POST /api/v1/ariadne/clean-terms
 */
export async function cleanTerms(terms: string[]): Promise<CleanedTerm[]> {
  const { data } = await apiClient.post<{ data: CleanedTerm[] } | CleanedTerm[]>(
    "/ariadne/clean-terms",
    { terms },
  );
  if (data && typeof data === "object" && "data" in data && Array.isArray((data as { data: CleanedTerm[] }).data)) {
    return (data as { data: CleanedTerm[] }).data;
  }
  return data as CleanedTerm[];
}

/**
 * Vector similarity search against the concept embedding index.
 * POST /api/v1/ariadne/vector-search
 */
export async function vectorSearch(params: VectorSearchParams): Promise<VectorResult[]> {
  const { data } = await apiClient.post<{ data: VectorResult[] } | VectorResult[]>(
    "/ariadne/vector-search",
    params,
  );
  if (data && typeof data === "object" && "data" in data && Array.isArray((data as { data: VectorResult[] }).data)) {
    return (data as { data: VectorResult[] }).data;
  }
  return data as VectorResult[];
}
