import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchBoundaries,
  fetchBoundaryDetail,
  fetchGisStats,
  fetchChoropleth,
  fetchCountries,
  loadGisDataset,
  fetchDatasetStatus,
  fetchConditions,
  fetchConditionCategories,
  fetchCdmChoropleth,
  fetchTimePeriods,
  fetchDiseaseSummary,
  fetchCountyDetail,
} from "../api";
import type { AdminLevel, CdmChoroplethParams, ChoroplethParams } from "../types";

export function useGisStats() {
  return useQuery({
    queryKey: ["gis", "stats"],
    queryFn: fetchGisStats,
    staleTime: 60_000,
  });
}

export function useBoundaries(params: {
  level?: AdminLevel;
  country_code?: string;
  parent_gid?: string;
  bbox?: string;
  simplify?: number;
  enabled?: boolean;
}) {
  const { enabled = true, ...queryParams } = params;
  return useQuery({
    queryKey: ["gis", "boundaries", queryParams],
    queryFn: () => fetchBoundaries(queryParams),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function useBoundaryDetail(id: number | null) {
  return useQuery({
    queryKey: ["gis", "boundaries", id],
    queryFn: () => fetchBoundaryDetail(id!),
    enabled: id !== null,
  });
}

export function useChoropleth(params: ChoroplethParams | null) {
  return useQuery({
    queryKey: ["gis", "choropleth", params],
    queryFn: () => fetchChoropleth(params!),
    enabled: params !== null,
    staleTime: 30_000,
  });
}

export function useCountries() {
  return useQuery({
    queryKey: ["gis", "countries"],
    queryFn: fetchCountries,
    staleTime: 5 * 60_000,
  });
}

export function useLoadDataset() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: loadGisDataset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["gis"] });
    },
  });
}

export function useDatasetStatus(id: number | null) {
  return useQuery({
    queryKey: ["gis", "dataset", id],
    queryFn: () => fetchDatasetStatus(id!),
    enabled: id !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "running" || status === "pending" ? 2000 : false;
    },
  });
}

// CDM Spatial hooks (v2 — disease-agnostic)

export function useConditions(params?: {
  search?: string;
  category?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["gis", "conditions", params],
    queryFn: () => fetchConditions(params),
    staleTime: 5 * 60_000,
  });
}

export function useConditionCategories() {
  return useQuery({
    queryKey: ["gis", "condition-categories"],
    queryFn: fetchConditionCategories,
    staleTime: 5 * 60_000,
  });
}

export function useCdmChoropleth(params: CdmChoroplethParams | null) {
  return useQuery({
    queryKey: ["gis", "cdm-choropleth", params],
    queryFn: () => fetchCdmChoropleth(params!),
    enabled: params !== null,
    staleTime: 60_000,
  });
}

export function useTimePeriods(conceptId: number | null) {
  return useQuery({
    queryKey: ["gis", "time-periods", conceptId],
    queryFn: () => fetchTimePeriods(conceptId!),
    enabled: conceptId !== null,
    staleTime: 5 * 60_000,
  });
}

export function useDiseaseSummary(conceptId: number | null) {
  return useQuery({
    queryKey: ["gis", "disease-summary", conceptId],
    queryFn: () => fetchDiseaseSummary(conceptId!),
    enabled: conceptId !== null,
    staleTime: 60_000,
  });
}

export function useCountyDetail(gadmGid: string | null, conceptId: number | null) {
  return useQuery({
    queryKey: ["gis", "county-detail", gadmGid, conceptId],
    queryFn: () => fetchCountyDetail(gadmGid!, conceptId!),
    enabled: gadmGid !== null && conceptId !== null,
  });
}
