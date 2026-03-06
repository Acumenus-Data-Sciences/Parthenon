import { useState, useEffect, useCallback } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
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
  suggestConcepts,
} from "../api/vocabularyApi";
import type { Concept, FacetCounts, SuggestResult } from "../types/vocabulary";

// ---------------------------------------------------------------------------
// Vocabulary search hook with debounce + infinite scroll
// ---------------------------------------------------------------------------

interface VocabularySearchFilters {
  domain?: string;
  vocabulary?: string;
  standard?: boolean;
}

const SEARCH_LIMIT = 25;

export function useVocabularySearch(
  query: string,
  filters: VocabularySearchFilters,
) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 350);
    return () => clearTimeout(timer);
  }, [query]);

  const result = useInfiniteQuery({
    queryKey: [
      "vocabulary",
      "search",
      debouncedQuery,
      filters.domain,
      filters.vocabulary,
      filters.standard,
    ],
    queryFn: ({ pageParam = 0 }) =>
      searchConcepts({
        q: debouncedQuery,
        domain: filters.domain,
        vocabulary: filters.vocabulary,
        standard: filters.standard,
        limit: SEARCH_LIMIT,
        offset: pageParam,
      }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      return loaded < lastPage.total ? loaded : undefined;
    },
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  const items = result.data?.pages.flatMap((p) => p.items) as Concept[] | undefined;
  const total = result.data?.pages[0]?.total ?? 0;
  const facets = result.data?.pages[0]?.facets;
  const engine = result.data?.pages[0]?.engine;

  return {
    data: items,
    total,
    facets,
    engine,
    isLoading: result.isLoading,
    error: result.error,
    isFetching: result.isFetching,
    hasNextPage: result.hasNextPage,
    fetchNextPage: result.fetchNextPage,
    isFetchingNextPage: result.isFetchingNextPage,
  };
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
// Suggest / autocomplete hook (Solr-powered when available)
// ---------------------------------------------------------------------------

export function useConceptSuggest(prefix: string) {
  const [debouncedPrefix, setDebouncedPrefix] = useState(prefix);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedPrefix(prefix), 200);
    return () => clearTimeout(timer);
  }, [prefix]);

  return useQuery({
    queryKey: ["vocabulary", "suggest", debouncedPrefix],
    queryFn: () => suggestConcepts(debouncedPrefix),
    enabled: debouncedPrefix.length >= 2,
    staleTime: 60_000,
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
