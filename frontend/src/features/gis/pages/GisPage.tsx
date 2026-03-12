import { useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
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

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#232328] bg-[#0E0E11] px-6 py-3">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-[#C9A227]" />
          <div>
            <h1 className="text-lg font-semibold text-[#E8E4DC]">
              GIS Explorer{selectedDiseaseName ? ` — ${selectedDiseaseName}` : ""}
            </h1>
            <p className="text-xs text-[#5A5650]">
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
            className="flex items-center gap-1.5 rounded border border-[#232328] bg-[#0E0E11] px-2 py-1 text-xs text-[#8A857D] hover:border-[#5A5650]"
          >
            <RefreshCw className="h-3 w-3" />
            Reset
          </button>
          <button
            onClick={() => setIsExpanded(true)}
            className="flex items-center gap-1.5 rounded bg-[#232328] px-2 py-1 text-xs text-[#C9A227] hover:bg-[#232328]/80"
          >
            <Maximize2 className="h-3 w-3" />
            Expand
          </button>
          <HelpButton helpKey="gis" />
        </div>
      </div>

      {/* Disease summary bar */}
      {selectedConceptId && (
        <div className="border-b border-[#232328] bg-[#0E0E11] px-6 py-2">
          <DiseaseSummaryBar conceptId={selectedConceptId} />
        </div>
      )}

      {/* Fullscreen portal */}
      {isExpanded && createPortal(
        <div className="fixed inset-0 flex flex-col bg-[#0A0A0F]" style={{ zIndex: 200 }}>
          {/* Fullscreen header */}
          <div className="flex items-center justify-between border-b border-[#232328] bg-[#0E0E11] px-4 py-2">
            <div className="flex items-center gap-3">
              <Globe className="h-5 w-5 text-[#C9A227]" />
              <h2 className="text-sm font-semibold text-[#F0EDE8]">
                GIS Explorer{selectedDiseaseName ? ` — ${selectedDiseaseName}` : ""}
              </h2>
              {hasActiveLayers && (
                <span className="rounded bg-[#2DD4BF]/10 px-2 py-0.5 text-xs text-[#2DD4BF]">
                  {activeLayerList.length} layer{activeLayerList.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={resetViewport}
                className="flex items-center gap-1.5 rounded border border-[#232328] bg-[#0E0E11] px-2 py-1 text-xs text-[#8A857D] hover:border-[#5A5650]"
              >
                <RefreshCw className="h-3 w-3" />
                Reset
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                className="rounded p-1.5 text-[#8A857D] hover:bg-[#151518] hover:text-[#F0EDE8]"
              >
                <Minimize2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Fullscreen map */}
          <div className="flex flex-1 overflow-hidden">
            <LayerPanel
              selectedConceptId={selectedConceptId}
              onDiseaseSelect={handleDiseaseSelect}
            />
            <div className="flex flex-1 flex-col">
              <div className="relative flex-1">
                <DeckGL
                  viewState={viewport}
                  onViewStateChange={((params: { viewState: typeof viewport }) =>
                    onViewportChange({ viewState: params.viewState })) as React.ComponentProps<typeof DeckGL>["onViewStateChange"]}
                  layers={deckLayers}
                  controller
                  getCursor={({ isHovering }: { isHovering: boolean }) =>
                    isHovering ? "pointer" : "grab"
                  }
                >
                  <Map mapStyle={MAP_STYLE} />
                </DeckGL>
                <CompositeLegend />
              </div>
              {selectedConceptId && hasActiveLayers && (
                <AnalysisDrawer conceptId={selectedConceptId} metric={cdmMetric} />
              )}
            </div>
            {selectedConceptId && selectedDiseaseName && (
              <ContextPanel
                conceptId={selectedConceptId}
                diseaseName={selectedDiseaseName}
              />
            )}
          </div>
        </div>,
        document.body,
      )}

      {/* Main 3-panel layout — unmounted when fullscreen portal is active */}
      {!isExpanded && (
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
                onViewStateChange={((params: { viewState: typeof viewport }) =>
                  onViewportChange({ viewState: params.viewState })) as React.ComponentProps<typeof DeckGL>["onViewStateChange"]}
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
      )}
    </div>
  );
}
