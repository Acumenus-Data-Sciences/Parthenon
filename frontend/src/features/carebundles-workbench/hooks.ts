import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  computeIntersection,
  createCohortFromIntersection,
  fetchBundleQualifications,
  fetchBundleRuns,
  fetchCareBundleSources,
  fetchCoverageMatrix,
  fetchMeasureMethodology,
  fetchMeasureStrata,
  fetchRun,
  fetchVsacCodes,
  fetchVsacMeasure,
  fetchVsacMeasures,
  fetchVsacOmopConcepts,
  fetchVsacValueSet,
  fetchVsacValueSets,
  materializeAllBundles,
  materializeBundle,
  type VsacValueSetListParams,
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

// ---------------------------------------------------------------------------
// Source population gate
// ---------------------------------------------------------------------------

export function useCareBundleSources() {
  return useQuery({
    queryKey: ["care-bundles", "sources"],
    queryFn: fetchCareBundleSources,
    staleTime: 5 * 60_000,
  });
}

// ---------------------------------------------------------------------------
// VSAC library
// ---------------------------------------------------------------------------

export function useVsacValueSets(params: VsacValueSetListParams = {}) {
  return useQuery({
    queryKey: ["vsac", "value-sets", params],
    queryFn: () => fetchVsacValueSets(params),
    staleTime: 60_000,
  });
}

export function useVsacValueSet(oid: string | null) {
  return useQuery({
    queryKey: oid ? ["vsac", "value-sets", oid] : ["vsac", "vs", "disabled"],
    queryFn: () => fetchVsacValueSet(oid as string),
    enabled: oid != null,
    staleTime: 60_000,
  });
}

export function useVsacCodes(
  oid: string | null,
  params: { code_system?: string; page?: number; per_page?: number } = {},
) {
  return useQuery({
    queryKey: oid ? ["vsac", "codes", oid, params] : ["vsac", "codes", "disabled"],
    queryFn: () => fetchVsacCodes(oid as string, params),
    enabled: oid != null,
  });
}

export function useVsacOmopConcepts(
  oid: string | null,
  params: { vocabulary_id?: string; page?: number; per_page?: number } = {},
) {
  return useQuery({
    queryKey: oid ? ["vsac", "omop", oid, params] : ["vsac", "omop", "disabled"],
    queryFn: () => fetchVsacOmopConcepts(oid as string, params),
    enabled: oid != null,
  });
}

export function useVsacMeasures(
  params: { q?: string; page?: number; per_page?: number } = {},
) {
  return useQuery({
    queryKey: ["vsac", "measures", params],
    queryFn: () => fetchVsacMeasures(params),
    staleTime: 60_000,
  });
}

export function useVsacMeasure(cmsId: string | null) {
  return useQuery({
    queryKey: cmsId ? ["vsac", "measures", cmsId] : ["vsac", "measure", "disabled"],
    queryFn: () => fetchVsacMeasure(cmsId as string),
    enabled: cmsId != null,
  });
}

// ---------------------------------------------------------------------------
// Methodology + Stratification
// ---------------------------------------------------------------------------

export function useMeasureMethodology(
  bundleId: number | null,
  measureId: number | null,
  sourceId: number | null,
  enabled: boolean = true,
) {
  const ready = enabled && bundleId != null && measureId != null && sourceId != null;
  return useQuery({
    queryKey: ready
      ? ["care-bundles", bundleId, "measures", measureId, "methodology", sourceId]
      : ["care-bundles", "methodology", "disabled"],
    queryFn: () => fetchMeasureMethodology(bundleId as number, measureId as number, sourceId as number),
    enabled: ready,
    staleTime: 5 * 60_000,
  });
}

export function useMeasureStrata(
  bundleId: number | null,
  measureId: number | null,
  sourceId: number | null,
  enabled: boolean = true,
) {
  const ready = enabled && bundleId != null && measureId != null && sourceId != null;
  return useQuery({
    queryKey: ready
      ? ["care-bundles", bundleId, "measures", measureId, "strata", sourceId]
      : ["care-bundles", "strata", "disabled"],
    queryFn: () => fetchMeasureStrata(bundleId as number, measureId as number, sourceId as number),
    enabled: ready,
    staleTime: 5 * 60_000,
  });
}
