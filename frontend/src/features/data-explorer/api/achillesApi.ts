import apiClient from "@/lib/api-client";
import type {
  RecordCount,
  Demographics,
  ObservationPeriods,
  DomainSummary,
  ConceptDrilldown,
  TemporalTrendPoint,
  AnalysisInfo,
  PerformanceEntry,
  DistributionEntry,
} from "../types/dataExplorer";

const BASE = (sourceId: number) => `/sources/${sourceId}/achilles`;

export async function fetchRecordCounts(
  sourceId: number,
): Promise<RecordCount[]> {
  const { data } = await apiClient.get<RecordCount[]>(
    `${BASE(sourceId)}/record-counts`,
  );
  return data;
}

export async function fetchDemographics(
  sourceId: number,
): Promise<Demographics> {
  const { data } = await apiClient.get<Demographics>(
    `${BASE(sourceId)}/demographics`,
  );
  return data;
}

export async function fetchObservationPeriods(
  sourceId: number,
): Promise<ObservationPeriods> {
  const { data } = await apiClient.get<ObservationPeriods>(
    `${BASE(sourceId)}/observation-periods`,
  );
  return data;
}

export async function fetchDomainSummary(
  sourceId: number,
  domain: string,
  limit = 25,
): Promise<DomainSummary> {
  const { data } = await apiClient.get<DomainSummary>(
    `${BASE(sourceId)}/domains/${domain}`,
    { params: { limit } },
  );
  return data;
}

export async function fetchConceptDrilldown(
  sourceId: number,
  domain: string,
  conceptId: number,
): Promise<ConceptDrilldown> {
  const { data } = await apiClient.get<ConceptDrilldown>(
    `${BASE(sourceId)}/domains/${domain}/concepts/${conceptId}`,
  );
  return data;
}

export async function fetchTemporalTrends(
  sourceId: number,
  domain: string,
): Promise<TemporalTrendPoint[]> {
  const { data } = await apiClient.get<TemporalTrendPoint[]>(
    `${BASE(sourceId)}/temporal-trends`,
    { params: { domain } },
  );
  return data;
}

export async function fetchAnalyses(
  sourceId: number,
): Promise<AnalysisInfo[]> {
  const { data } = await apiClient.get<AnalysisInfo[]>(
    `${BASE(sourceId)}/analyses`,
  );
  return data;
}

export async function fetchPerformance(
  sourceId: number,
): Promise<PerformanceEntry[]> {
  const { data } = await apiClient.get<PerformanceEntry[]>(
    `${BASE(sourceId)}/performance`,
  );
  return data;
}

export async function fetchDistribution(
  sourceId: number,
  analysisId: number,
  stratum1?: string,
): Promise<DistributionEntry[]> {
  const { data } = await apiClient.get<DistributionEntry[]>(
    `${BASE(sourceId)}/distributions/${analysisId}`,
    {
      params: stratum1 ? { stratum1 } : undefined,
    },
  );
  return data;
}
