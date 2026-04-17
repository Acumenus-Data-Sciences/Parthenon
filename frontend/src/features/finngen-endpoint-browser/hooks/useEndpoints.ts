// TanStack Query hooks for the FinnGen Endpoint Browser.
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import {
  fetchEndpoint,
  fetchEndpointStats,
  fetchEndpoints,
  type ListEndpointsParams,
} from "../api";

export function useEndpointStats() {
  return useQuery({
    queryKey: ["finngen-endpoints", "stats"],
    queryFn: fetchEndpointStats,
    staleTime: 60_000,
  });
}

export function useEndpointList(params: ListEndpointsParams) {
  return useQuery({
    queryKey: ["finngen-endpoints", "list", params],
    queryFn: () => fetchEndpoints(params),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

export function useEndpointDetail(name: string | null) {
  return useQuery({
    queryKey: ["finngen-endpoints", "detail", name],
    queryFn: () => fetchEndpoint(name ?? ""),
    enabled: !!name,
    staleTime: 60_000,
  });
}
