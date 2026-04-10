import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getCohortDefinitions,
  getCohortDefinition,
  getCohortGenerations,
  createCohortDefinition,
  updateCohortDefinition,
  deleteCohortDefinition,
  generateCohort,
  copyCohortDefinition,
  compareCohorts,
  getCohortStats,
  createCohortFromBundle,
  getCohortDomains,
  getGroupedCohortDefinitions,
} from "../api/cohortApi";
import type {
  CohortDefinitionListParams,
  CreateCohortDefinitionPayload,
  UpdateCohortDefinitionPayload,
  CohortDefinitionGroupedParams,
} from "../types/cohortExpression";

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useCohortDefinitions(params?: CohortDefinitionListParams & { enabled?: boolean }) {
  const { enabled, ...queryParams } = params ?? {};
  return useQuery({
    queryKey: ["cohort-definitions", queryParams],
    queryFn: () => getCohortDefinitions(queryParams),
    enabled: enabled ?? true,
  });
}

export function useCohortDomains() {
  return useQuery({
    queryKey: ["cohort-definitions", "domains"],
    queryFn: getCohortDomains,
    staleTime: 60_000,
  });
}

export function useGroupedCohortDefinitions(params: CohortDefinitionGroupedParams & { enabled?: boolean }) {
  const { enabled, ...queryParams } = params;
  return useQuery({
    queryKey: ["cohort-definitions", "grouped", queryParams],
    queryFn: () => getGroupedCohortDefinitions(queryParams),
    enabled: enabled ?? true,
  });
}

export function useCohortDefinition(id: number | null) {
  return useQuery({
    queryKey: ["cohort-definitions", id],
    queryFn: () => getCohortDefinition(id!),
    enabled: id != null && id > 0,
  });
}

export function useCohortGenerations(defId: number | null) {
  return useQuery({
    queryKey: ["cohort-definitions", defId, "generations"],
    queryFn: () => getCohortGenerations(defId!),
    enabled: defId != null && defId > 0,
  });
}

// ---------------------------------------------------------------------------
// Mutation hooks
// ---------------------------------------------------------------------------

export function useCreateCohortDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateCohortDefinitionPayload) =>
      createCohortDefinition(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohort-definitions"] });
    },
  });
}

export function useUpdateCohortDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: UpdateCohortDefinitionPayload;
    }) => updateCohortDefinition(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["cohort-definitions", variables.id],
      });
      queryClient.invalidateQueries({ queryKey: ["cohort-definitions"] });
    },
  });
}

export function useDeleteCohortDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteCohortDefinition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohort-definitions"] });
    },
  });
}

export function useGenerateCohort() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      defId,
      sourceId,
    }: {
      defId: number;
      sourceId: number;
    }) => generateCohort(defId, { source_id: sourceId }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["cohort-definitions", variables.defId, "generations"],
      });
    },
  });
}

export function useCopyCohortDefinition() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => copyCohortDefinition(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohort-definitions"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Stats & Create from Bundle
// ---------------------------------------------------------------------------

export function useCohortStats() {
  return useQuery({
    queryKey: ["cohort-definitions", "stats"],
    queryFn: getCohortStats,
    staleTime: 30_000,
  });
}

export function useCreateCohortFromBundle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createCohortFromBundle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cohort-definitions"] });
    },
  });
}

// ---------------------------------------------------------------------------
// §9.4 — Cohort Overlap
// ---------------------------------------------------------------------------

export function useCohortOverlap(
  cohortIds: number[],
  sourceId: number | null,
) {
  return useQuery({
    queryKey: ["cohort-overlap", cohortIds, sourceId],
    queryFn: () =>
      compareCohorts({ cohort_ids: cohortIds, source_id: sourceId! }),
    enabled: cohortIds.length >= 2 && sourceId != null,
    staleTime: 60_000,
  });
}
