import { useState, useCallback, useMemo, useEffect } from "react";
import { Activity, Globe, Map as MapIcon, RefreshCw, Maximize2, Minimize2 } from "lucide-react";
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
import { BoundaryExplorerPanel } from "../components/BoundaryExplorerPanel";
import { RegionDetail } from "../components/RegionDetail";
import { useMapViewport } from "../hooks/useMapViewport";
import { useActiveMapLayers } from "../hooks/useActiveMapLayers";
import { useBoundaryMapLayer } from "../hooks/useBoundaryMapLayer";
import { useBoundaries, useBoundaryDetail, useCountries, useGisStats } from "../hooks/useGis";
import { HelpButton } from "@/features/help";
import { useTranslation } from "react-i18next";
import { getAnalysisLayerCountLabel } from "../lib/i18n";
import type { AdminLevel, BoundaryFeature } from "../types";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const ADMIN_LEVEL_ORDER: AdminLevel[] = ["ADM0", "ADM1", "ADM2", "ADM3"];
type MapMode = "analysis" | "boundaries";

function getNextLevel(level: AdminLevel): AdminLevel | null {
  const index = ADMIN_LEVEL_ORDER.indexOf(level);
  return index >= 0 ? ADMIN_LEVEL_ORDER[index + 1] ?? null : null;
}

