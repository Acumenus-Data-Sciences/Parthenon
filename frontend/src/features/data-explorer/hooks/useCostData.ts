import { useQuery } from "@tanstack/react-query";
import {
  fetchCostSummary,
  fetchCostTrends,
  fetchCostDomainDetail,
  fetchNetworkCost,
} from "../api/costApi";

export function useCostSummary(sourceId: number | null) {
  return useQuery({
    queryKey: ["ares", "cost", "summary", sourceId],
    queryFn: () => fetchCostSummary(sourceId!),
    enabled: !!sourceId,
  });
}

export function useCostTrends(sourceId: number | null) {
  return useQuery({
    queryKey: ["ares", "cost", "trends", sourceId],
    queryFn: () => fetchCostTrends(sourceId!),
    enabled: !!sourceId,
  });
}

export function useCostDomainDetail(sourceId: number | null, domain: string | null) {
  return useQuery({
    queryKey: ["ares", "cost", "domain", sourceId, domain],
    queryFn: () => fetchCostDomainDetail(sourceId!, domain!),
    enabled: !!sourceId && !!domain,
  });
}

export function useNetworkCost() {
  return useQuery({
    queryKey: ["ares", "network", "cost"],
    queryFn: fetchNetworkCost,
    staleTime: 10 * 60 * 1000,
  });
}
