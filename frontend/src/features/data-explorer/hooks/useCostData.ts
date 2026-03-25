import { useQuery } from "@tanstack/react-query";
import {
  fetchCostSummary,
  fetchCostTrends,
  fetchCostDomainDetail,
  fetchNetworkCost,
  fetchCostDistribution,
  fetchCostCareSetting,
  fetchCostTypes,
  fetchNetworkCostCompare,
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

export function useCostDistribution(
  sourceId: number | null,
  domain?: string,
  costTypeId?: number,
) {
  return useQuery({
    queryKey: ["ares", "cost", "distribution", sourceId, domain, costTypeId],
    queryFn: () => fetchCostDistribution(sourceId!, domain, costTypeId),
    enabled: !!sourceId,
  });
}

export function useCareSettingBreakdown(sourceId: number | null) {
  return useQuery({
    queryKey: ["ares", "cost", "care-setting", sourceId],
    queryFn: () => fetchCostCareSetting(sourceId!),
    enabled: !!sourceId,
  });
}

export function useCostTypes(sourceId: number | null) {
  return useQuery({
    queryKey: ["ares", "cost", "types", sourceId],
    queryFn: () => fetchCostTypes(sourceId!),
    enabled: !!sourceId,
  });
}

export function useNetworkCostCompare() {
  return useQuery({
    queryKey: ["ares", "network", "cost", "compare"],
    queryFn: fetchNetworkCostCompare,
    staleTime: 10 * 60 * 1000,
  });
}
