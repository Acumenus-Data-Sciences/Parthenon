import { useState, useCallback, useMemo } from "react";
import { Globe, AlertCircle, RefreshCw, Search, FlaskConical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { GisMap } from "../components/GisMap";
import { LayerControls } from "../components/LayerControls";
import { LegendPanel } from "../components/LegendPanel";
import { RegionDetail } from "../components/RegionDetail";
import {
  useGisStats,
  useBoundaries,
  useBoundaryDetail,
  useChoropleth,
  useCountries,
} from "../hooks/useGis";
import { useMapViewport } from "../hooks/useMapViewport";
import type { AdminLevel, ChoroplethMetric, ChoroplethParams } from "../types";
import { HelpButton } from "@/features/help";

export default function GisPage() {
  const navigate = useNavigate();
  const { viewport, onViewportChange, resetViewport } = useMapViewport();

  const [level, setLevel] = useState<AdminLevel>("ADM0");
  const [metric, setMetric] = useState<ChoroplethMetric>("patient_count");
  const [countryCode, setCountryCode] = useState<string | null>(null);
  const [selectedRegionId, setSelectedRegionId] = useState<number | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  const { data: stats, isLoading: statsLoading } = useGisStats();
  const { data: countries } = useCountries();
  const hasBoundaries = (stats?.total_boundaries ?? 0) > 0;

  const {
    data: boundaries,
    isLoading: boundariesLoading,
    error: boundariesError,
  } = useBoundaries({
    level,
    country_code: countryCode ?? undefined,
    simplify: level === "ADM0" ? 0.1 : level === "ADM1" ? 0.01 : 0.001,
    enabled: hasBoundaries,
  });

  const choroplethParams: ChoroplethParams | null = useMemo(
    () =>
      hasBoundaries
        ? { level, metric, country_code: countryCode ?? undefined }
        : null,
    [level, metric, countryCode, hasBoundaries]
  );
  const { data: choroplethData } = useChoropleth(choroplethParams);

  const { data: regionDetail, isLoading: detailLoading } =
    useBoundaryDetail(selectedRegionId);

  const handleRegionClick = useCallback((id: number, _name: string) => {
    setSelectedRegionId(id);
  }, []);

  const handleRegionHover = useCallback(
    (_id: number | null, name: string | null) => {
      setHoveredRegion(name);
    },
    []
  );

  const handleDrillDown = useCallback(
    (_gid: string) => {
      const levels: AdminLevel[] = ["ADM0", "ADM1", "ADM2", "ADM3", "ADM4", "ADM5"];
      const idx = levels.indexOf(level);
      if (idx < levels.length - 1) {
        setLevel(levels[idx + 1]);
        setSelectedRegionId(null);
      }
    },
    [level]
  );

  const maxChoroplethValue = useMemo(() => {
    if (!choroplethData?.length) return 0;
    return Math.max(...choroplethData.map((d) => d.value));
  }, [choroplethData]);

  const isEmpty = !statsLoading && !hasBoundaries;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#232328] bg-[#0E0E11] px-6 py-3">
        <div className="flex items-center gap-3">
          <Globe className="h-5 w-5 text-[#C9A227]" />
          <div>
            <h1 className="text-lg font-semibold text-[#E8E4DC]">
              GIS Explorer
            </h1>
            <p className="text-xs text-[#5A5650]">
              Select geographic regions for epidemiological studies
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hoveredRegion && (
            <span className="text-xs text-[#8A857D]">{hoveredRegion}</span>
          )}
          {stats && !isEmpty && (
            <span className="text-xs text-[#5A5650]">
              {stats.total_boundaries.toLocaleString()} boundaries ·{" "}
              {stats.total_countries} countries
            </span>
          )}
          <HelpButton helpKey="gis" />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="relative flex-1">
          {isEmpty ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 bg-[#0E0E11]">
              <Globe className="h-12 w-12 text-[#5A5650]" />
              <div className="text-center">
                <p className="text-sm text-[#E8E4DC]">
                  No geographic boundaries available
                </p>
                <p className="mt-1 text-xs text-[#5A5650]">
                  An administrator needs to load boundary data from the System Health panel.
                </p>
                <p className="mt-1 text-xs text-[#5A5650]">
                  Go to Administration → System Health → GIS Data to load boundaries.
                </p>
              </div>
            </div>
          ) : (
            <GisMap
              viewport={viewport}
              onViewportChange={onViewportChange}
              boundaries={boundaries ?? null}
              choroplethData={choroplethData ?? null}
              selectedRegionId={selectedRegionId}
              onRegionClick={handleRegionClick}
              onRegionHover={handleRegionHover}
              loading={boundariesLoading}
            />
          )}

          {boundariesError && (
            <div className="absolute bottom-4 left-4 flex items-center gap-2 rounded bg-[#E85A6B]/15 px-3 py-2 text-xs text-[#E85A6B]">
              <AlertCircle className="h-3 w-3" />
              Failed to load boundaries
            </div>
          )}
        </div>

        {/* Right sidebar — research controls */}
        {!isEmpty && (
          <div className="flex w-72 flex-col gap-3 overflow-y-auto border-l border-[#232328] bg-[#0E0E11] p-3">
            <LayerControls
              level={level}
              onLevelChange={(l) => {
                setLevel(l);
                setSelectedRegionId(null);
              }}
              metric={metric}
              onMetricChange={setMetric}
              countryCode={countryCode}
              onCountryChange={setCountryCode}
              countries={countries ?? []}
            />

            <LegendPanel metric={metric} maxValue={maxChoroplethValue} />

            <RegionDetail
              detail={regionDetail ?? null}
              loading={detailLoading}
              onClose={() => setSelectedRegionId(null)}
              onDrillDown={handleDrillDown}
            />

            {/* Research actions for selected region */}
            {regionDetail && (
              <div className="rounded-lg border border-[#232328] bg-[#141418] p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#5A5650]">
                  Research Actions
                </h3>
                <div className="space-y-2">
                  <button
                    onClick={() =>
                      navigate(`/studies/create?region=${regionDetail.gid}&region_name=${encodeURIComponent(regionDetail.name)}`)
                    }
                    className="flex w-full items-center gap-2 rounded border border-[#232328] bg-[#0E0E11] px-3 py-2 text-xs text-[#C9A227] hover:border-[#C9A227]/50"
                  >
                    <FlaskConical className="h-3 w-3" />
                    Create Study for {regionDetail.name}
                  </button>
                  <button
                    onClick={() =>
                      navigate(`/cohort-definitions?region=${regionDetail.gid}`)
                    }
                    className="flex w-full items-center gap-2 rounded border border-[#232328] bg-[#0E0E11] px-3 py-2 text-xs text-[#2DD4BF] hover:border-[#2DD4BF]/50"
                  >
                    <Search className="h-3 w-3" />
                    Browse Cohorts in Region
                  </button>
                </div>
              </div>
            )}

            {stats && (
              <div className="rounded-lg border border-[#232328] bg-[#141418] p-3">
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#5A5650]">
                  Available Data
                </h3>
                <div className="space-y-1">
                  {stats.levels
                    .filter((l) => l.count > 0)
                    .map((l) => (
                      <div
                        key={l.code}
                        className="flex items-center justify-between text-xs"
                      >
                        <span className="text-[#8A857D]">{l.label}</span>
                        <span className="text-[#E8E4DC]">
                          {l.count.toLocaleString()}
                        </span>
                      </div>
                    ))}
                </div>
              </div>
            )}

            <button
              onClick={resetViewport}
              className="flex items-center justify-center gap-1.5 rounded border border-[#232328] bg-[#0E0E11] px-3 py-1.5 text-xs text-[#8A857D] hover:border-[#5A5650]"
            >
              <RefreshCw className="h-3 w-3" />
              Reset View
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
