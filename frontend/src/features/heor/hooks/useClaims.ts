import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { claimsApi, type ClaimsSearchFilters } from "../api/claimsApi";

export function useClaimsSearch(filters: ClaimsSearchFilters) {
  return useQuery({
    queryKey: ["claims-search", filters],
    queryFn: () => claimsApi.search(filters),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}
