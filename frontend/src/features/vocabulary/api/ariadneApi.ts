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

export interface SaveMappingEntry {
  source_code: string;
  source_code_description: string | null;
  target_concept_id: number;
  target_vocabulary_id: string;
  source_vocabulary_id?: string;
  source_concept_id?: number;
}

export interface MappingProject {
  id: number;
  name: string;
  description: string | null;
  source_terms: string[];
  results: MappingResult[];
  decisions: Record<string, string | null>;
  target_vocabularies: string[] | null;
  target_domains: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface SaveProjectParams {
  name: string;
  description?: string;
  source_terms: string[];
  results: MappingResult[];
  decisions: Record<string, string | null>;
  target_vocabularies?: string[];
  target_domains?: string[];
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

/**
 * Save accepted mappings to source_to_concept_map.
 * POST /api/v1/ariadne/save-mappings
 */
export async function saveMappings(
  mappings: SaveMappingEntry[],
): Promise<{ saved: number }> {
  const { data } = await apiClient.post("/ariadne/save-mappings", { mappings });
  return data;
}

/**
 * Persist a mapping session as a project.
 * POST /api/v1/ariadne/projects
 */
export async function saveProject(
  params: SaveProjectParams,
): Promise<MappingProject> {
  const { data } = await apiClient.post("/ariadne/projects", params);
  return data?.data ?? data;
}

/**
 * List mapping projects for the current user.
 * GET /api/v1/ariadne/projects
 */
export async function listProjects(): Promise<MappingProject[]> {
  const { data } = await apiClient.get("/ariadne/projects");
  // Paginated Laravel response: { data: [...], ... }
  return data?.data ?? [];
}

/**
 * Load a single mapping project by ID.
 * GET /api/v1/ariadne/projects/{id}
 */
export async function loadProject(id: number): Promise<MappingProject> {
  const { data } = await apiClient.get(`/ariadne/projects/${id}`);
  return data?.data ?? data;
}
