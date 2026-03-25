import apiClient from "@/lib/api-client";
import type {
  AgePyramidBand,
  AresAlert,
  ConceptComparison,
  ConceptSearchResult,
  CoverageMatrix,
  CriteriaImpact,
  DapGapItem,
  DiversitySource,
  ExtendedCoverageMatrix,
  FeasibilityAssessment,
  FeasibilityCriteria,
  FeasibilityTemplate,
  MultiConceptComparison,
  NetworkDqSource,
  NetworkOverview,
  PooledDemographics,
  ReleaseCalendarEvent,
  ReleaseDiff,
  SwimLaneEntry,
} from "../types/ares";

interface AttritionFunnelSource {
  source_id: number;
  source_name: string;
  steps: Array<{
    concept_name: string;
    remaining_patients: number;
    percentage: number;
  }>;
}

interface DqOverlaySource {
  source_id: number;
  source_name: string;
  trends: Array<{
    release_name: string;
    created_at: string;
    pass_rate: number;
  }>;
}

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

// Multi-concept comparison
export async function fetchMultiComparison(conceptIds: number[]): Promise<MultiConceptComparison> {
  const { data } = await apiClient.get("/network/ares/compare/multi", {
    params: { concept_ids: conceptIds.join(",") },
  });
  return unwrap<MultiConceptComparison>(data);
}

// Attrition funnel
export async function fetchAttritionFunnel(conceptIds: number[]): Promise<AttritionFunnelSource[]> {
  const { data } = await apiClient.get("/network/ares/compare/funnel", {
    params: { concept_ids: conceptIds.join(",") },
  });
  return unwrap<AttritionFunnelSource[]>(data);
}

// Extended coverage (temporal + expected vs actual)
export async function fetchCoverageExtended(): Promise<ExtendedCoverageMatrix> {
  const { data } = await apiClient.get("/network/ares/coverage/extended");
  return unwrap<ExtendedCoverageMatrix>(data);
}

// Feasibility impact analysis
export async function fetchFeasibilityImpact(id: number): Promise<CriteriaImpact[]> {
  const { data } = await apiClient.get(`/network/ares/feasibility/${id}/impact`);
  return unwrap<CriteriaImpact[]>(data);
}

// Feasibility templates
export async function fetchFeasibilityTemplates(): Promise<FeasibilityTemplate[]> {
  const { data } = await apiClient.get("/network/ares/feasibility/templates");
  return unwrap<FeasibilityTemplate[]>(data);
}

export async function storeFeasibilityTemplate(
  template: { name: string; description?: string; criteria: Record<string, unknown>; is_public?: boolean },
): Promise<FeasibilityTemplate> {
  const { data } = await apiClient.post("/network/ares/feasibility/templates", template);
  return unwrap<FeasibilityTemplate>(data);
}

// Network DQ
export async function fetchNetworkDqSummary(): Promise<NetworkDqSource[]> {
  const { data } = await apiClient.get("/network/ares/dq-summary");
  return unwrap<NetworkDqSource[]>(data);
}

// Network Alerts
export async function fetchAlerts(): Promise<AresAlert[]> {
  const { data } = await apiClient.get("/network/ares/alerts");
  return unwrap<AresAlert[]>(data);
}

// Network DQ Overlay
export async function fetchDqOverlay(): Promise<DqOverlaySource[]> {
  const { data } = await apiClient.get("/network/ares/dq-overlay");
  return unwrap<DqOverlaySource[]>(data);
}

// Diversity: Age pyramid (source-scoped)
export async function fetchAgePyramid(sourceId: number): Promise<AgePyramidBand[]> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/diversity/age-pyramid`);
  return unwrap<AgePyramidBand[]>(data);
}

// Diversity: DAP gap analysis (network)
export async function fetchDapCheck(
  targets: Record<string, number>,
): Promise<Array<{ source_id: number; source_name: string; gaps: DapGapItem[] }>> {
  const { data } = await apiClient.post("/network/ares/diversity/dap-check", { targets });
  return unwrap<Array<{ source_id: number; source_name: string; gaps: DapGapItem[] }>>(data);
}

// Diversity: Pooled demographics (network)
export async function fetchPooledDemographics(sourceIds: number[]): Promise<PooledDemographics> {
  const { data } = await apiClient.get("/network/ares/diversity/pooled", {
    params: { source_ids: sourceIds.join(",") },
  });
  return unwrap<PooledDemographics>(data);
}

// Release diff (source-scoped)
export async function fetchReleaseDiff(sourceId: number, releaseId: number): Promise<ReleaseDiff> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/releases/${releaseId}/diff`);
  return unwrap<ReleaseDiff>(data);
}

// Releases: Swimlane timeline (network)
export async function fetchReleasesTimeline(): Promise<SwimLaneEntry[]> {
  const { data } = await apiClient.get("/network/ares/releases/timeline");
  return unwrap<SwimLaneEntry[]>(data);
}

// Releases: Calendar (network)
export async function fetchReleasesCalendar(): Promise<ReleaseCalendarEvent[]> {
  const { data } = await apiClient.get("/network/ares/releases/calendar");
  return unwrap<ReleaseCalendarEvent[]>(data);
}
