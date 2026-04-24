import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  computeIntersection,
  createCohortFromIntersection,
  fetchBundleQualifications,
  fetchBundleRuns,
  fetchCoverageMatrix,
  fetchRun,
  materializeAllBundles,
  materializeBundle,
} from "./api";
import type { IntersectionMode } from "./types";

const KEYS = {
  coverage: () => ["care-bundles", "coverage"] as const,
  qualifications: (bundleId: number, sourceId: number) =>
    ["care-bundles", bundleId, "qualifications", sourceId] as const,
  runs: (bundleId: number) => ["care-bundles", bundleId, "runs"] as const,
  run: (runId: number) => ["care-bundles", "runs", runId] as const,
};

export function useCareBundleCoverage() {
  return useQuery({
    queryKey: KEYS.coverage(),
    queryFn: fetchCoverageMatrix,
    staleTime: 30_000,
  });
}

export function useCareBundleQualifications(
  bundleId: number | null,
  sourceId: number | null,
) {
  return useQuery({
    queryKey:
      bundleId && sourceId
        ? KEYS.qualifications(bundleId, sourceId)
        : ["care-bundles", "qualifications", "disabled"],
    queryFn: () => fetchBundleQualifications(bundleId as number, sourceId as number),
    enabled: bundleId != null && sourceId != null,
    staleTime: 30_000,
  });
}

export function useCareBundleRuns(bundleId: number | null) {
  return useQuery({
    queryKey: bundleId ? KEYS.runs(bundleId) : ["care-bundles", "runs", "disabled"],
    queryFn: () => fetchBundleRuns(bundleId as number),
    enabled: bundleId != null,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!Array.isArray(data)) return false;
      const hasInFlight = data.some(
        (r) => r.status === "pending" || r.status === "running",
      );
      return hasInFlight ? 3_000 : false;
    },
  });
}

export function useCareBundleRun(runId: number | null) {
  return useQuery({
    queryKey: runId ? KEYS.run(runId) : ["care-bundles", "run", "disabled"],
    queryFn: () => fetchRun(runId as number),
    enabled: runId != null,
  });
}

export function useMaterializeCareBundle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bundleId, sourceId }: { bundleId: number; sourceId: number }) =>
      materializeBundle(bundleId, sourceId),
    onSuccess: (_, { bundleId }) => {
      qc.invalidateQueries({ queryKey: KEYS.runs(bundleId) });
      qc.invalidateQueries({ queryKey: KEYS.coverage() });
    },
  });
}

export function useMaterializeAllCareBundles() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: materializeAllBundles,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["care-bundles"] });
    },
  });
}

export function useCareBundleIntersection(
  sourceId: number | null,
  bundleIds: number[],
  mode: IntersectionMode,
) {
  const ids = [...bundleIds].sort((a, b) => a - b);
  const enabled = sourceId != null && ids.length >= 1;

  return useQuery({
    queryKey: [
      "care-bundles",
      "intersections",
      sourceId,
      ids,
      mode,
    ],
    queryFn: () =>
      computeIntersection({ source_id: sourceId as number, bundle_ids: ids, mode }),
    enabled,
    staleTime: 60_000,
  });
}

export function useCreateCohortFromIntersection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createCohortFromIntersection,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cohort-definitions"] });
      qc.invalidateQueries({ queryKey: ["care-gap-bundles"] });
    },
  });
}
