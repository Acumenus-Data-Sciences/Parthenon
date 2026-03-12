import { useState, useCallback, useRef, useEffect } from "react";
import { fetchProjection } from "../../api/chromaStudioApi";
import type { ProjectionResponse } from "../../api/chromaStudioApi";
import { DEFAULT_SAMPLE_SIZE, DEBOUNCE_MS, type ExplorerMode } from "./constants";

export interface VectorExplorerState {
  projectionData: ProjectionResponse | null;
  activeMode: ExplorerMode;
  sampleSize: number;
  colorField: string | null;
  selectedPoints: Set<string>;
  hoveredPoint: string | null;
  isExpanded: boolean;
  isLoading: boolean;
  isFallback: boolean;
  clusterVisibility: Map<number, boolean>;
  qaLayers: { outliers: boolean; duplicates: boolean; orphans: boolean };
  error: string | null;
}

export function useVectorExplorer(collectionName: string | null) {
  const [state, setState] = useState<VectorExplorerState>({
    projectionData: null,
    activeMode: "clusters",
    sampleSize: DEFAULT_SAMPLE_SIZE,
    colorField: null,
    selectedPoints: new Set(),
    hoveredPoint: null,
    isExpanded: false,
    isLoading: false,
    isFallback: false,
    clusterVisibility: new Map(),
    qaLayers: { outliers: true, duplicates: true, orphans: true },
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadProjection = useCallback(
    async (sampleSize: number) => {
      if (!collectionName) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState((s) => ({ ...s, isLoading: true, error: null, isFallback: false }));

      try {
        const data = await fetchProjection(
          collectionName,
          { sample_size: sampleSize, method: "pca-umap", dimensions: 3 },
          controller.signal,
        );

        if (controller.signal.aborted) return;

        const visibility = new Map<number, boolean>();
        for (const c of data.clusters) {
          visibility.set(c.id, true);
        }

        setState((s) => ({
          ...s,
          projectionData: data,
          isLoading: false,
          clusterVisibility: visibility,
        }));
      } catch (err: unknown) {
        // Axios throws CanceledError (not DOMException) when AbortController fires
        const isCanceled =
          (err instanceof DOMException && err.name === "AbortError") ||
          (err !== null && typeof err === "object" && "code" in err && (err as { code: string }).code === "ERR_CANCELED");
        if (isCanceled) return;

        console.error("[VectorExplorer] Projection request failed:", err);

        // Extract actual error details for debugging
        const axiosErr = err as { response?: { status?: number; data?: { error?: string } }; message?: string };
        const status = axiosErr?.response?.status;
        const detail = axiosErr?.response?.data?.error || axiosErr?.message || "Unknown error";
        const errorMsg = status ? `Projection failed (HTTP ${status}): ${detail}` : `Projection failed: ${detail}`;

        // Client-side fallback using umap-js
        try {
          const { fetchCollectionOverview } = await import("../../api/chromaStudioApi");
          const overview = await fetchCollectionOverview(collectionName!, true);
          const records = overview.sampleRecords.filter(
            (r) => Array.isArray(r.embedding) && r.embedding.length > 1,
          );
          if (records.length >= 3) {
            const { UMAP } = await import("umap-js");
            const umap = new UMAP({
              nNeighbors: Math.min(12, records.length - 1),
              minDist: 0.18,
              nComponents: 2,
            });
            const proj = umap.fit(records.map((r) => r.embedding!));
            const fallbackPoints = proj.map((coords: number[], i: number) => ({
              id: records[i].id,
              x: coords[0],
              y: coords[1],
              z: 0,
              metadata: records[i].metadata ?? {},
              cluster_id: 0,
            }));
            setState((s) => ({
              ...s,
              projectionData: {
                points: fallbackPoints,
                clusters: [],
                quality: { outlier_ids: [], duplicate_pairs: [], orphan_ids: [] },
                stats: { total_vectors: overview.count, sampled: records.length, projection_time_ms: 0 },
              },
              isLoading: false,
              isFallback: true,
              error: errorMsg + " — Showing basic 2D scatter.",
            }));
            return;
          }
        } catch {
          // fallback also failed
        }
        setState((s) => ({
          ...s,
          isLoading: false,
          isFallback: true,
          error: errorMsg,
        }));
      }
    },
    [collectionName],
  );

  useEffect(() => {
    if (collectionName) {
      loadProjection(state.sampleSize);
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [collectionName]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSampleSize = useCallback(
    (size: number) => {
      setState((s) => ({ ...s, sampleSize: size }));
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => loadProjection(size), DEBOUNCE_MS);
    },
    [loadProjection],
  );

  const setMode = useCallback((mode: ExplorerMode) => {
    setState((s) => ({ ...s, activeMode: mode, colorField: null }));
  }, []);

  const setColorField = useCallback((field: string | null) => {
    setState((s) => ({ ...s, colorField: field }));
  }, []);

  const setExpanded = useCallback((expanded: boolean) => {
    setState((s) => ({ ...s, isExpanded: expanded }));
  }, []);

  const selectPoint = useCallback((id: string, multi = false) => {
    setState((s) => {
      const next = new Set(multi ? s.selectedPoints : []);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return { ...s, selectedPoints: next };
    });
  }, []);

  const setHoveredPoint = useCallback((id: string | null) => {
    setState((s) => ({ ...s, hoveredPoint: id }));
  }, []);

  const toggleCluster = useCallback((clusterId: number) => {
    setState((s) => {
      const next = new Map(s.clusterVisibility);
      next.set(clusterId, !next.get(clusterId));
      return { ...s, clusterVisibility: next };
    });
  }, []);

  const toggleQaLayer = useCallback((layer: "outliers" | "duplicates" | "orphans") => {
    setState((s) => ({
      ...s,
      qaLayers: { ...s.qaLayers, [layer]: !s.qaLayers[layer] },
    }));
  }, []);

  const refresh = useCallback(() => {
    loadProjection(state.sampleSize);
  }, [loadProjection, state.sampleSize]);

  return {
    ...state,
    setSampleSize,
    setMode,
    setColorField,
    setExpanded,
    selectPoint,
    setHoveredPoint,
    toggleCluster,
    toggleQaLayer,
    refresh,
  };
}