export default function GisPage() {
  const { t } = useTranslation("app");
  const { viewport, onViewportChange, resetViewport } = useMapViewport();
  const { activeLayers, selectedFips, setSelectedRegion } = useLayerStore();
  const layers = getLayers();

  // Disease selection
  const [selectedConceptId, setSelectedConceptId] = useState<number | null>(null);
  const [selectedDiseaseName, setSelectedDiseaseName] = useState<string | null>(null);
  const [cdmMetric] = useState("cases");
  const [isExpanded, setIsExpanded] = useState(false);
  const [mapMode, setMapMode] = useState<MapMode>("analysis");
  const [boundaryLevel, setBoundaryLevel] = useState<AdminLevel>("ADM0");
  const [boundaryCountryCode, setBoundaryCountryCode] = useState("");
  const [boundaryParentGid, setBoundaryParentGid] = useState<string | null>(null);
  const [selectedBoundaryId, setSelectedBoundaryId] = useState<number | null>(null);

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
  const analysisDeckLayers = useActiveMapLayers({
    conceptId: selectedConceptId,
    selectedFips,
    enabled: mapMode === "analysis",
    onRegionClick: handleRegionClick,
    onRegionHover: handleRegionHover,
  });

  const boundaryQueryEnabled =
    mapMode === "boundaries" &&
    (boundaryLevel === "ADM0" ||
      boundaryLevel === "ADM1" ||
      (boundaryLevel === "ADM2" && (boundaryCountryCode !== "" || boundaryParentGid !== null)) ||
      (boundaryLevel === "ADM3" && boundaryParentGid !== null));

  const boundaryQueryParams = useMemo(
    () => ({
      level: boundaryLevel,
      country_code: boundaryParentGid ? undefined : boundaryCountryCode || undefined,
      parent_gid: boundaryParentGid ?? undefined,
      simplify: boundaryLevel === "ADM0" ? 0.05 : boundaryLevel === "ADM1" ? 0.03 : 0.02,
      enabled: boundaryQueryEnabled,
    }),
    [boundaryCountryCode, boundaryLevel, boundaryParentGid, boundaryQueryEnabled]
  );

  const { data: gisStats } = useGisStats();
  const { data: countries } = useCountries();
  const boundaries = useBoundaries(boundaryQueryParams);
  const boundaryDetail = useBoundaryDetail(selectedBoundaryId);

  const handleBoundaryClick = useCallback((feature: BoundaryFeature) => {
    setSelectedBoundaryId(feature.id);
  }, []);

  const boundaryLayer = useBoundaryMapLayer({
    collection: boundaries.data,
    selectedBoundaryId,
    visible: mapMode === "boundaries" && boundaryQueryEnabled,
    onBoundaryClick: handleBoundaryClick,
  });

  const deckLayers = mapMode === "boundaries"
    ? [boundaryLayer].filter(Boolean)
    : analysisDeckLayers;

  const handleBoundaryLevelChange = useCallback((level: AdminLevel) => {
    setBoundaryLevel(level);
    setBoundaryParentGid(null);
    setSelectedBoundaryId(null);
  }, []);

  const handleBoundaryCountryChange = useCallback((countryCode: string) => {
    setBoundaryCountryCode(countryCode);
    setBoundaryParentGid(null);
    setSelectedBoundaryId(null);
  }, []);

  const handleBoundaryParentClear = useCallback(() => {
    setBoundaryParentGid(null);
    setSelectedBoundaryId(null);
  }, []);

  const handleBoundaryDrillDown = useCallback((gid: string) => {
    const nextLevel = getNextLevel(boundaryDetail.data?.level as AdminLevel);
    if (!nextLevel) return;
    setBoundaryLevel(nextLevel);
    setBoundaryParentGid(gid);
    setBoundaryCountryCode(boundaryDetail.data?.country_code ?? boundaryCountryCode);
    setSelectedBoundaryId(null);
  }, [boundaryCountryCode, boundaryDetail.data]);

  const pageSubtitle = mapMode === "boundaries"
    ? boundaryQueryEnabled
      ? t("gis.page.boundariesReady", { count: boundaries.data?.features.length ?? 0 })
      : t("gis.page.boundariesGuardrail")
    : hasActiveLayers
      ? getAnalysisLayerCountLabel(t, activeLayerList.length)
      : selectedDiseaseName
        ? t("gis.page.enableLayers")
        : t("gis.page.selectDisease");

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
              {t("gis.page.title")}
              {mapMode === "analysis" && selectedDiseaseName ? ` - ${selectedDiseaseName}` : ""}
            </h1>
            <p className="text-xs text-text-ghost">
              {pageSubtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex overflow-hidden rounded border border-border-default bg-surface-raised">
            <button
              type="button"
              onClick={() => setMapMode("analysis")}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-xs ${
                mapMode === "analysis"
                  ? "bg-accent/15 text-accent"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              <Activity className="h-3 w-3" />
              {t("gis.page.modes.analysis")}
            </button>
            <button
              type="button"
              onClick={() => setMapMode("boundaries")}
              className={`flex items-center gap-1.5 border-l border-border-default px-2.5 py-1 text-xs ${
                mapMode === "boundaries"
                  ? "bg-accent/15 text-accent"
                  : "text-text-muted hover:text-text-primary"
              }`}
            >
              <MapIcon className="h-3 w-3" />
              {t("gis.page.modes.boundaries")}
            </button>
          </div>
          <button
            onClick={resetViewport}
            className="flex items-center gap-1.5 rounded border border-border-default bg-surface-base px-2 py-1 text-xs text-text-muted hover:border-text-ghost"
          >
            <RefreshCw className="h-3 w-3" />
            {t("gis.page.reset")}
          </button>
          <button
            onClick={() => setIsExpanded((v) => !v)}
            className="flex items-center gap-1.5 rounded bg-surface-elevated px-2 py-1 text-xs text-accent hover:bg-surface-elevated/80"
          >
            {isExpanded ? (
              <>
                <Minimize2 className="h-3 w-3" />
                {t("gis.page.collapse")}
              </>
            ) : (
              <>
                <Maximize2 className="h-3 w-3" />
                {t("gis.page.expand")}
              </>
            )}
          </button>
          {!isExpanded && <HelpButton helpKey="gis" />}
        </div>
      </div>

      {/* Disease summary bar */}
      {mapMode === "analysis" && selectedConceptId && !isExpanded && (
        <div className="border-b border-border-default bg-surface-base px-6 py-2">
          <DiseaseSummaryBar conceptId={selectedConceptId} />
        </div>
      )}

      {/* Single 3-panel layout with one DeckGL instance */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Layer controls */}
        {mapMode === "boundaries" ? (
          <BoundaryExplorerPanel
            stats={gisStats}
            countries={countries}
            level={boundaryLevel}
            countryCode={boundaryCountryCode}
            parentGid={boundaryParentGid}
            featureCount={boundaries.data?.features.length ?? 0}
            canLoad={boundaryQueryEnabled}
            isLoading={boundaries.isLoading}
            isError={boundaries.isError}
            onLevelChange={handleBoundaryLevelChange}
            onCountryChange={handleBoundaryCountryChange}
            onClearParent={handleBoundaryParentClear}
          />
        ) : (
          <LayerPanel
            selectedConceptId={selectedConceptId}
            onDiseaseSelect={handleDiseaseSelect}
          />
        )}

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
            {mapMode === "analysis" && <CompositeLegend />}
          </div>

          {/* Bottom: Analysis drawer */}
          {mapMode === "analysis" && selectedConceptId && hasActiveLayers && (
            <AnalysisDrawer conceptId={selectedConceptId} metric={cdmMetric} />
          )}
        </div>

        {/* Right: Context panel */}
        {mapMode === "analysis" && selectedConceptId && selectedDiseaseName && (
          <ContextPanel
            conceptId={selectedConceptId}
            diseaseName={selectedDiseaseName}
          />
        )}
        {mapMode === "boundaries" && (
          <div className="flex w-72 flex-col gap-3 overflow-y-auto border-l border-border-default bg-surface-base p-3">
            <RegionDetail
              detail={boundaryDetail.data ?? null}
              loading={boundaryDetail.isLoading}
              onClose={() => setSelectedBoundaryId(null)}
              onDrillDown={handleBoundaryDrillDown}
            />
            {!selectedBoundaryId && (
              <div className="rounded-lg border border-border-default bg-surface-raised p-3 text-center">
                <p className="text-xs text-text-ghost">
                  {boundaryQueryEnabled
                    ? t("gis.boundaryExplorer.clickBoundary")
                    : t("gis.boundaryExplorer.guardrail")}
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
