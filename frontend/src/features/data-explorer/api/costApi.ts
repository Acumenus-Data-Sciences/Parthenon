import apiClient from "@/lib/api-client";
import type {
  CostSummary,
  CostTrends,
  CostDomainDetail,
  NetworkCost,
} from "../types/ares";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap<T>(body: any): T {
  if (body && typeof body === "object" && "data" in body && !Array.isArray(body)) {
    return body.data as T;
  }
  return body as T;
}

export async function fetchCostSummary(
  sourceId: number,
  costTypeConceptId?: number,
): Promise<CostSummary> {
  const params: Record<string, number> = {};
  if (costTypeConceptId) params.cost_type_concept_id = costTypeConceptId;

  const { data } = await apiClient.get(`/sources/${sourceId}/ares/cost/summary`, { params });
  return unwrap<CostSummary>(data);
}

export async function fetchCostTrends(
  sourceId: number,
  costTypeConceptId?: number,
): Promise<CostTrends> {
  const params: Record<string, number> = {};
  if (costTypeConceptId) params.cost_type_concept_id = costTypeConceptId;

  const { data } = await apiClient.get(`/sources/${sourceId}/ares/cost/trends`, { params });
  return unwrap<CostTrends>(data);
}

export async function fetchCostDomainDetail(
  sourceId: number,
  domain: string,
): Promise<CostDomainDetail> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/cost/domains/${domain}`);
  return unwrap<CostDomainDetail>(data);
}

export async function fetchNetworkCost(): Promise<NetworkCost> {
  const { data } = await apiClient.get("/network/ares/cost");
  return unwrap<NetworkCost>(data);
}

// Cost Distribution (box plot data)
export interface CostDistributionItem {
  domain: string;
  min: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  max: number;
  mean: number;
  count: number;
}

export interface CostDistributionResponse {
  has_cost_data: boolean;
  distributions: CostDistributionItem[];
}

export async function fetchCostDistribution(
  sourceId: number,
  domain?: string,
  costTypeId?: number,
): Promise<CostDistributionResponse> {
  const params: Record<string, string | number> = {};
  if (domain) params.domain = domain;
  if (costTypeId) params.cost_type = costTypeId;

  const { data } = await apiClient.get(`/sources/${sourceId}/ares/cost/distribution`, { params });
  return unwrap<CostDistributionResponse>(data);
}

// Care Setting Breakdown
export interface CareSettingItem {
  setting: string;
  visit_concept_id: number;
  total_cost: number;
  record_count: number;
  avg_cost: number;
}

export interface CareSettingResponse {
  has_cost_data: boolean;
  settings: CareSettingItem[];
}

export async function fetchCostCareSetting(sourceId: number): Promise<CareSettingResponse> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/cost/care-setting`);
  return unwrap<CareSettingResponse>(data);
}

// Cost Types
export interface CostTypeInfo {
  cost_type_concept_id: number;
  concept_name: string;
  record_count: number;
}

export async function fetchCostTypes(sourceId: number): Promise<CostTypeInfo[]> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/cost/types`);
  return unwrap<CostTypeInfo[]>(data);
}

// Network Cost Compare
export interface NetworkCostCompareResponse {
  sources: Array<{
    source_id: number;
    source_name: string;
    has_cost_data: boolean;
    total_cost: number;
    pppy: number;
    person_count: number;
  }>;
}

export async function fetchNetworkCostCompare(): Promise<NetworkCostCompareResponse> {
  const { data } = await apiClient.get("/network/ares/cost/compare");
  return unwrap<NetworkCostCompareResponse>(data);
}

// Cross-Source Cost Comparison (detailed distributions)
export interface CrossSourceDistribution {
  min: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  max: number;
}

export interface CrossSourceCostSource {
  source_id: number;
  source_name: string;
  has_cost_data: boolean;
  distribution: CrossSourceDistribution | null;
}

export interface CrossSourceCostResponse {
  sources: CrossSourceCostSource[];
}

export async function fetchCrossSourceCost(
  domain: string = "all",
  costTypeId?: number,
): Promise<CrossSourceCostResponse> {
  const params: Record<string, string | number> = { domain };
  if (costTypeId) params.cost_type = costTypeId;

  const { data } = await apiClient.get("/network/ares/cost/compare/detailed", { params });
  return unwrap<CrossSourceCostResponse>(data);
}

// Cost Drivers
export interface CostDriver {
  concept_id: number;
  concept_name: string;
  domain: string;
  total_cost: number;
  record_count: number;
  patient_count: number;
  pct_of_total: number;
}

export interface CostDriversResponse {
  has_cost_data: boolean;
  drivers: CostDriver[];
}

export async function fetchCostDrivers(
  sourceId: number,
  limit: number = 10,
): Promise<CostDriversResponse> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/cost/drivers`, {
    params: { limit },
  });
  return unwrap<CostDriversResponse>(data);
}
