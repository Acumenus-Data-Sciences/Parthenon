import { useMemo } from "react";
import { GeoJsonLayer } from "@deck.gl/layers";
import type { LayerMapProps } from "../types";

function burdenToColor(value: number): [number, number, number, number] {
  const t = Math.min(value / 3, 1);
  return [
    Math.round(60 + t * 185),
    Math.round(60 + t * 98),
    Math.round(70 - t * 59),
    Math.round(80 + t * 175),
  ];
}

export function ComorbidityMapOverlay({ data, selectedFips, onRegionClick, onRegionHover, visible }: LayerMapProps) {
  const layer = useMemo(() => {
    if (!data.length || !visible) return null;

    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: data.filter((d) => d.geometry).map((d) => ({
        type: "Feature" as const,
        geometry: d.geometry!,
        properties: { fips: d.fips, name: d.location_name, value: d.value },
      })),
    };

    return new GeoJsonLayer({
      id: "comorbidity-choropleth",
      data: geojson,
      pickable: true,
      stroked: true,
      filled: true,
      getFillColor: (f: unknown) => {
        const feat = f as { properties: { value: number } };
        return burdenToColor(feat.properties.value);
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
