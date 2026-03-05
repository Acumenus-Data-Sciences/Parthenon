import { useQuery } from "@tanstack/react-query";
import { getPatientProfile, getCohortMembers } from "../api/profileApi";

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
