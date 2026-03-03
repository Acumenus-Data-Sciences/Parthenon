import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchRecordCounts,
  fetchDemographics,
  fetchObservationPeriods,
  fetchDomainSummary,
  fetchConceptDrilldown,
  fetchTemporalTrends,
  fetchHeelResults,
  runHeel,
} from "../api/achillesApi";
import {
  fetchDqdRuns,
  fetchDqdRun,
  fetchDqdResults,
  fetchLatestDqd,
} from "../api/dqdApi";

// ---------------------------------------------------------------------------
// Achilles hooks
// ---------------------------------------------------------------------------

export function useRecordCounts(sourceId: number) {
  return useQuery({
    queryKey: ["achilles", "record-counts", sourceId],
    queryFn: () => fetchRecordCounts(sourceId),
    enabled: sourceId > 0,
  });
}

export function useDemographics(sourceId: number) {
  return useQuery({
    queryKey: ["achilles", "demographics", sourceId],
    queryFn: () => fetchDemographics(sourceId),
    enabled: sourceId > 0,
  });
}

export function useObservationPeriods(sourceId: number) {
  return useQuery({
    queryKey: ["achilles", "observation-periods", sourceId],
    queryFn: () => fetchObservationPeriods(sourceId),
    enabled: sourceId > 0,
  });
}

export function useDomainSummary(sourceId: number, domain: string) {
  return useQuery({
    queryKey: ["achilles", "domain-summary", sourceId, domain],
    queryFn: () => fetchDomainSummary(sourceId, domain),
    enabled: sourceId > 0 && domain.length > 0,
  });
}

export function useConceptDrilldown(
  sourceId: number,
  domain: string,
  conceptId: number | null,
) {
  return useQuery({
    queryKey: ["achilles", "concept-drilldown", sourceId, domain, conceptId],
    queryFn: () => fetchConceptDrilldown(sourceId, domain, conceptId!),
    enabled: sourceId > 0 && conceptId != null && conceptId > 0,
  });
}

export function useTemporalTrends(sourceId: number, domain: string) {
  return useQuery({
    queryKey: ["achilles", "temporal-trends", sourceId, domain],
    queryFn: () => fetchTemporalTrends(sourceId, domain),
    enabled: sourceId > 0 && domain.length > 0,
  });
}

// ---------------------------------------------------------------------------
// Achilles Heel hooks
// ---------------------------------------------------------------------------

export function useHeelResults(sourceId: number) {
  return useQuery({
    queryKey: ["achilles", "heel", sourceId],
    queryFn: () => fetchHeelResults(sourceId),
    enabled: sourceId > 0,
  });
}

export function useRunHeel(sourceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => runHeel(sourceId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["achilles", "heel", sourceId] });
    },
  });
}

// ---------------------------------------------------------------------------
// DQD hooks
// ---------------------------------------------------------------------------

export function useDqdRuns(sourceId: number) {
  return useQuery({
    queryKey: ["dqd", "runs", sourceId],
    queryFn: () => fetchDqdRuns(sourceId),
    enabled: sourceId > 0,
  });
}

export function useDqdRun(sourceId: number, runId: string | null) {
  return useQuery({
    queryKey: ["dqd", "run", sourceId, runId],
    queryFn: () => fetchDqdRun(sourceId, runId!),
    enabled: sourceId > 0 && runId != null,
  });
}

export function useDqdResults(
  sourceId: number,
  runId: string | null,
  params?: { category?: string; table?: string; passed?: boolean },
) {
  return useQuery({
    queryKey: ["dqd", "results", sourceId, runId, params],
    queryFn: () => fetchDqdResults(sourceId, runId!, params),
    enabled: sourceId > 0 && runId != null,
  });
}

export function useLatestDqd(sourceId: number) {
  return useQuery({
    queryKey: ["dqd", "latest", sourceId],
    queryFn: () => fetchLatestDqd(sourceId),
    enabled: sourceId > 0,
  });
}
