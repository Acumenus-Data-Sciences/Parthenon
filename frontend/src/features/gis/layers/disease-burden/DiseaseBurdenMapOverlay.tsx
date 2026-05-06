import { useMemo } from "react";
import { GeoJsonLayer } from "@deck.gl/layers";
import type { LayerMapProps } from "../types";

function burdenToColor(value: number, maxValue: number): [number, number, number, number] {
  const t = maxValue > 0 ? Math.min(Math.log1p(value) / Math.log1p(maxValue), 1) : 0;

  return [
    Math.round(40 + t * 218),
    Math.round(80 + t * 94),
    Math.round(140 - t * 98),
    Math.round(75 + t * 170),
  ];
}

export function DiseaseBurdenMapOverlay({
  data,
  selectedFips,
  onRegionClick,
  onRegionHover,
  visible,
}: LayerMapProps) {
  const layer = useMemo(() => {
    if (!data.length || !visible) return null;

    const maxValue = Math.max(...data.map((item) => Number(item.value) || 0), 0);
    const geojson: GeoJSON.FeatureCollection = {
      type: "FeatureCollection",
      features: data
        .filter((item) => item.geometry)
        .map((item) => ({
          type: "Feature" as const,
          geometry: item.geometry!,
          properties: {
            gid: item.fips,
            name: item.location_name,
            value: item.value,
          },
        })),
    };

    return new GeoJsonLayer({
      id: "disease-burden-choropleth",
      data: geojson,
      pickable: true,
      stroked: true,
      filled: true,
      getFillColor: (feature: unknown) => {
        const value = (feature as { properties: { value: number } }).properties.value;
        return burdenToColor(value, maxValue);
      },
      getLineColor: (feature: unknown) => {
        const gid = (feature as { properties: { gid: string } }).properties.gid;
        return gid === selectedFips ? [45, 212, 191, 255] : [90, 95, 110, 105];
      },
      getLineWidth: (feature: unknown) => {
        const gid = (feature as { properties: { gid: string } }).properties.gid;
        return gid === selectedFips ? 3 : 1;
      },
      lineWidthMinPixels: 1,
      onClick: (info: { object?: { properties: { gid: string; name: string } } }) => {
        if (info.object) onRegionClick(info.object.properties.gid, info.object.properties.name);
      },
      onHover: (info: { object?: { properties: { gid: string; name: string } } | null }) => {
        if (info.object) onRegionHover(info.object.properties.gid, info.object.properties.name);
        else onRegionHover(null, null);
      },
      updateTriggers: {
        getFillColor: [maxValue],
        getLineColor: [selectedFips],
        getLineWidth: [selectedFips],
      },
    });
  }, [data, onRegionClick, onRegionHover, selectedFips, visible]);

  return layer;
}
