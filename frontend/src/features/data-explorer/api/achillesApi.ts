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
  HeelResultsGrouped,
  HeelRunResult,
} from "../types/dataExplorer";

const BASE = (sourceId: number) => `/sources/${sourceId}/achilles`;

/** Unwrap Laravel's { data: T } envelope — returns T whether wrapped or not */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap<T>(body: any): T {
  if (body && typeof body === "object" && "data" in body && !Array.isArray(body)) {
    return body.data as T;
  }
  return body as T;
}

export async function fetchRecordCounts(
  sourceId: number,
): Promise<RecordCount[]> {
  const { data } = await apiClient.get(`${BASE(sourceId)}/record-counts`);
  return unwrap<RecordCount[]>(data);
}

export async function fetchDemographics(
  sourceId: number,
): Promise<Demographics> {
  const { data } = await apiClient.get(`${BASE(sourceId)}/demographics`);
  return unwrap<Demographics>(data);
}

export async function fetchObservationPeriods(
  sourceId: number,
): Promise<ObservationPeriods> {
  const { data } = await apiClient.get(`${BASE(sourceId)}/observation-periods`);
  return unwrap<ObservationPeriods>(data);
}

export async function fetchDomainSummary(
  sourceId: number,
  domain: string,
  limit = 25,
): Promise<DomainSummary> {
  const { data } = await apiClient.get(
    `${BASE(sourceId)}/domains/${domain}`,
    { params: { limit } },
  );
  return unwrap<DomainSummary>(data);
}

export async function fetchConceptDrilldown(
  sourceId: number,
  domain: string,
  conceptId: number,
): Promise<ConceptDrilldown> {
  const { data } = await apiClient.get(
    `${BASE(sourceId)}/domains/${domain}/concepts/${conceptId}`,
  );
  return unwrap<ConceptDrilldown>(data);
}

export async function fetchTemporalTrends(
  sourceId: number,
  domain: string,
): Promise<TemporalTrendPoint[]> {
  const { data } = await apiClient.get(
    `${BASE(sourceId)}/temporal-trends`,
    { params: { domain } },
  );
  return unwrap<TemporalTrendPoint[]>(data);
}

export async function fetchAnalyses(
  sourceId: number,
): Promise<AnalysisInfo[]> {
  const { data } = await apiClient.get(`${BASE(sourceId)}/analyses`);
  return unwrap<AnalysisInfo[]>(data);
}

export async function fetchPerformance(
  sourceId: number,
): Promise<PerformanceEntry[]> {
  const { data } = await apiClient.get(`${BASE(sourceId)}/performance`);
  return unwrap<PerformanceEntry[]>(data);
}

export async function fetchDistribution(
  sourceId: number,
  analysisId: number,
  stratum1?: string,
): Promise<DistributionEntry[]> {
  const { data } = await apiClient.get(
    `${BASE(sourceId)}/distributions/${analysisId}`,
    { params: stratum1 ? { stratum1 } : undefined },
  );
  return unwrap<DistributionEntry[]>(data);
}

export async function fetchHeelResults(
  sourceId: number,
): Promise<HeelResultsGrouped> {
  const { data } = await apiClient.get(`${BASE(sourceId)}/heel`);
  return unwrap<HeelResultsGrouped>(data);
}

export async function runHeel(sourceId: number): Promise<HeelRunResult> {
  const { data } = await apiClient.post(`${BASE(sourceId)}/heel/run`);
  return unwrap<HeelRunResult>(data);
}
