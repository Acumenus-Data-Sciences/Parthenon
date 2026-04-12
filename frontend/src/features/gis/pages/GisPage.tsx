import { useState, useCallback, useMemo, useEffect } from "react";
import { Globe, RefreshCw, Maximize2, Minimize2 } from "lucide-react";
import DeckGL from "@deck.gl/react";
import { Map } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import "../layers/init"; // triggers all layer registrations (separate from registry to avoid circular deps)
import { getLayers } from "../layers/registry";
import { useLayerStore } from "../stores/layerStore";
import { LayerPanel } from "../components/LayerPanel";
import { ContextPanel } from "../components/ContextPanel";
import { AnalysisDrawer } from "../components/AnalysisDrawer";
import { CompositeLegend } from "../components/CompositeLegend";
import { DiseaseSummaryBar } from "../components/DiseaseSummaryBar";
import { useMapViewport } from "../hooks/useMapViewport";
import { useActiveMapLayers } from "../hooks/useActiveMapLayers";
import { HelpButton } from "@/features/help";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export default function GisPage() {
  const { viewport, onViewportChange, resetViewport } = useMapViewport();
  const { activeLayers, selectedFips, setSelectedRegion } = useLayerStore();
  const layers = getLayers();

  // Disease selection
  const [selectedConceptId, setSelectedConceptId] = useState<number | null>(null);
  const [selectedDiseaseName, setSelectedDiseaseName] = useState<string | null>(null);
  const [cdmMetric] = useState("cases");
  const [isExpanded, setIsExpanded] = useState(false);

  // Suppress deck.gl v9 ResizeObserver race condition (maxTextureDimension2D)
  // This is a known timing bug where ResizeObserver fires before GPU device init
  useEffect(() => {
    const origError = window.onerror;
    window.onerror = (msg, _src, _line, _col, err) => {
      if (err instanceof TypeError && String(msg).includes("maxTextureDimension2D")) {
        return true; // swallow — harmless race condition
      }
      return origError ? origError(msg as string, _src, _line, _col, err) : false;
    };
    return () => { window.onerror = origError; };
  }, []);

  const handleDiseaseSelect = useCallback((conceptId: number, name: string) => {
    setSelectedConceptId(conceptId);
    setSelectedDiseaseName(name);
    setSelectedRegion(null, null);
  }, [setSelectedRegion]);

  const handleRegionClick = useCallback(
    (fips: string, name: string) => {
      setSelectedRegion(fips, name);
    },
    [setSelectedRegion]
  );

  const handleRegionHover = useCallback(
    (_fips: string | null, _name: string | null) => {
      // Future: tooltip aggregation
    },
    []
  );

  // Collect active use-case layers (for UI state)
  const activeLayerList = useMemo(
    () => layers.filter((l) => activeLayers.has(l.id)),
    [layers, activeLayers]
  );

  const hasActiveLayers = activeLayerList.length > 0;

  // Build deck.gl Layer objects from active map overlays
  const deckLayers = useActiveMapLayers({
    conceptId: selectedConceptId,
    selectedFips,
    onRegionClick: handleRegionClick,
    onRegionHover: handleRegionHover,
  });

  // Fullscreen uses fixed positioning over everything — single DeckGL instance, no remount
  const containerClass = isExpanded
    ? "fixed inset-0 flex flex-col bg-surface-darkest"
    : "flex h-[calc(100vh-4rem)] flex-col";

  return (
    <div className={containerClass} style={isExpanded ? { zIndex: 200 } : undefined}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border-default bg-surface-base px-6 py-3">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-accent" />
          <div>
            <h1 className="text-lg font-semibold text-text-primary">
              GIS Explorer{selectedDiseaseName ? ` — ${selectedDiseaseName}` : ""}
            </h1>
            <p className="text-xs text-text-ghost">
              {hasActiveLayers
                ? `${activeLayerList.length} analysis layer${activeLayerList.length !== 1 ? "s" : ""} active`
                : selectedDiseaseName
                  ? "Enable analysis layers in the left panel"
                  : "Select a disease to begin spatial analysis"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={resetViewport}
            className="flex items-center gap-1.5 rounded border border-border-default bg-surface-base px-2 py-1 text-xs text-text-muted hover:border-text-ghost"
          >
            <RefreshCw className="h-3 w-3" />
            Reset
          </button>
          <button
            onClick={() => setIsExpanded((v) => !v)}
            className="flex items-center gap-1.5 rounded bg-surface-elevated px-2 py-1 text-xs text-accent hover:bg-surface-elevated/80"
          >
            {isExpanded ? (
              <>
                <Minimize2 className="h-3 w-3" />
                Collapse
              </>
            ) : (
              <>
                <Maximize2 className="h-3 w-3" />
                Expand
              </>
            )}
          </button>
          {!isExpanded && <HelpButton helpKey="gis" />}
        </div>
      </div>

      {/* Disease summary bar */}
      {selectedConceptId && !isExpanded && (
        <div className="border-b border-border-default bg-surface-base px-6 py-2">
          <DiseaseSummaryBar conceptId={selectedConceptId} />
        </div>
      )}

      {/* Single 3-panel layout with one DeckGL instance */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Layer controls */}
        <LayerPanel
          selectedConceptId={selectedConceptId}
          onDiseaseSelect={handleDiseaseSelect}
        />

        {/* Center: Map + drawer */}
        <div className="flex flex-1 flex-col">
          <div className="relative flex-1">
            <DeckGL
              viewState={viewport}
              onViewStateChange={(params) =>
                onViewportChange({ viewState: (params as { viewState: typeof viewport }).viewState })}
              layers={deckLayers}
              controller
              getCursor={({ isHovering }: { isHovering: boolean }) =>
                isHovering ? "pointer" : "grab"
              }
            >
              <Map mapStyle={MAP_STYLE} />
            </DeckGL>

            {/* Composite legend overlay */}
            <CompositeLegend />
          </div>

          {/* Bottom: Analysis drawer */}
          {selectedConceptId && hasActiveLayers && (
            <AnalysisDrawer conceptId={selectedConceptId} metric={cdmMetric} />
          )}
        </div>

        {/* Right: Context panel */}
        {selectedConceptId && selectedDiseaseName && (
          <ContextPanel
            conceptId={selectedConceptId}
            diseaseName={selectedDiseaseName}
          />
        )}
      </div>
    </div>
  );
}
