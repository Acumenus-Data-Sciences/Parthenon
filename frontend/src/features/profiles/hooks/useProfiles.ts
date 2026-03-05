import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getPatientProfile, getCohortMembers, searchPersons, getProfileStats } from "../api/profileApi";

export function usePersonSearch(sourceId: number | null, query: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(timer);
  }, [query]);

  return useQuery({
    queryKey: ["person-search", sourceId, debouncedQuery],
    queryFn: () => searchPersons(sourceId!, debouncedQuery),
    enabled: sourceId != null && sourceId > 0 && debouncedQuery.trim().length >= 1,
    staleTime: 30_000,
  });
}

export function usePatientProfile(
  sourceId: number | null,
  personId: number | null,
) {
  return useQuery({
    queryKey: ["profiles", sourceId, personId],
    queryFn: () => getPatientProfile(sourceId!, personId!),
    enabled:
      sourceId != null &&
      sourceId > 0 &&
      personId != null &&
      personId > 0,
  });
}

export function useProfileStats(sourceId: number | null, personId: number | null) {
  return useQuery({
    queryKey: ["profile-stats", sourceId, personId],
    queryFn: () => getProfileStats(sourceId!, personId!),
    enabled: sourceId != null && sourceId > 0 && personId != null && personId > 0,
    staleTime: 60_000,
  });
}

export function useCohortMembers(
  sourceId: number | null,
  cohortId: number | null,
  page?: number,
  perPage?: number,
) {
  return useQuery({
    queryKey: ["cohort-members", sourceId, cohortId, { page, perPage }],
    queryFn: () =>
      getCohortMembers(sourceId!, cohortId!, { page, per_page: perPage }),
    enabled:
      sourceId != null &&
      sourceId > 0 &&
      cohortId != null &&
      cohortId > 0,
  });
}
