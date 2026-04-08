import { useMemo, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, Loader2, WifiOff, RefreshCw } from "lucide-react";
import { Panel } from "@/components/ui";
import type { CollectionOverview } from "../../api/chromaStudioApi";
import { useVectorExplorer } from "./useVectorExplorer";
import ThreeScene from "./ThreeScene";
import ModeSelector from "./ModeSelector";
import SampleSlider from "./SampleSlider";
import DimensionToggle from "./DimensionToggle";
import ColorLegend from "./ColorLegend";
import PointInspector from "./PointInspector";
import MetadataColorPicker from "./MetadataColorPicker";
import QualitySummary from "./QualitySummary";
import { getAdaptiveSampleSteps, getCollectionTheme } from "./constants";

interface VectorExplorerProps {
  collectionName: string | null;
  overview: CollectionOverview | null;
}

export default function VectorExplorer({ collectionName, overview }: VectorExplorerProps) {
  const explorer = useVectorExplorer(collectionName, overview?.count);
  const { projectionData, activeMode, isExpanded, isLoading, isFallback, error } = explorer;
  const collectionTheme = useMemo(() => getCollectionTheme(collectionName), [collectionName]);
  const sampleSteps = useMemo(
    () => getAdaptiveSampleSteps(overview?.count ?? 0),
    [overview?.count],
  );

  const outlierIds = useMemo(
    () => new Set(projectionData?.quality.outlier_ids ?? []),
    [projectionData?.quality.outlier_ids],
  );
  const duplicateIds = useMemo(() => {
    const ids = new Set<string>();
    for (const [a, b] of projectionData?.quality.duplicate_pairs ?? []) {
      ids.add(a);
      ids.add(b);
    }
    return ids;
  }, [projectionData?.quality.duplicate_pairs]);
  const orphanIds = useMemo(
    () => new Set(projectionData?.quality.orphan_ids ?? []),
    [projectionData?.quality.orphan_ids],
  );
  const sourceOptions = useMemo(() => {
    const overviewFacet = overview?.facets.find((facet) => facet.key === "source");
    const searchFacet = explorer.projectionSearchResults?.facets.source;
    return Array.from(
      new Set([
        ...(overviewFacet?.values.map((value) => value.label) ?? []),
        ...Object.keys(searchFacet ?? {}),
      ]),
    ).sort();
  }, [overview?.facets, explorer.projectionSearchResults?.facets.source]);
  const docTypeOptions = useMemo(() => {
    const overviewFacet = overview?.facets.find((facet) => facet.key === "type");
    const searchFacet = explorer.projectionSearchResults?.facets.doc_type;
    return Array.from(
      new Set([
        ...(overviewFacet?.values.map((value) => value.label) ?? []),
        ...Object.keys(searchFacet ?? {}),
      ]),
    ).sort();
  }, [overview?.facets, explorer.projectionSearchResults?.facets.doc_type]);

  function handleQuerySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    explorer.runQuery();
  }

  function handleProjectionSearchSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isProjectionSearchAvailable) {
      explorer.clearProjectionSearch();
      return;
    }
    explorer.runProjectionSearch();
  }

  const allPoints = projectionData?.points ?? [];
  const clusters = projectionData?.clusters ?? [];
  const quality = projectionData?.quality ?? null;
  const stats = projectionData?.stats ?? null;
  const isProjectionSearchAvailable = stats?.source === "solr";
  const filteredPointIds = isProjectionSearchAvailable && explorer.projectionSearchResults
    ? new Set(explorer.projectionSearchResults.points.map((point) => point.id))
    : null;
  const points = filteredPointIds
    ? allPoints.filter((point) => filteredPointIds.has(point.id))
    : allPoints;
  const visiblePoints = useMemo(
    () => points.filter((point) => explorer.clusterVisibility.get(point.cluster_id) ?? true),
    [points, explorer.clusterVisibility],
  );
  const visibleQueryCount = useMemo(() => {
    const pointIds = new Set(visiblePoints.map((point) => point.id));
    return (explorer.queryResults?.items ?? []).filter((item) => pointIds.has(item.id)).length;
  }, [visiblePoints, explorer.queryResults?.items]);
  const edgeCount = stats?.num_edges ?? projectionData?.edges.length ?? 0;
  const inspectorPoints = useMemo(
    () =>
      visiblePoints.map((point) => explorer.pointDetailsById[point.id] ?? point),
    [explorer.pointDetailsById, visiblePoints],
  );

  if (isLoading && !projectionData) {
    return (
      <Panel>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: collectionTheme.accent }} />
          <div>
            <p className="text-sm font-medium text-[#C5C0B8]">Computing projection</p>
            <p className="mt-1 text-xs text-[#5A5650]">
              Running PCA→UMAP on {explorer.sampleSize === 0 ? "all" : explorer.sampleSize.toLocaleString()} vectors...
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  if (!projectionData && !isFallback) {
    return (
      <Panel>
        <p className="py-8 text-center text-sm text-[#5A5650]">
          Select a collection to visualize embeddings.
        </p>
      </Panel>
    );
  }

  const sceneContent = (
    <ThreeScene
      points={visiblePoints}
      edges={projectionData?.edges ?? []}
      clusters={clusters}
      activeMode={isFallback ? "clusters" : activeMode}
      collectionTheme={collectionTheme}
      colorField={explorer.colorField}
      hoveredPoint={explorer.hoveredPoint}
      selectedPoints={explorer.selectedPoints}
      clusterVisibility={explorer.clusterVisibility}
      qaLayers={explorer.qaLayers}
      outlierIds={outlierIds}
      duplicateIds={duplicateIds}
      orphanIds={orphanIds}
      queryItems={explorer.queryResults?.items ?? []}
      isExpanded={isExpanded}
      onHover={explorer.setHoveredPoint}
      onSelect={explorer.selectPoint}
    />
  );

  if (isExpanded) {
    return createPortal(
      <div className="fixed inset-0 flex bg-[#0A0A0F]" style={{ zIndex: 200 }}>
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-[#232328] bg-[#0E0E11] px-4 py-2">
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-semibold text-[#F0EDE8]">Vector Explorer</h2>
              {overview && (
                <span
                  className="rounded px-2 py-0.5 text-xs"
                  style={{ background: collectionTheme.bg, color: collectionTheme.text }}
                >
                  {overview.name} ({(stats?.sampled ?? 0).toLocaleString()})
                </span>
              )}
              <ModeSelector
                activeMode={activeMode}
                onChange={explorer.setMode}
                accentColor={collectionTheme.text}
                accentBg={collectionTheme.bg}
                disabled={isFallback}
                disabledTooltip="Requires AI service connection"
              />
            </div>
            <div className="flex items-center gap-3">
              <DimensionToggle
                value={explorer.dimensions}
                onChange={explorer.setDimensions}
                accentColor={collectionTheme.text}
                accentBg={collectionTheme.bg}
                disabled={isFallback}
                disabledTooltip="Requires AI service connection"
              />
              <SampleSlider
                value={explorer.sampleSize}
                steps={sampleSteps}
                onChange={explorer.setSampleSize}
                accentColor={collectionTheme.text}
                accentBg={collectionTheme.bg}
              />
              <MetadataColorPicker
                metadataKeys={overview?.metadataKeys ?? []}
                value={explorer.colorField}
                onChange={explorer.setColorField}
              />
              <button
                onClick={() => explorer.setExpanded(false)}
                className="rounded p-1.5 text-[#8A857D] hover:bg-[#151518] hover:text-[#F0EDE8]"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {activeMode === "qa" && quality && stats && (
            <div className="border-b border-[#232328] px-4 py-1">
              <QualitySummary
                quality={quality}
                stats={stats}
                qaLayers={explorer.qaLayers}
                onToggle={explorer.toggleQaLayer}
              />
            </div>
          )}

          <div className="border-b border-[#232328] px-4 py-3">
            <form onSubmit={handleProjectionSearchSubmit} className="grid gap-2 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,0.8fr))_auto_auto]">
              <input
                value={explorer.projectionSearchText}
                onChange={(event) => explorer.setProjectionSearchText(event.target.value)}
                placeholder="Filter visible points by text"
                disabled={!isProjectionSearchAvailable}
                className="rounded border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#C9A227]/50"
              />
              <select
                value={explorer.projectionSearchSource}
                onChange={(event) => explorer.setProjectionSearchSource(event.target.value)}
                disabled={!isProjectionSearchAvailable}
                className="rounded border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#C9A227]/50"
              >
                <option value="">All sources</option>
                {sourceOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                value={explorer.projectionSearchDocType}
                onChange={(event) => explorer.setProjectionSearchDocType(event.target.value)}
                disabled={!isProjectionSearchAvailable}
                className="rounded border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#C9A227]/50"
              >
                <option value="">All types</option>
                {docTypeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
              <select
                value={explorer.projectionSearchClusterId}
                onChange={(event) => explorer.setProjectionSearchClusterId(event.target.value)}
                disabled={!isProjectionSearchAvailable}
                className="rounded border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#C9A227]/50"
              >
                <option value="">All clusters</option>
                {clusters.map((cluster) => (
                  <option key={cluster.id} value={String(cluster.id)}>
                    {cluster.label}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!isProjectionSearchAvailable || explorer.isProjectionSearchLoading}
                className="rounded px-3 py-2 text-sm font-medium disabled:opacity-40"
                style={{ background: collectionTheme.bg, color: collectionTheme.text }}
              >
                {explorer.isProjectionSearchLoading ? "Filtering..." : "Apply"}
              </button>
              <button
                type="button"
                onClick={explorer.clearProjectionSearch}
                className="rounded border border-[#232328] px-3 py-2 text-sm text-[#8A857D] hover:bg-[#151518] hover:text-[#F0EDE8]"
              >
                Clear
              </button>
            </form>
            {!isProjectionSearchAvailable && (
              <div className="mt-2 text-xs text-[#5A5650]">
                Projection filters are available when viewing the Solr-cached projection.
              </div>
            )}
            {(explorer.projectionSearchResults || explorer.projectionSearchError) && (
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-[#5A5650]">
                  Showing {visiblePoints.length.toLocaleString()} of {(stats?.sampled ?? 0).toLocaleString()} sampled points
                </span>
                {explorer.projectionSearchError && (
                  <span className="text-[#E85A6B]">{explorer.projectionSearchError}</span>
                )}
              </div>
            )}
          </div>

          {activeMode === "query" && (
            <div className="border-b border-[#232328] px-4 py-3">
              <form onSubmit={handleQuerySubmit} className="flex items-center gap-2">
                <input
                  value={explorer.queryText}
                  onChange={(event) => explorer.setQueryText(event.target.value)}
                  placeholder="Search within the vector space"
                  className="flex-1 rounded border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#C9A227]/50"
                />
                <button
                  type="submit"
                  disabled={explorer.isQueryLoading || explorer.queryText.trim().length === 0}
                  className="rounded px-3 py-2 text-sm font-medium disabled:opacity-40"
                  style={{ background: collectionTheme.bg, color: collectionTheme.text }}
                >
                  {explorer.isQueryLoading ? "Searching..." : "Search"}
                </button>
              </form>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-[#5A5650]">
                  {visibleQueryCount} of {(explorer.queryResults?.items.length ?? 0).toLocaleString()} results visible in this projection
                </span>
                {explorer.queryError && (
                  <span className="text-[#E85A6B]">{explorer.queryError}</span>
                )}
              </div>
            </div>
          )}

          <div className="flex-1">
            {sceneContent}
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 border-t border-[#232328] bg-[#0E0E11] px-4 py-1">
              <Loader2 className="h-3 w-3 animate-spin" style={{ color: collectionTheme.accent }} />
              <span className="text-xs text-[#5A5650]">Recomputing projection...</span>
            </div>
          )}
        </div>

        <div className="w-72 space-y-4 overflow-y-auto border-l border-[#232328] bg-[#0E0E11] p-4">
          {error && (
            <div className="flex items-center gap-2 rounded border border-[#E85A6B]/30 bg-[#E85A6B]/10 px-3 py-2">
              <WifiOff className="h-4 w-4 text-[#E85A6B]" />
              <span className="text-xs text-[#E85A6B]">{error}</span>
            </div>
          )}

          <ColorLegend
            mode={activeMode}
            clusters={clusters}
            quality={quality}
            collectionTheme={collectionTheme}
            clusterVisibility={explorer.clusterVisibility}
            onToggleCluster={explorer.toggleCluster}
            totalSampled={stats?.sampled ?? 0}
          />

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
              Inspector
            </h4>
            <PointInspector
              points={inspectorPoints}
              selectedIds={explorer.selectedPoints}
              accentColor={collectionTheme.text}
              outlierIds={outlierIds}
              duplicateIds={duplicateIds}
              orphanIds={orphanIds}
              loadingIds={explorer.pointDetailsLoadingIds}
              error={explorer.pointDetailsError}
            />
          </div>

          {stats && (
            <div className="space-y-1 border-t border-[#232328] pt-3">
              <div className="flex justify-between text-xs">
                <span className="text-[#5A5650]">Total vectors</span>
                <span className="font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
                  {stats.total_vectors.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#5A5650]">Sampled</span>
                <span className="font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
                  {stats.sampled.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-[#5A5650]">Projection</span>
                <span className="font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
                  {explorer.dimensions}D
                </span>
              </div>
              {stats.knn_neighbors ? (
                <div className="flex justify-between text-xs">
                  <span className="text-[#5A5650]">k-NN graph</span>
                  <span className="font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
                    k={stats.knn_neighbors} · {edgeCount.toLocaleString()} edges
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between text-xs">
                <span className="text-[#5A5650]">Source</span>
                <span className="font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
                  {stats.source === "solr"
                    ? "Solr (cached)"
                    : stats.source === "fallback"
                      ? "Client fallback"
                      : "Live UMAP"}
                </span>
              </div>
              {stats.source !== "solr" && stats.source !== "fallback" && (
                <div className="flex justify-between text-xs">
                  <span className="text-[#5A5650]">Projection time</span>
                  <span className="font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
                    {(stats.projection_time_ms / 1000).toFixed(1)}s
                  </span>
                </div>
              )}
              {stats.indexed_at && (
                <div className="flex justify-between text-xs">
                  <span className="text-[#5A5650]">Indexed</span>
                  <span className="font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
                    {new Date(stats.indexed_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>,
      document.body,
    );
  }

  return (
    <Panel>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-base font-semibold text-[#F0EDE8]">
          {explorer.dimensions}D Semantic Map
        </h3>
        <div className="flex items-center gap-2">
          {stats && (
            <span className="text-xs text-[#5A5650]">
              {stats.sampled.toLocaleString()} pts
              {stats.source === "solr"
                ? " · cached"
                : stats.source === "fallback"
                  ? " · fallback"
                  : ` · ${(stats.projection_time_ms / 1000).toFixed(1)}s`}
            </span>
          )}
          {isLoading && <Loader2 className="h-3 w-3 animate-spin" style={{ color: collectionTheme.accent }} />}
          <button
            onClick={explorer.refresh}
            disabled={isLoading}
            title="Re-compute projection"
            className="rounded p-1 hover:bg-[#232328] disabled:opacity-40"
            style={{ color: collectionTheme.text }}
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          <button
            onClick={() => explorer.setExpanded(true)}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:opacity-85"
            style={{ background: collectionTheme.bg, color: collectionTheme.text }}
          >
            <Maximize2 className="h-3 w-3" />
            Expand
          </button>
        </div>
      </div>
      {error && (
        <div className="mb-2 flex items-center gap-2 rounded bg-[#E85A6B]/10 px-2 py-1 text-xs text-[#E85A6B]">
          <WifiOff className="h-3 w-3" />
          {error}
        </div>
      )}
      <form onSubmit={handleProjectionSearchSubmit} className="mb-2 grid gap-2 md:grid-cols-[minmax(0,1.4fr)_repeat(2,minmax(0,0.8fr))_auto_auto]">
        <input
          value={explorer.projectionSearchText}
          onChange={(event) => explorer.setProjectionSearchText(event.target.value)}
          placeholder="Filter visible points by text"
          disabled={!isProjectionSearchAvailable}
          className="rounded border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#C9A227]/50"
        />
        <select
          value={explorer.projectionSearchSource}
          onChange={(event) => explorer.setProjectionSearchSource(event.target.value)}
          disabled={!isProjectionSearchAvailable}
          className="rounded border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#C9A227]/50"
        >
          <option value="">All sources</option>
          {sourceOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          value={explorer.projectionSearchDocType}
          onChange={(event) => explorer.setProjectionSearchDocType(event.target.value)}
          disabled={!isProjectionSearchAvailable}
          className="rounded border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#C9A227]/50"
        >
          <option value="">All types</option>
          {docTypeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          value={explorer.projectionSearchClusterId}
          onChange={(event) => explorer.setProjectionSearchClusterId(event.target.value)}
          disabled={!isProjectionSearchAvailable}
          className="rounded border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#C9A227]/50"
        >
          <option value="">All clusters</option>
          {clusters.map((cluster) => (
            <option key={cluster.id} value={String(cluster.id)}>
              {cluster.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={!isProjectionSearchAvailable || explorer.isProjectionSearchLoading}
          className="rounded px-3 py-2 text-sm font-medium disabled:opacity-40"
          style={{ background: collectionTheme.bg, color: collectionTheme.text }}
        >
          {explorer.isProjectionSearchLoading ? "Filtering..." : "Apply"}
        </button>
        <button
          type="button"
          onClick={explorer.clearProjectionSearch}
          className="rounded border border-[#232328] px-3 py-2 text-sm text-[#8A857D] hover:bg-[#151518] hover:text-[#F0EDE8]"
        >
          Clear
        </button>
      </form>
      {!isProjectionSearchAvailable && (
        <div className="mb-2 text-xs text-[#5A5650]">
          Projection filters are available when viewing the Solr-cached projection.
        </div>
      )}
      {(explorer.projectionSearchResults || explorer.projectionSearchError) && (
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-[#5A5650]">
            Showing {visiblePoints.length.toLocaleString()} of {(stats?.sampled ?? 0).toLocaleString()} sampled points
          </span>
          {explorer.projectionSearchError && (
            <span className="text-[#E85A6B]">{explorer.projectionSearchError}</span>
          )}
        </div>
      )}
      {activeMode === "query" && (
        <form onSubmit={handleQuerySubmit} className="mb-2 flex items-center gap-2">
          <input
            value={explorer.queryText}
            onChange={(event) => explorer.setQueryText(event.target.value)}
            placeholder="Search within the vector space"
            className="flex-1 rounded border border-[#232328] bg-[#151518] px-3 py-2 text-sm text-[#F0EDE8] outline-none focus:border-[#C9A227]/50"
          />
          <button
            type="submit"
            disabled={explorer.isQueryLoading || explorer.queryText.trim().length === 0}
            className="rounded px-3 py-2 text-sm font-medium disabled:opacity-40"
            style={{ background: collectionTheme.bg, color: collectionTheme.text }}
          >
            {explorer.isQueryLoading ? "Searching..." : "Search"}
          </button>
        </form>
      )}
      {activeMode === "query" && (explorer.queryError || explorer.queryResults) && (
        <div className="mb-2 flex items-center justify-between text-xs text-[#5A5650]">
          <span>
            {visibleQueryCount} of {(explorer.queryResults?.items.length ?? 0).toLocaleString()} results visible in this projection
          </span>
          {explorer.queryError && (
            <span className="text-[#E85A6B]">{explorer.queryError}</span>
          )}
        </div>
      )}
      <div className="h-[500px] rounded-lg border" style={{ borderColor: collectionTheme.border }}>
        {sceneContent}
      </div>
    </Panel>
  );
}
