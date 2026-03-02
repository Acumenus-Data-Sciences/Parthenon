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
} from "../api/cohortApi";
import type {
  CohortDefinitionListParams,
  CreateCohortDefinitionPayload,
  UpdateCohortDefinitionPayload,
} from "../types/cohortExpression";

// ---------------------------------------------------------------------------
// Query hooks
// ---------------------------------------------------------------------------

export function useCohortDefinitions(params?: CohortDefinitionListParams) {
  return useQuery({
    queryKey: ["cohort-definitions", params],
    queryFn: () => getCohortDefinitions(params),
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
