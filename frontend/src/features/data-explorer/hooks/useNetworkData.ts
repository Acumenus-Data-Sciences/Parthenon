import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  compareBatch,
  compareConcept,
  fetchAgePyramid,
  fetchAlerts,
  fetchAttritionFunnel,
  fetchCoverage,
  fetchCoverageExtended,
  fetchDapCheck,
  fetchDiversity,
  fetchDqOverlay,
  fetchFeasibilityAssessment,
  fetchFeasibilityImpact,
  fetchFeasibilityList,
  fetchFeasibilityTemplates,
  fetchConceptSetComparison,
  fetchGeographicDiversity,
  fetchMultiComparison,
  fetchNetworkDqSummary,
  fetchNetworkOverview,
  fetchPooledDemographics,
  fetchReleasesCalendar,
  fetchReleasesTimeline,
  fetchTemporalPrevalence,
  fetchStandardizedComparison,
  fetchFeasibilityForecast,
  runFeasibility,
  searchConceptsForComparison,
  storeFeasibilityTemplate,
  fetchCoverageExport,
  fetchDiversityTrends,
  fetchNetworkDqRadar,
} from "../api/networkAresApi";
import type { FeasibilityCriteria } from "../types/ares";

export function useAlerts() {
  return useQuery({
    queryKey: ["ares", "network", "alerts"],
    queryFn: fetchAlerts,
    staleTime: 5 * 60 * 1000,
  });
}

export function useNetworkOverview() {
  return useQuery({
    queryKey: ["ares", "network", "overview"],
    queryFn: fetchNetworkOverview,
    staleTime: 5 * 60 * 1000,
  });
}

export function useConceptComparison(conceptId: number | null) {
  return useQuery({
    queryKey: ["ares", "network", "compare", conceptId],
    queryFn: () => compareConcept(conceptId!),
    enabled: !!conceptId,
  });
}

export function useConceptSearch(query: string) {
  return useQuery({
    queryKey: ["ares", "network", "compare-search", query],
    queryFn: () => searchConceptsForComparison(query),
    enabled: query.length >= 2,
    staleTime: 60 * 1000,
  });
}

export function useBatchComparison(conceptIds: number[]) {
  return useQuery({
    queryKey: ["ares", "network", "compare-batch", conceptIds],
    queryFn: () => compareBatch(conceptIds),
    enabled: conceptIds.length > 0,
  });
}

export function useCoverage() {
  return useQuery({
    queryKey: ["ares", "network", "coverage"],
    queryFn: fetchCoverage,
    staleTime: 10 * 60 * 1000,
  });
}

export function useDiversity() {
  return useQuery({
    queryKey: ["ares", "network", "diversity"],
    queryFn: fetchDiversity,
    staleTime: 10 * 60 * 1000,
  });
}

export function useRunFeasibility() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, criteria }: { name: string; criteria: FeasibilityCriteria }) =>
      runFeasibility(name, criteria),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ares", "network", "feasibility"] }),
  });
}

export function useFeasibilityAssessment(id: number | null) {
  return useQuery({
    queryKey: ["ares", "network", "feasibility", id],
    queryFn: () => fetchFeasibilityAssessment(id!),
    enabled: !!id,
  });
}

export function useFeasibilityList() {
  return useQuery({
    queryKey: ["ares", "network", "feasibility"],
    queryFn: fetchFeasibilityList,
  });
}

export function useMultiConceptComparison(conceptIds: number[]) {
  return useQuery({
    queryKey: ["ares", "network", "compare-multi", conceptIds],
    queryFn: () => fetchMultiComparison(conceptIds),
    enabled: conceptIds.length >= 2,
  });
}

export function useAttritionFunnel(conceptIds: number[]) {
  return useQuery({
    queryKey: ["ares", "network", "compare-funnel", conceptIds],
    queryFn: () => fetchAttritionFunnel(conceptIds),
    enabled: conceptIds.length >= 2,
  });
}

export function useDqOverlay() {
  return useQuery({
    queryKey: ["ares", "network", "dq-overlay"],
    queryFn: fetchDqOverlay,
    staleTime: 5 * 60 * 1000,
  });
}

export function useNetworkDqSummary() {
  return useQuery({
    queryKey: ["ares", "network", "dq-summary"],
    queryFn: fetchNetworkDqSummary,
    staleTime: 5 * 60 * 1000,
  });
}

export function useCoverageExtended() {
  return useQuery({
    queryKey: ["ares", "network", "coverage", "extended"],
    queryFn: fetchCoverageExtended,
    staleTime: 10 * 60 * 1000,
  });
}

export function useFeasibilityImpact(id: number | null) {
  return useQuery({
    queryKey: ["ares", "network", "feasibility", id, "impact"],
    queryFn: () => fetchFeasibilityImpact(id!),
    enabled: !!id,
  });
}

