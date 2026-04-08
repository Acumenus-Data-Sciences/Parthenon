import { useState, useCallback, useRef, useEffect } from "react";
import {
  fetchProjection,
  fetchProjectionPointDetails,
  queryCollection,
  searchProjectionPoints,
} from "../../api/chromaStudioApi";
import type {
  ProjectionResponse,
  ProjectionSearchResponse,
  QueryResponse,
} from "../../api/chromaStudioApi";
import {
  DEFAULT_SAMPLE_SIZE,
  DEBOUNCE_MS,
  getRecommendedSampleSize,
  type ExplorerMode,
} from "./constants";

const BASE_PROJECTION_METADATA_FIELDS = new Set(["source", "type", "category", "title"]);

export interface VectorExplorerState {
  projectionData: ProjectionResponse | null;
  activeMode: ExplorerMode;
  sampleSize: number;
  dimensions: 2 | 3;
  projectionSearchText: string;
  projectionSearchSource: string;
  projectionSearchDocType: string;
  projectionSearchClusterId: string;
  projectionSearchResults: ProjectionSearchResponse | null;
  isProjectionSearchLoading: boolean;
  projectionSearchError: string | null;
  queryText: string;
  queryResults: QueryResponse | null;
  isQueryLoading: boolean;
  queryError: string | null;
  colorField: string | null;
  pointDetailsById: Record<string, ProjectionResponse["points"][number]>;
  pointDetailsLoadingIds: Set<string>;
  pointDetailsError: string | null;
  selectedClusterId: number | null;
  selectedPoints: Set<string>;
  hoveredPoint: string | null;
  isExpanded: boolean;
  isLoading: boolean;
  isFallback: boolean;
  overlayVisibility: {
    hulls: boolean;
    topology: boolean;
    queryRays: boolean;
  };
  clusterVisibility: Map<number, boolean>;
  qaLayers: { outliers: boolean; duplicates: boolean; orphans: boolean };
  error: string | null;
}

