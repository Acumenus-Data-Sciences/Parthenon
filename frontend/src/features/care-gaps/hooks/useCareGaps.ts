import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  listBundles,
  getBundle,
  createBundle,
  updateBundle,
  deleteBundle,
  getBundleMeasures,
  addBundleMeasure,
  removeBundleMeasure,
  evaluateBundle,
  listEvaluations,
  getEvaluation,
  getOverlapRules,
  getPopulationSummary,
} from "../api/careGapApi";
import type {
  CreateBundlePayload,
  UpdateBundlePayload,
  BundleListParams,
} from "../types/careGap";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

const keys = {
  bundles: ["care-gap-bundles"] as const,
  bundle: (id: number) => ["care-gap-bundles", id] as const,
  measures: (bundleId: number) =>
    ["care-gap-bundles", bundleId, "measures"] as const,
  evaluations: (bundleId: number) =>
    ["care-gap-bundles", bundleId, "evaluations"] as const,
  evaluation: (bundleId: number, evalId: number) =>
    ["care-gap-bundles", bundleId, "evaluations", evalId] as const,
  overlapRules: ["care-gap-overlap-rules"] as const,
  populationSummary: (sourceId: number) =>
    ["care-gap-population-summary", sourceId] as const,
};

// ---------------------------------------------------------------------------
// Bundle queries
// ---------------------------------------------------------------------------

export function useBundles(params?: BundleListParams) {
  return useQuery({
    queryKey: [...keys.bundles, params],
    queryFn: () => listBundles(params),
  });
}

export function useBundle(id: number | null) {
  return useQuery({
    queryKey: keys.bundle(id!),
    queryFn: () => getBundle(id!),
    enabled: id != null && id > 0,
  });
}

// ---------------------------------------------------------------------------
// Bundle measure queries
// ---------------------------------------------------------------------------

export function useBundleMeasures(bundleId: number | null) {
  return useQuery({
    queryKey: keys.measures(bundleId!),
    queryFn: () => getBundleMeasures(bundleId!),
    enabled: bundleId != null && bundleId > 0,
  });
}

// ---------------------------------------------------------------------------
// Evaluation queries (with polling for running evaluations)
// ---------------------------------------------------------------------------

export function useEvaluations(bundleId: number | null) {
  return useQuery({
    queryKey: keys.evaluations(bundleId!),
    queryFn: () => listEvaluations(bundleId!),
    enabled: bundleId != null && bundleId > 0,
  });
}

export function useEvaluation(
  bundleId: number | null,
  evaluationId: number | null,
) {
  return useQuery({
    queryKey: keys.evaluation(bundleId!, evaluationId!),
    queryFn: () => getEvaluation(bundleId!, evaluationId!),
    enabled:
      bundleId != null &&
      bundleId > 0 &&
      evaluationId != null &&
      evaluationId > 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "running" || status === "pending") {
        return 2000;
      }
      return false;
    },
  });
}

// ---------------------------------------------------------------------------
// Overlap rules & population summary
// ---------------------------------------------------------------------------

export function useOverlapRules() {
  return useQuery({
    queryKey: keys.overlapRules,
    queryFn: getOverlapRules,
  });
}

export function usePopulationSummary(sourceId: number | null) {
  return useQuery({
    queryKey: keys.populationSummary(sourceId!),
    queryFn: () => getPopulationSummary(sourceId!),
    enabled: sourceId != null && sourceId > 0,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function useCreateBundle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateBundlePayload) => createBundle(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.bundles });
    },
  });
}

export function useUpdateBundle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: number;
      payload: UpdateBundlePayload;
    }) => updateBundle(id, payload),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: keys.bundle(variables.id),
      });
      queryClient.invalidateQueries({ queryKey: keys.bundles });
    },
  });
}

export function useDeleteBundle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => deleteBundle(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.bundles });
    },
  });
}

export function useAddBundleMeasure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      bundleId,
      measureId,
      ordinal,
    }: {
      bundleId: number;
      measureId: number;
      ordinal: number;
    }) => addBundleMeasure(bundleId, measureId, ordinal),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: keys.measures(variables.bundleId),
      });
      queryClient.invalidateQueries({
        queryKey: keys.bundle(variables.bundleId),
      });
    },
  });
}

export function useRemoveBundleMeasure() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      bundleId,
      measureId,
    }: {
      bundleId: number;
      measureId: number;
    }) => removeBundleMeasure(bundleId, measureId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: keys.measures(variables.bundleId),
      });
      queryClient.invalidateQueries({
        queryKey: keys.bundle(variables.bundleId),
      });
    },
  });
}

export function useEvaluateBundle() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      bundleId,
      sourceId,
      cohortDefinitionId,
    }: {
      bundleId: number;
      sourceId: number;
      cohortDefinitionId?: number;
    }) => evaluateBundle(bundleId, sourceId, cohortDefinitionId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: keys.evaluations(variables.bundleId),
      });
      queryClient.invalidateQueries({
        queryKey: keys.bundle(variables.bundleId),
      });
    },
  });
}
