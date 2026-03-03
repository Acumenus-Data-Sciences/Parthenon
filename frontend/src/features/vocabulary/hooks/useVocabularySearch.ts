import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  searchConcepts,
  getConcept,
  getConceptRelationships,
  getConceptAncestors,
  getConceptDescendants,
  getDomains,
  getVocabularies,
  compareConcepts,
  getConceptMapsFrom,
} from "../api/vocabularyApi";
import type { Concept } from "../types/vocabulary";

// ---------------------------------------------------------------------------
// Vocabulary search hook with debounce
// ---------------------------------------------------------------------------

interface VocabularySearchFilters {
  domain?: string;
  vocabulary?: string;
  standard?: boolean;
}

export function useVocabularySearch(
  query: string,
  filters: VocabularySearchFilters,
  page?: number,
) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: [
      "vocabulary",
      "search",
      debouncedQuery,
      filters.domain,
      filters.vocabulary,
      filters.standard,
      page,
    ],
    queryFn: () =>
      searchConcepts({
        q: debouncedQuery,
        domain: filters.domain,
        vocabulary: filters.vocabulary,
        standard: filters.standard,
        page,
      }),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
    select: (result) => result.items,
  });

  return { data: data as Concept[] | undefined, isLoading, error, isFetching };
}

// ---------------------------------------------------------------------------
// Single concept hook
// ---------------------------------------------------------------------------

export function useConcept(id: number | null) {
  return useQuery({
    queryKey: ["vocabulary", "concept", id],
    queryFn: () => getConcept(id!),
    enabled: id != null && id > 0,
  });
}

// ---------------------------------------------------------------------------
// Concept relationships hook
// ---------------------------------------------------------------------------

export function useConceptRelationships(id: number | null, page?: number) {
  return useQuery({
    queryKey: ["vocabulary", "relationships", id, page],
    queryFn: () => getConceptRelationships(id!, page),
    enabled: id != null && id > 0,
  });
}

// ---------------------------------------------------------------------------
// Ancestors hook
// ---------------------------------------------------------------------------

export function useConceptAncestors(id: number | null) {
  return useQuery({
    queryKey: ["vocabulary", "ancestors", id],
    queryFn: () => getConceptAncestors(id!),
    enabled: id != null && id > 0,
  });
}

// ---------------------------------------------------------------------------
// Descendants hook
// ---------------------------------------------------------------------------

export function useConceptDescendants(id: number | null, page?: number) {
  return useQuery({
    queryKey: ["vocabulary", "descendants", id, page],
    queryFn: () => getConceptDescendants(id!, page),
    enabled: id != null && id > 0,
  });
}

// ---------------------------------------------------------------------------
// Domains & Vocabularies hooks
// ---------------------------------------------------------------------------

export function useDomains() {
  return useQuery({
    queryKey: ["vocabulary", "domains"],
    queryFn: getDomains,
    staleTime: 5 * 60 * 1000,
  });
}

export function useVocabularies() {
  return useQuery({
    queryKey: ["vocabulary", "vocabularies"],
    queryFn: getVocabularies,
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Concept comparison hook (2-4 concepts)
// ---------------------------------------------------------------------------

export function useConceptComparison(ids: number[]) {
  return useQuery({
    queryKey: ["vocabulary", "compare", ...ids],
    queryFn: () => compareConcepts(ids),
    enabled: ids.length >= 2 && ids.length <= 4,
    staleTime: 60_000,
  });
}

// ---------------------------------------------------------------------------
// Maps-from hook (reverse source code lookup)
// ---------------------------------------------------------------------------

export function useConceptMapsFrom(id: number | null) {
  return useQuery({
    queryKey: ["vocabulary", "maps-from", id],
    queryFn: () => getConceptMapsFrom(id!),
    enabled: id != null && id > 0,
  });
}

// ---------------------------------------------------------------------------
// Re-export a convenience callback hook for use in components
// ---------------------------------------------------------------------------

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