export function useFeasibilityTemplates() {
  return useQuery({
    queryKey: ["ares", "network", "feasibility", "templates"],
    queryFn: fetchFeasibilityTemplates,
    staleTime: 10 * 60 * 1000,
  });
}

export function useStoreFeasibilityTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (template: { name: string; description?: string; criteria: Record<string, unknown>; is_public?: boolean }) =>
      storeFeasibilityTemplate(template),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ares", "network", "feasibility", "templates"] }),
  });
}

// ── Diversity hooks ──────────────────────────────────────────────────────

export function useAgePyramid(sourceId: number | null) {
  return useQuery({
    queryKey: ["ares", "diversity", "age-pyramid", sourceId],
    queryFn: () => fetchAgePyramid(sourceId!),
    enabled: !!sourceId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useDapCheck(targets: Record<string, number> | null) {
  return useQuery({
    queryKey: ["ares", "network", "diversity", "dap-check", targets],
    queryFn: () => fetchDapCheck(targets!),
    enabled: !!targets && Object.keys(targets).length > 0,
  });
}

export function usePooledDemographics(sourceIds: number[]) {
  return useQuery({
    queryKey: ["ares", "network", "diversity", "pooled", sourceIds],
    queryFn: () => fetchPooledDemographics(sourceIds),
    enabled: sourceIds.length > 0,
    staleTime: 10 * 60 * 1000,
  });
}

export function useGeographicDiversity() {
  return useQuery({
    queryKey: ["ares", "network", "diversity", "geographic"],
    queryFn: fetchGeographicDiversity,
    staleTime: 10 * 60 * 1000,
  });
}

// ── Release hooks ────────────────────────────────────────────────────────

export function useReleasesTimeline() {
  return useQuery({
    queryKey: ["ares", "network", "releases", "timeline"],
    queryFn: fetchReleasesTimeline,
    staleTime: 10 * 60 * 1000,
  });
}

export function useReleasesCalendar() {
  return useQuery({
    queryKey: ["ares", "network", "releases", "calendar"],
    queryFn: fetchReleasesCalendar,
    staleTime: 10 * 60 * 1000,
  });
}

// ── Phase C: Temporal prevalence + concept sets ─────────────────────────

export function useTemporalPrevalence(conceptId: number | null) {
  return useQuery({
    queryKey: ["ares", "network", "compare-temporal", conceptId],
    queryFn: () => fetchTemporalPrevalence(conceptId!),
    enabled: !!conceptId,
    staleTime: 5 * 60 * 1000,
  });
}

export function useConceptSetComparison(conceptIds: number[]) {
  return useQuery({
    queryKey: ["ares", "network", "compare-concept-set", conceptIds],
    queryFn: () => fetchConceptSetComparison(conceptIds),
    enabled: conceptIds.length >= 2,
    staleTime: 5 * 60 * 1000,
  });
}

// ── D1: Standardized comparison ──────────────────────────────────────

export function useStandardizedComparison(conceptId: number | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ["ares", "network", "compare-standardized", conceptId],
    queryFn: () => fetchStandardizedComparison(conceptId!),
    enabled: !!conceptId && enabled,
    staleTime: 5 * 60 * 1000,
  });
}

// ── D2: Feasibility forecast ─────────────────────────────────────────

export function useFeasibilityForecast(
  assessmentId: number | null,
  sourceId: number | null,
  months: number = 24,
) {
  return useQuery({
    queryKey: ["ares", "network", "feasibility", assessmentId, "forecast", sourceId, months],
    queryFn: () => fetchFeasibilityForecast(assessmentId!, sourceId!, months),
    enabled: !!assessmentId && !!sourceId,
    staleTime: 5 * 60 * 1000,
  });
}

// ── C6: Coverage export ─────────────────────────────────────────────

export function useCoverageExport(enabled: boolean = false) {
  return useQuery({
    queryKey: ["ares", "network", "coverage", "export"],
    queryFn: () => fetchCoverageExport("csv"),
    enabled,
    staleTime: 10 * 60 * 1000,
  });
}

// ── C6: Diversity trends (source-scoped) ────────────────────────────

export function useDiversityTrends(sourceId: number | null) {
  return useQuery({
    queryKey: ["ares", "diversity", "trends", sourceId],
    queryFn: () => fetchDiversityTrends(sourceId!),
    enabled: !!sourceId,
    staleTime: 10 * 60 * 1000,
  });
}

// ── C1: Network DQ Radar ──────────────────────────────────────────

export function useNetworkDqRadar() {
  return useQuery({
    queryKey: ["ares", "network", "dq-radar"],
    queryFn: fetchNetworkDqRadar,
    staleTime: 5 * 60 * 1000,
  });
}
