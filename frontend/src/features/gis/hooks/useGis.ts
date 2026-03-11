import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchBoundaries,
  fetchBoundaryDetail,
  fetchGisStats,
  fetchChoropleth,
  fetchCountries,
  loadGisDataset,
} from "../api";
import type { AdminLevel, ChoroplethParams } from "../types";

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
