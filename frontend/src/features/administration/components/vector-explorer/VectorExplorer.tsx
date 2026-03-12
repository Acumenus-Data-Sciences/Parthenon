import { useMemo } from "react";
import { createPortal } from "react-dom";
import { Maximize2, Minimize2, Loader2, WifiOff } from "lucide-react";
import { Panel } from "@/components/ui";
import type { CollectionOverview } from "../../api/chromaStudioApi";
import { useVectorExplorer } from "./useVectorExplorer";
import ThreeScene from "./ThreeScene";
import ModeSelector from "./ModeSelector";
import SampleSlider from "./SampleSlider";
import ColorLegend from "./ColorLegend";
import PointInspector from "./PointInspector";
import MetadataColorPicker from "./MetadataColorPicker";
import QualitySummary from "./QualitySummary";

interface VectorExplorerProps {
  collectionName: string | null;
  overview: CollectionOverview | null;
}

export default function VectorExplorer({ collectionName, overview }: VectorExplorerProps) {
  const explorer = useVectorExplorer(collectionName);
  const { projectionData, activeMode, isExpanded, isLoading, isFallback, error } = explorer;

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

  if (isLoading && !projectionData) {
    return (
      <Panel>
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-[#C9A227]" />
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

  const points = projectionData?.points ?? [];
  const clusters = projectionData?.clusters ?? [];
  const quality = projectionData?.quality ?? null;
  const stats = projectionData?.stats ?? null;

  const sceneContent = (
    <ThreeScene
      points={points}
      clusters={clusters}
      activeMode={isFallback ? "clusters" : activeMode}
      colorField={explorer.colorField}
      hoveredPoint={explorer.hoveredPoint}
      selectedPoints={explorer.selectedPoints}
      clusterVisibility={explorer.clusterVisibility}
      qaLayers={explorer.qaLayers}
      outlierIds={outlierIds}
      duplicateIds={duplicateIds}
      orphanIds={orphanIds}
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
                <span className="rounded bg-[#2DD4BF]/10 px-2 py-0.5 text-xs text-[#2DD4BF]">
                  {overview.name} ({(stats?.sampled ?? 0).toLocaleString()})
                </span>
              )}
              <ModeSelector
                activeMode={activeMode}
                onChange={explorer.setMode}
                disabled={isFallback}
                disabledTooltip="Requires AI service connection"
              />
            </div>
            <div className="flex items-center gap-3">
              <SampleSlider value={explorer.sampleSize} onChange={explorer.setSampleSize} />
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

          <div className="flex-1">
            {sceneContent}
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 border-t border-[#232328] bg-[#0E0E11] px-4 py-1">
              <Loader2 className="h-3 w-3 animate-spin text-[#C9A227]" />
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
            clusterVisibility={explorer.clusterVisibility}
            onToggleCluster={explorer.toggleCluster}
            totalSampled={stats?.sampled ?? 0}
          />

          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#8A857D]">
              Inspector
            </h4>
            <PointInspector
              points={points}
              selectedIds={explorer.selectedPoints}
              outlierIds={outlierIds}
              duplicateIds={duplicateIds}
              orphanIds={orphanIds}
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
                <span className="text-[#5A5650]">Projection time</span>
                <span className="font-['IBM_Plex_Mono',monospace] text-[#8A857D]">
                  {(stats.projection_time_ms / 1000).toFixed(1)}s
                </span>
              </div>
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
        <h3 className="text-base font-semibold text-[#F0EDE8]">3D Semantic Map</h3>
        <div className="flex items-center gap-2">
          {stats && (
            <span className="text-xs text-[#5A5650]">
              {stats.sampled.toLocaleString()} pts · {(stats.projection_time_ms / 1000).toFixed(1)}s
            </span>
          )}
          {isLoading && <Loader2 className="h-3 w-3 animate-spin text-[#C9A227]" />}
          <button
            onClick={() => explorer.setExpanded(true)}
            className="flex items-center gap-1 rounded bg-[#232328] px-2 py-1 text-xs text-[#C9A227] hover:bg-[#232328]/80"
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
      <div className="h-[300px] overflow-hidden rounded-lg border border-[#232328]">
        {sceneContent}
      </div>
    </Panel>
  );
}
