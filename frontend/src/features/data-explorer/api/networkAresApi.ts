import apiClient from "@/lib/api-client";
import type {
  ConceptComparison,
  ConceptSearchResult,
  CoverageMatrix,
  DiversitySource,
  FeasibilityAssessment,
  FeasibilityCriteria,
  NetworkDqSource,
  NetworkOverview,
} from "../types/ares";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap<T>(body: any): T {
  if (body && typeof body === "object" && "data" in body && !Array.isArray(body)) {
    return body.data as T;
  }
  return body as T;
}

// Hub overview
export async function fetchNetworkOverview(): Promise<NetworkOverview> {
  const { data } = await apiClient.get("/network/ares/overview");
  return unwrap<NetworkOverview>(data);
}

// Concept comparison
export async function compareConcept(conceptId: number): Promise<ConceptComparison[]> {
  const { data } = await apiClient.get("/network/ares/compare", { params: { concept_id: conceptId } });
  return unwrap<ConceptComparison[]>(data);
}

export async function searchConceptsForComparison(query: string): Promise<ConceptSearchResult[]> {
  const { data } = await apiClient.get("/network/ares/compare/search", { params: { q: query } });
  return unwrap<ConceptSearchResult[]>(data);
}

export async function compareBatch(conceptIds: number[]): Promise<Record<number, ConceptComparison[]>> {
  const { data } = await apiClient.get("/network/ares/compare/batch", {
    params: { concept_ids: conceptIds.join(",") },
  });
  return unwrap<Record<number, ConceptComparison[]>>(data);
}

// Coverage
export async function fetchCoverage(): Promise<CoverageMatrix> {
  const { data } = await apiClient.get("/network/ares/coverage");
  return unwrap<CoverageMatrix>(data);
}

// Diversity
export async function fetchDiversity(): Promise<DiversitySource[]> {
  const { data } = await apiClient.get("/network/ares/diversity");
  return unwrap<DiversitySource[]>(data);
}

// Feasibility
export async function runFeasibility(
  name: string,
  criteria: FeasibilityCriteria,
): Promise<FeasibilityAssessment> {
  const { data } = await apiClient.post("/network/ares/feasibility", { name, criteria });
  return unwrap<FeasibilityAssessment>(data);
}

export async function fetchFeasibilityAssessment(id: number): Promise<FeasibilityAssessment> {
  const { data } = await apiClient.get(`/network/ares/feasibility/${id}`);
  return unwrap<FeasibilityAssessment>(data);
}

export async function fetchFeasibilityList(): Promise<FeasibilityAssessment[]> {
  const { data } = await apiClient.get("/network/ares/feasibility");
  return unwrap<FeasibilityAssessment[]>(data);
}

// Network DQ
export async function fetchNetworkDqSummary(): Promise<NetworkDqSource[]> {
  const { data } = await apiClient.get("/network/ares/dq-summary");
  return unwrap<NetworkDqSource[]>(data);
}
