import { useMemo } from "react";
import { GeoJsonLayer } from "@deck.gl/layers";
import type { LayerMapProps } from "../types";

const CATEGORY_COLORS: Record<string, [number, number, number, number]> = {
  metro: [59, 130, 246, 180],   // blue
  micro: [139, 92, 246, 180],   // purple
  rural: [245, 158, 11, 180],   // amber
};

export function RuccMapOverlay({ data, selectedFips, onRegionClick, onRegionHover, visible }: LayerMapProps) {
  const layer = useMemo(() => {
    if (!data.length || !visible) return null;

    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: data
        .filter((d) => d.geometry)
        .map((d) => ({
          type: "Feature" as const,
          geometry: d.geometry!,
          properties: { fips: d.fips, name: d.location_name, category: (d as { category?: string }).category ?? "metro" },
        })),
    };

    return new GeoJsonLayer({
      id: "rucc-choropleth",
      data: geojson,
      pickable: true,
      stroked: true,
      filled: true,
      getFillColor: (f: unknown) => {
        const feat = f as { properties: { category: string } };
        return CATEGORY_COLORS[feat.properties.category] ?? [80, 80, 85, 100];
      },
      getLineColor: (f: unknown) => {
        const feat = f as { properties: { fips: string } };
        return feat.properties.fips === selectedFips ? [45, 212, 191, 255] : [80, 80, 85, 100];
      },
      getLineWidth: (f: unknown) => {
        const feat = f as { properties: { fips: string } };
        return feat.properties.fips === selectedFips ? 3 : 1;
      },
      lineWidthMinPixels: 1,
      onClick: (info: { object?: { properties: { fips: string; name: string } } }) => {
        if (info.object) onRegionClick(info.object.properties.fips, info.object.properties.name);
      },
      onHover: (info: { object?: { properties: { fips: string; name: string } } | null }) => {
        if (info.object) onRegionHover(info.object.properties.fips, info.object.properties.name);
        else onRegionHover(null, null);
      },
      updateTriggers: { getLineColor: [selectedFips], getLineWidth: [selectedFips] },
    });
  }, [data, selectedFips, onRegionClick, onRegionHover, visible]);

  return layer;
}
