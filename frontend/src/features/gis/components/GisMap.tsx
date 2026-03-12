import { useMemo } from "react";
import DeckGL from "@deck.gl/react";
import { GeoJsonLayer } from "@deck.gl/layers";
import { Map } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import type { BoundaryCollection, ChoroplethDataPoint, MapViewport } from "../types";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

interface GisMapProps {
  viewport: MapViewport;
  onViewportChange: (evt: { viewState: MapViewport }) => void;
  boundaries: BoundaryCollection | null;
  choroplethData: ChoroplethDataPoint[] | null;
  selectedRegionId: number | null;
  onRegionClick: (id: number, name: string) => void;
  onRegionHover: (id: number | null, name: string | null) => void;
  loading?: boolean;
}

function valueToColor(value: number, max: number): [number, number, number, number] {
  if (max === 0) return [30, 30, 35, 180];
  const t = Math.min(value / max, 1);

  if (t < 0.5) {
    const s = t * 2;
    return [
      Math.round(30 + s * (155 - 30)),
      Math.round(30 + s * (27 - 30)),
      Math.round(35 + s * (48 - 35)),
      Math.round(80 + s * 120),
    ];
  }
  const s = (t - 0.5) * 2;
  return [
    Math.round(155 + s * (201 - 155)),
    Math.round(27 + s * (162 - 27)),
    Math.round(48 + s * (39 - 48)),
    Math.round(200 + s * 55),
  ];
}

export function GisMap({
  viewport,
  onViewportChange,
  boundaries,
  choroplethData,
  selectedRegionId,
  onRegionClick,
  onRegionHover,
  loading,
}: GisMapProps) {
  const choroplethMap = useMemo(() => {
    if (!choroplethData) return new globalThis.Map<number, number>();
    return new globalThis.Map(choroplethData.map((d) => [d.boundary_id, d.value]));
  }, [choroplethData]);

  const maxValue = useMemo(() => {
    if (!choroplethData?.length) return 0;
    return Math.max(...choroplethData.map((d) => d.value));
  }, [choroplethData]);

  const layers = useMemo(() => {
    if (!boundaries) return [];

    return [
      new GeoJsonLayer({
        id: "boundaries",
        data: boundaries as unknown as GeoJSON.FeatureCollection,
        pickable: true,
        stroked: true,
        filled: true,
        extruded: false,
        lineWidthMinPixels: 1,
        getFillColor: (f: unknown) => {
          const feature = f as { properties: { id: number } };
          const id = feature.properties.id;
          if (id === selectedRegionId) return [45, 212, 191, 180];
          const value = choroplethMap.get(id) ?? 0;
          return valueToColor(value, maxValue);
        },
        getLineColor: (f: unknown) => {
          const feature = f as { properties: { id: number } };
          return feature.properties.id === selectedRegionId
            ? [45, 212, 191, 255]
            : [80, 80, 85, 150];
        },
        getLineWidth: (f: unknown) => {
          const feature = f as { properties: { id: number } };
          return feature.properties.id === selectedRegionId ? 3 : 1;
        },
        onClick: (info: { object?: { properties: { id: number; name: string } } }) => {
          if (info.object) {
            onRegionClick(info.object.properties.id, info.object.properties.name);
          }
        },
        onHover: (info: { object?: { properties: { id: number; name: string } } | null }) => {
          if (info.object) {
            onRegionHover(info.object.properties.id, info.object.properties.name);
          } else {
            onRegionHover(null, null);
          }
        },
        updateTriggers: {
          getFillColor: [choroplethMap, maxValue, selectedRegionId],
          getLineColor: [selectedRegionId],
          getLineWidth: [selectedRegionId],
        },
      }),
    ];
  }, [boundaries, choroplethMap, maxValue, selectedRegionId, onRegionClick, onRegionHover]);

  return (
    <div className="relative h-full w-full">
      <DeckGL
        viewState={viewport}
        onViewStateChange={((params: { viewState: MapViewport }) => onViewportChange({ viewState: params.viewState })) as React.ComponentProps<typeof DeckGL>["onViewStateChange"]}
        layers={layers}
        controller
        getCursor={({ isHovering }: { isHovering: boolean }) =>
          isHovering ? "pointer" : "grab"
        }
      >
        <Map mapStyle={MAP_STYLE} />
      </DeckGL>
      {loading && (
        <div className="absolute left-4 top-4 rounded bg-[#1A1A1F]/90 px-3 py-1.5 text-xs text-[#8A857D]">
          Loading boundaries...
        </div>
      )}
    </div>
  );
}
