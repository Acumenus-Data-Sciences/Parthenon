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

export async function fetchCostSummary(sourceId: number): Promise<CostSummary> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/cost/summary`);
  return unwrap<CostSummary>(data);
}

export async function fetchCostTrends(sourceId: number): Promise<CostTrends> {
  const { data } = await apiClient.get(`/sources/${sourceId}/ares/cost/trends`);
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
