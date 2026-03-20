import { useQuery } from "@tanstack/react-query";
import {
  fetchConceptCount,
  fetchConceptHierarchy,
  searchConcepts,
} from "../api";

export function useConceptSearch(query: string, domain?: string) {
  return useQuery({
    queryKey: ["concept-search", query, domain],
    queryFn: () => searchConcepts(query, domain),
    enabled: query.length >= 2,
    staleTime: 30_000,
  });
}

export function useConceptHierarchy(conceptId: number | undefined) {
  return useQuery({
    queryKey: ["concept-hierarchy", conceptId],
    queryFn: () => fetchConceptHierarchy(conceptId!),
    enabled: !!conceptId,
  });
}

export function useConceptCount(conceptId: number | undefined) {
  return useQuery({
    queryKey: ["concept-count", conceptId],
    queryFn: () => fetchConceptCount(conceptId!),
    enabled: !!conceptId,
    staleTime: 60_000,
  });
}