export function useVectorExplorer(collectionName: string | null, collectionSize?: number | null) {
  const initialSampleSize = collectionSize ? getRecommendedSampleSize(collectionSize) : DEFAULT_SAMPLE_SIZE;
  const [state, setState] = useState<VectorExplorerState>({
    projectionData: null,
    activeMode: "clusters",
    sampleSize: initialSampleSize,
    dimensions: 3,
    projectionSearchText: "",
    projectionSearchSource: "",
    projectionSearchDocType: "",
    projectionSearchClusterId: "",
    projectionSearchResults: null,
    isProjectionSearchLoading: false,
    projectionSearchError: null,
    queryText: "",
    queryResults: null,
    isQueryLoading: false,
    queryError: null,
    colorField: null,
    pointDetailsById: {},
    pointDetailsLoadingIds: new Set(),
    pointDetailsError: null,
    selectedClusterId: null,
    selectedPoints: new Set(),
    hoveredPoint: null,
    isExpanded: false,
    isLoading: false,
    isFallback: false,
    overlayVisibility: {
      hulls: true,
      topology: false,
      queryRays: true,
    },
    clusterVisibility: new Map(),
    qaLayers: { outliers: true, duplicates: true, orphans: true },
    error: null,
  });

  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sampleSizeRef = useRef(initialSampleSize);
  const dimensionsRef = useRef<2 | 3>(3);
  const colorFieldRef = useRef<string | null>(null);

  const loadProjectionWithOptions = useCallback(
    async (
      sampleSize: number,
      dimensions: 2 | 3,
      options?: { forceRefresh?: boolean },
    ) => {
      if (!collectionName) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setState((s) => ({ ...s, isLoading: true, error: null, isFallback: false }));

      try {
        const data = await fetchProjection(
          collectionName,
          {
            sample_size: sampleSize,
            method: "pca-umap",
            dimensions,
            refresh: options?.forceRefresh,
            color_field: colorFieldRef.current ?? undefined,
          },
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
          pointDetailsError: null,
          selectedClusterId: data.clusters[0]?.id ?? null,
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
                edges: [],
                clusters: [],
                quality: { outlier_ids: [], duplicate_pairs: [], orphan_ids: [] },
                stats: {
                  total_vectors: overview.count,
                  sampled: records.length,
                  projection_time_ms: 0,
                  source: "fallback",
                },
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
    if (!collectionName) {
      return () => {
        abortRef.current?.abort();
      };
    }

    const nextSampleSize = collectionSize ? getRecommendedSampleSize(collectionSize) : DEFAULT_SAMPLE_SIZE;
    sampleSizeRef.current = nextSampleSize;
    dimensionsRef.current = 3;
    colorFieldRef.current = null;
    setState((s) => ({
      ...s,
      projectionData: null,
      activeMode: "clusters",
      sampleSize: nextSampleSize,
      dimensions: 3,
      projectionSearchText: "",
      projectionSearchSource: "",
      projectionSearchDocType: "",
      projectionSearchClusterId: "",
      projectionSearchResults: null,
      isProjectionSearchLoading: false,
      projectionSearchError: null,
      queryText: "",
      queryResults: null,
      isQueryLoading: false,
      queryError: null,
      colorField: null,
      pointDetailsById: {},
      pointDetailsLoadingIds: new Set(),
      pointDetailsError: null,
      selectedClusterId: null,
      selectedPoints: new Set(),
      hoveredPoint: null,
      overlayVisibility: {
        hulls: true,
        topology: false,
        queryRays: true,
      },
      clusterVisibility: new Map(),
      error: null,
      isFallback: false,
    }));
    loadProjectionWithOptions(nextSampleSize, 3);

    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [collectionName, collectionSize, loadProjectionWithOptions]);

  useEffect(() => {
    if (!collectionName || state.projectionData?.stats?.source !== "solr" || state.selectedPoints.size === 0) {
      return;
    }

    const missingIds = Array.from(state.selectedPoints).filter(
      (id) => !(id in state.pointDetailsById) && !state.pointDetailsLoadingIds.has(id),
    );

    if (missingIds.length === 0) {
      return;
    }

    let cancelled = false;

    setState((s) => ({
      ...s,
      pointDetailsError: null,
      pointDetailsLoadingIds: new Set([...s.pointDetailsLoadingIds, ...missingIds]),
    }));

    Promise.all(
      missingIds.map(async (id) => ({
        id,
        detail: await fetchProjectionPointDetails(collectionName, id),
      })),
    )
      .then((results) => {
        if (cancelled) {
          return;
        }

        setState((s) => {
          const pointDetailsById = { ...s.pointDetailsById };
          const pointDetailsLoadingIds = new Set(s.pointDetailsLoadingIds);

          for (const result of results) {
            pointDetailsById[result.id] = result.detail;
            pointDetailsLoadingIds.delete(result.id);
          }

          return {
            ...s,
            pointDetailsById,
            pointDetailsLoadingIds,
          };
        });
      })
      .catch((err: unknown) => {
        if (cancelled) {
          return;
        }

        const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
        const pointDetailsError =
          axiosErr?.response?.data?.error || axiosErr?.message || "Failed to load point details.";

        setState((s) => {
          const pointDetailsLoadingIds = new Set(s.pointDetailsLoadingIds);
          for (const id of missingIds) {
            pointDetailsLoadingIds.delete(id);
          }

          return {
            ...s,
            pointDetailsLoadingIds,
            pointDetailsError,
          };
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    collectionName,
    state.pointDetailsById,
    state.pointDetailsLoadingIds,
    state.projectionData?.stats?.source,
    state.selectedPoints,
  ]);

  const setSampleSize = useCallback(
    (size: number) => {
      if (size === sampleSizeRef.current) {
        return;
      }
      sampleSizeRef.current = size;
      setState((s) => ({
        ...s,
        sampleSize: size,
        projectionSearchResults: null,
        projectionSearchError: null,
      }));
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(
        () => loadProjectionWithOptions(size, dimensionsRef.current),
        DEBOUNCE_MS,
      );
    },
    [loadProjectionWithOptions],
  );

  const setMode = useCallback((mode: ExplorerMode) => {
    setState((s) => ({ ...s, activeMode: mode, colorField: null }));
  }, []);

  const setColorField = useCallback(
    (field: string | null) => {
      if (colorFieldRef.current === field) {
        return;
      }
      colorFieldRef.current = field;
      setState((s) => (s.colorField === field ? s : { ...s, colorField: field }));

      if (field && !BASE_PROJECTION_METADATA_FIELDS.has(field)) {
        loadProjectionWithOptions(sampleSizeRef.current, dimensionsRef.current);
      }
    },
    [loadProjectionWithOptions],
  );

  const setQueryText = useCallback((queryText: string) => {
    setState((s) => ({ ...s, queryText }));
  }, []);

  const setProjectionSearchText = useCallback((projectionSearchText: string) => {
    setState((s) => ({ ...s, projectionSearchText }));
  }, []);

  const setProjectionSearchSource = useCallback((projectionSearchSource: string) => {
    setState((s) => ({ ...s, projectionSearchSource }));
  }, []);

  const setProjectionSearchDocType = useCallback((projectionSearchDocType: string) => {
    setState((s) => ({ ...s, projectionSearchDocType }));
  }, []);

  const setProjectionSearchClusterId = useCallback((projectionSearchClusterId: string) => {
    setState((s) => ({ ...s, projectionSearchClusterId }));
  }, []);

  const runProjectionSearch = useCallback(async () => {
    if (!collectionName) {
      return;
    }

    if (state.projectionData?.stats?.source !== "solr") {
      setState((s) => ({
        ...s,
        projectionSearchResults: null,
        isProjectionSearchLoading: false,
        projectionSearchError: "Projection filtering is available on Solr-cached projections.",
      }));
      return;
    }

    const query = state.projectionSearchText.trim();
    const source = state.projectionSearchSource.trim();
    const docType = state.projectionSearchDocType.trim();
    const clusterId = state.projectionSearchClusterId.trim();
    const hasFilters = query.length > 0 || source.length > 0 || docType.length > 0 || clusterId.length > 0;

    if (!hasFilters) {
      setState((s) => ({
        ...s,
        projectionSearchResults: null,
        projectionSearchError: null,
        isProjectionSearchLoading: false,
      }));
      return;
    }

    setState((s) => ({
      ...s,
      isProjectionSearchLoading: true,
      projectionSearchError: null,
    }));

    try {
      const projectionSearchResults = await searchProjectionPoints(collectionName, {
        query: query || undefined,
        source: source || undefined,
        doc_type: docType || undefined,
        cluster_id: clusterId.length > 0 ? Number(clusterId) : undefined,
        limit: Math.min(10000, state.projectionData?.stats?.sampled ?? 5000),
      });

      setState((s) => ({
        ...s,
        projectionSearchResults,
        isProjectionSearchLoading: false,
      }));
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
      const projectionSearchError =
        axiosErr?.response?.data?.error || axiosErr?.message || "Projection search failed.";
      setState((s) => ({
        ...s,
        isProjectionSearchLoading: false,
        projectionSearchError,
      }));
    }
  }, [
    collectionName,
    state.projectionSearchText,
    state.projectionSearchSource,
    state.projectionSearchDocType,
    state.projectionSearchClusterId,
    state.projectionData?.stats?.sampled,
    state.projectionData?.stats?.source,
  ]);

  const clearProjectionSearch = useCallback(() => {
    setState((s) => ({
      ...s,
      projectionSearchText: "",
      projectionSearchSource: "",
      projectionSearchDocType: "",
      projectionSearchClusterId: "",
      projectionSearchResults: null,
      projectionSearchError: null,
      isProjectionSearchLoading: false,
    }));
  }, []);

  const runQuery = useCallback(
    async (nextQueryText?: string) => {
      const queryText = (nextQueryText ?? state.queryText).trim();
      if (!collectionName || queryText.length === 0) {
        setState((s) => ({ ...s, queryResults: null, queryError: null }));
        return;
      }

      setState((s) => ({
        ...s,
        queryText,
        isQueryLoading: true,
        queryError: null,
      }));

      try {
        const queryResults = await queryCollection({
          collectionName,
          queryText,
          nResults: 12,
        });

        setState((s) => ({
          ...s,
          queryText,
          queryResults,
          isQueryLoading: false,
        }));
      } catch (err: unknown) {
        const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
        const queryError =
          axiosErr?.response?.data?.error || axiosErr?.message || "Semantic query failed.";

        setState((s) => ({
          ...s,
          isQueryLoading: false,
          queryError,
          queryResults: null,
        }));
      }
    },
    [collectionName, state.queryText],
  );

  const setDimensions = useCallback(
    (dimensions: 2 | 3) => {
      if (dimensions === dimensionsRef.current) {
        return;
      }
      dimensionsRef.current = dimensions;
      setState((s) => ({
        ...s,
        dimensions,
        projectionSearchResults: null,
        projectionSearchError: null,
      }));
      loadProjectionWithOptions(sampleSizeRef.current, dimensions);
    },
    [loadProjectionWithOptions],
  );

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
    setState((s) => (s.hoveredPoint === id ? s : { ...s, hoveredPoint: id }));
  }, []);

  const setSelectedCluster = useCallback((clusterId: number | null) => {
    setState((s) => (s.selectedClusterId === clusterId ? s : { ...s, selectedClusterId: clusterId }));
  }, []);

  const toggleOverlay = useCallback((overlay: "hulls" | "topology" | "queryRays") => {
    setState((s) => ({
      ...s,
      overlayVisibility: {
        ...s.overlayVisibility,
        [overlay]: !s.overlayVisibility[overlay],
      },
    }));
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
    setState((s) => ({
      ...s,
      projectionSearchResults: null,
      projectionSearchError: null,
    }));
    loadProjectionWithOptions(sampleSizeRef.current, dimensionsRef.current, {
      forceRefresh: true,
    });
  }, [loadProjectionWithOptions]);

  return {
    ...state,
    setSampleSize,
    setMode,
    setColorField,
    setProjectionSearchText,
    setProjectionSearchSource,
    setProjectionSearchDocType,
    setProjectionSearchClusterId,
    runProjectionSearch,
    clearProjectionSearch,
    setQueryText,
    runQuery,
    setDimensions,
    setExpanded,
    setSelectedCluster,
    selectPoint,
    setHoveredPoint,
    toggleOverlay,
    toggleCluster,
    toggleQaLayer,
    refresh,
  };
}
