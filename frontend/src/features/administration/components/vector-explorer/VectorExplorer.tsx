import { useMemo, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, Loader2, WifiOff, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Panel } from "@/components/ui";
import { formatDate, formatNumber } from "@/i18n/format";
import type { CollectionOverview, CollectionSummary } from "../../api/chromaStudioApi";
import { useVectorExplorer } from "./useVectorExplorer";
import ThreeScene from "./ThreeScene";
import ModeSelector from "./ModeSelector";
import SampleSlider from "./SampleSlider";
import DimensionToggle from "./DimensionToggle";
import ColorLegend from "./ColorLegend";
import ClusterProfile from "./ClusterProfile";
import PointInspector from "./PointInspector";
import MetadataColorPicker from "./MetadataColorPicker";
import QualitySummary from "./QualitySummary";
import { getAdaptiveSampleSteps, getCollectionTheme } from "./constants";

interface VectorExplorerProps {
  collectionName: string | null;
  overview: CollectionOverview | null;
  collections: CollectionSummary[];
  loadingCollections: boolean;
  onCollectionChange: (collectionName: string) => void;
}

export default function VectorExplorer({
  collectionName,
  overview,
  collections,
  loadingCollections,
  onCollectionChange,
}: VectorExplorerProps) {
  const { t } = useTranslation("app");
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
  function handleQuerySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    explorer.runQuery();
  }

  const allPoints = useMemo(() => projectionData?.points ?? [], [projectionData?.points]);
  const clusters = useMemo(() => projectionData?.clusters ?? [], [projectionData?.clusters]);
  const quality = projectionData?.quality ?? null;
  const stats = projectionData?.stats ?? null;
  const points = allPoints;
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
  const selectedCluster = useMemo(
    () => clusters.find((cluster) => cluster.id === explorer.selectedClusterId) ?? null,
    [clusters, explorer.selectedClusterId],
  );
  const aiServiceTooltip = t("administration.vectorExplorer.tooltips.requiresAiService");
  const sourceLabel = stats?.source === "solr"
    ? t("administration.vectorExplorer.sources.solrCached")
    : stats?.source === "fallback"
      ? t("administration.vectorExplorer.sources.clientFallback")
      : t("administration.vectorExplorer.sources.liveUmap");

  if (isLoading && !projectionData) {
    return (
      <Panel>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: collectionTheme.accent }} />
          <div>
            <p className="text-sm font-medium text-text-secondary">
              {t("administration.vectorExplorer.loading.computingProjection")}
            </p>
            <p className="mt-1 text-xs text-text-ghost">
              {t("administration.vectorExplorer.loading.runningProjection", {
                sample: explorer.sampleSize === 0
                  ? t("administration.vectorExplorer.values.all")
                  : formatNumber(explorer.sampleSize),
              })}
            </p>
          </div>
        </div>
      </Panel>
    );
  }

  if (!projectionData && !isFallback) {
    return (
      <Panel>
        <p className="py-8 text-center text-sm text-text-ghost">
          {t("administration.vectorExplorer.empty.selectCollection")}
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
      overlayVisibility={explorer.overlayVisibility}
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
      <div className="fixed inset-0 flex bg-surface-darkest" style={{ zIndex: 200 }}>
        <div className="flex flex-1 flex-col">
          <div className="flex items-center justify-between border-b border-border-default bg-surface-base px-4 py-2">
            <div className="flex items-center gap-4">
              <h2 className="text-sm font-semibold text-text-primary">
                {t("administration.vectorExplorer.title")}
              </h2>
              <div className="flex items-center gap-2">
                <select
                  value={collectionName ?? ""}
                  onChange={(event) => onCollectionChange(event.target.value)}
                  disabled={loadingCollections}
                  className="rounded border border-border-default bg-surface-raised px-2.5 py-1.5 text-sm text-text-primary outline-none transition focus:border-accent/50 disabled:opacity-50"
                >
                  {loadingCollections
                    ? <option value="">{t("administration.vectorExplorer.values.loadingEllipsis")}</option>
                    : null}
                  {collections.map((collection) => (
                    <option key={collection.name} value={collection.name}>
                      {collection.name} {collection.count != null
                        ? t("administration.vectorExplorer.values.countSuffix", {
                          count: formatNumber(collection.count),
                        })
                        : ""}
                    </option>
                  ))}
                </select>
                {overview && (
                  <span
                    className="rounded px-2 py-0.5 text-xs"
                    style={{ background: collectionTheme.bg, color: collectionTheme.textColor }}
                  >
                    {t("administration.vectorExplorer.values.sampled", {
                      count: formatNumber(stats?.sampled ?? 0),
                    })}
                  </span>
                )}
              </div>
              <ModeSelector
                activeMode={activeMode}
                onChange={explorer.setMode}
                accentColor={collectionTheme.textColor}
                accentBg={collectionTheme.bg}
                disabled={isFallback}
                disabledTooltip={aiServiceTooltip}
              />
            </div>
            <div className="flex items-center gap-3">
              <DimensionToggle
                value={explorer.dimensions}
                onChange={explorer.setDimensions}
                accentColor={collectionTheme.textColor}
                accentBg={collectionTheme.bg}
                disabled={isFallback}
                disabledTooltip={aiServiceTooltip}
              />
              <SampleSlider
                value={explorer.sampleSize}
                steps={sampleSteps}
                onChange={explorer.setSampleSize}
                accentColor={collectionTheme.textColor}
                accentBg={collectionTheme.bg}
              />
              <MetadataColorPicker
                metadataKeys={overview?.metadataKeys ?? []}
                value={explorer.colorField}
                onChange={explorer.setColorField}
              />
              <button
                onClick={() => explorer.setExpanded(false)}
                className="rounded p-1.5 text-text-muted hover:bg-surface-raised hover:text-text-primary"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {activeMode === "qa" && quality && stats && (
            <div className="border-b border-border-default px-4 py-1">
              <QualitySummary
                quality={quality}
                stats={stats}
                qaLayers={explorer.qaLayers}
                onToggle={explorer.toggleQaLayer}
              />
            </div>
          )}

          {activeMode === "query" && (
            <div className="border-b border-border-default px-4 py-3">
              <form onSubmit={handleQuerySubmit} className="flex items-center gap-2">
                <input
                  value={explorer.queryText}
                  onChange={(event) => explorer.setQueryText(event.target.value)}
                  placeholder={t("administration.vectorExplorer.search.placeholder")}
                  className="flex-1 rounded border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50"
                />
                <button
                  type="submit"
                  disabled={explorer.isQueryLoading || explorer.queryText.trim().length === 0}
                  className="rounded px-3 py-2 text-sm font-medium disabled:opacity-40"
                  style={{ background: collectionTheme.bg, color: collectionTheme.textColor }}
                >
                  {explorer.isQueryLoading
                    ? t("administration.vectorExplorer.search.searching")
                    : t("administration.vectorExplorer.search.search")}
                </button>
              </form>
              <div className="mt-2 flex items-center justify-between text-xs">
                <span className="text-text-ghost">
                  {t("administration.vectorExplorer.search.visibleResults", {
                    visible: formatNumber(visibleQueryCount),
                    total: formatNumber(explorer.queryResults?.items.length ?? 0),
                  })}
                </span>
                {explorer.queryError && (
                  <span className="text-critical">{explorer.queryError}</span>
                )}
              </div>
            </div>
          )}

          <div className="flex-1">
            {sceneContent}
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 border-t border-border-default bg-surface-base px-4 py-1">
              <Loader2 className="h-3 w-3 animate-spin" style={{ color: collectionTheme.accent }} />
              <span className="text-xs text-text-ghost">
                {t("administration.vectorExplorer.loading.recomputingProjection")}
              </span>
            </div>
          )}
        </div>

        <div className="w-72 space-y-4 overflow-y-auto border-l border-border-default bg-surface-base p-4">
          {error && (
            <div className="flex items-center gap-2 rounded border border-critical/30 bg-critical/10 px-3 py-2">
              <WifiOff className="h-4 w-4 text-critical" />
              <span className="text-xs text-critical">{error}</span>
            </div>
          )}

          <ColorLegend
            mode={activeMode}
            clusters={clusters}
            quality={quality}
            collectionTheme={collectionTheme}
            clusterVisibility={explorer.clusterVisibility}
            selectedClusterId={explorer.selectedClusterId}
            onSelectCluster={explorer.setSelectedCluster}
            onToggleCluster={explorer.toggleCluster}
            totalSampled={stats?.sampled ?? 0}
          />

          <div className="space-y-1 border-t border-border-default pt-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              {t("administration.vectorExplorer.sections.overlays")}
            </h4>
            {[
              {
                key: "hulls" as const,
                labelKey: "clusterHulls",
                helpKey: "clusterHulls",
                enabled: activeMode === "clusters",
              },
              {
                key: "topology" as const,
                labelKey: "topologyLines",
                helpKey: "topologyLines",
                enabled: activeMode === "clusters",
              },
              {
                key: "queryRays" as const,
                labelKey: "queryRays",
                helpKey: "queryRays",
                enabled: activeMode === "query",
              },
            ].map((item) => {
              const active = explorer.overlayVisibility[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => item.enabled && explorer.toggleOverlay(item.key)}
                  disabled={!item.enabled}
                  className={`flex w-full items-center justify-between rounded border px-2 py-2 text-left transition-colors ${
                    item.enabled
                      ? "border-border-default bg-surface-base hover:bg-surface-raised"
                      : "cursor-not-allowed border-border-default/60 bg-surface-base opacity-50"
                  }`}
                >
                  <div className="min-w-0">
                    <div className="text-sm text-text-secondary">
                      {t(`administration.vectorExplorer.overlays.${item.labelKey}.label`)}
                    </div>
                    <div className="text-xs text-text-ghost">
                      {t(`administration.vectorExplorer.overlays.${item.helpKey}.help`)}
                    </div>
                  </div>
                  <div
                    className={`relative h-5 w-9 rounded-full border transition-colors ${
                      active ? "border-transparent" : "border-text-disabled bg-surface-raised"
                    }`}
                    style={
                      active
                        ? { background: collectionTheme.bg }
                        : undefined
                    }
                  >
                    <span
                      className="absolute top-0.5 h-3.5 w-3.5 rounded-full transition-all"
                      style={{
                        left: active ? "18px" : "2px",
                        background: active ? collectionTheme.textColor : "var(--text-muted)",
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {activeMode === "clusters" && (
            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
                {t("administration.vectorExplorer.sections.clusterProfile")}
              </h4>
              <ClusterProfile
                cluster={selectedCluster}
                accentColor={collectionTheme.textColor}
              />
            </div>
          )}

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-muted">
              {t("administration.vectorExplorer.sections.inspector")}
            </h4>
            <PointInspector
              points={inspectorPoints}
              selectedIds={explorer.selectedPoints}
              accentColor={collectionTheme.textColor}
              outlierIds={outlierIds}
              duplicateIds={duplicateIds}
              orphanIds={orphanIds}
              loadingIds={explorer.pointDetailsLoadingIds}
              error={explorer.pointDetailsError}
            />
          </div>

          {stats && (
            <div className="space-y-1 border-t border-border-default pt-3">
              <div className="flex justify-between text-xs">
                <span className="text-text-ghost">
                  {t("administration.vectorExplorer.stats.totalVectors")}
                </span>
                <span className="font-['IBM_Plex_Mono',monospace] text-text-muted">
                  {formatNumber(stats.total_vectors)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-ghost">
                  {t("administration.vectorExplorer.stats.sampled")}
                </span>
                <span className="font-['IBM_Plex_Mono',monospace] text-text-muted">
                  {formatNumber(stats.sampled)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-text-ghost">
                  {t("administration.vectorExplorer.stats.projection")}
                </span>
                <span className="font-['IBM_Plex_Mono',monospace] text-text-muted">
                  {t("administration.vectorExplorer.values.dimensions", {
                    dimensions: explorer.dimensions,
                  })}
                </span>
              </div>
              {stats.knn_neighbors ? (
                <div className="flex justify-between text-xs">
                  <span className="text-text-ghost">
                    {t("administration.vectorExplorer.stats.knnGraph")}
                  </span>
                  <span className="font-['IBM_Plex_Mono',monospace] text-text-muted">
                    {t("administration.vectorExplorer.values.knnEdges", {
                      neighbors: stats.knn_neighbors,
                      edges: formatNumber(edgeCount),
                    })}
                  </span>
                </div>
              ) : null}
              <div className="flex justify-between text-xs">
                <span className="text-text-ghost">
                  {t("administration.vectorExplorer.stats.source")}
                </span>
                <span className="font-['IBM_Plex_Mono',monospace] text-text-muted">
                  {sourceLabel}
                </span>
              </div>
              {stats.source !== "solr" && stats.source !== "fallback" && (
                <div className="flex justify-between text-xs">
                  <span className="text-text-ghost">
                    {t("administration.vectorExplorer.stats.projectionTime")}
                  </span>
                  <span className="font-['IBM_Plex_Mono',monospace] text-text-muted">
                    {t("administration.vectorExplorer.values.seconds", {
                      seconds: (stats.projection_time_ms / 1000).toFixed(1),
                    })}
                  </span>
                </div>
              )}
              {stats.indexed_at && (
                <div className="flex justify-between text-xs">
                  <span className="text-text-ghost">
                    {t("administration.vectorExplorer.stats.indexed")}
                  </span>
                  <span className="font-['IBM_Plex_Mono',monospace] text-text-muted">
                    {formatDate(stats.indexed_at)}
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
        <h3 className="text-base font-semibold text-text-primary">
          {t("administration.vectorExplorer.semanticMapTitle", {
            dimensions: explorer.dimensions,
          })}
        </h3>
        <div className="flex items-center gap-2">
          {stats && (
            <span className="text-xs text-text-ghost">
              {t("administration.vectorExplorer.values.points", {
                count: formatNumber(stats.sampled),
              })}
              {stats.source === "solr"
                ? t("administration.vectorExplorer.values.cachedSuffix")
                : stats.source === "fallback"
                  ? t("administration.vectorExplorer.values.fallbackSuffix")
                  : t("administration.vectorExplorer.values.timeSuffix", {
                    seconds: (stats.projection_time_ms / 1000).toFixed(1),
                  })}
            </span>
          )}
          {isLoading && <Loader2 className="h-3 w-3 animate-spin" style={{ color: collectionTheme.accent }} />}
          <button
            onClick={explorer.refresh}
            disabled={isLoading}
            title={t("administration.vectorExplorer.actions.recomputeProjection")}
            className="rounded p-1 hover:bg-surface-elevated disabled:opacity-40"
            style={{ color: collectionTheme.textColor }}
          >
            <RefreshCw className="h-3 w-3" />
          </button>
          <button
            onClick={() => explorer.setExpanded(true)}
            className="flex items-center gap-1 rounded px-2 py-1 text-xs hover:opacity-85"
            style={{ background: collectionTheme.bg, color: collectionTheme.textColor }}
          >
            <Maximize2 className="h-3 w-3" />
            {t("administration.vectorExplorer.actions.expand")}
          </button>
        </div>
      </div>
      {error && (
        <div className="mb-2 flex items-center gap-2 rounded bg-critical/10 px-2 py-1 text-xs text-critical">
          <WifiOff className="h-3 w-3" />
          {error}
        </div>
      )}
      {activeMode === "query" && (
        <form onSubmit={handleQuerySubmit} className="mb-2 flex items-center gap-2">
          <input
            value={explorer.queryText}
            onChange={(event) => explorer.setQueryText(event.target.value)}
            placeholder={t("administration.vectorExplorer.search.placeholder")}
            className="flex-1 rounded border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary outline-none focus:border-accent/50"
          />
          <button
            type="submit"
            disabled={explorer.isQueryLoading || explorer.queryText.trim().length === 0}
            className="rounded px-3 py-2 text-sm font-medium disabled:opacity-40"
            style={{ background: collectionTheme.bg, color: collectionTheme.textColor }}
          >
            {explorer.isQueryLoading
              ? t("administration.vectorExplorer.search.searching")
              : t("administration.vectorExplorer.search.search")}
          </button>
        </form>
      )}
      {activeMode === "query" && (explorer.queryError || explorer.queryResults) && (
        <div className="mb-2 flex items-center justify-between text-xs text-text-ghost">
          <span>
            {t("administration.vectorExplorer.search.visibleResults", {
              visible: formatNumber(visibleQueryCount),
              total: formatNumber(explorer.queryResults?.items.length ?? 0),
            })}
          </span>
          {explorer.queryError && (
            <span className="text-critical">{explorer.queryError}</span>
          )}
        </div>
      )}
      <div className="h-[500px] rounded-lg border" style={{ borderColor: collectionTheme.border }}>
        {sceneContent}
      </div>
    </Panel>
  );
}
