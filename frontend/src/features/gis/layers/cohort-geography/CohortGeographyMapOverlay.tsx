import { useMemo } from "react";
import { GeoJsonLayer } from "@deck.gl/layers";
import type { LayerMapProps } from "../types";

function cohortColor(value: number, maxValue: number): [number, number, number, number] {
  const t = maxValue > 0 ? Math.min(Math.sqrt(value / maxValue), 1) : 0;

  return [
    Math.round(8 + t * 20),
    Math.round(118 + t * 98),
    Math.round(148 + t * 87),
    Math.round(55 + t * 190),
  ];
}

export function CohortGeographyMapOverlay({
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
            fips: item.fips,
            name: item.location_name,
            value: item.value,
            suppressed: Boolean(item.suppressed),
          },
        })),
    };

    return new GeoJsonLayer({
      id: "cohort-geography-choropleth",
      data: geojson,
      pickable: true,
      stroked: true,
      filled: true,
      getFillColor: (feature: unknown) => {
        const props = (feature as { properties: { value: number; suppressed: boolean } }).properties;
        if (props.suppressed) return [120, 130, 145, 90];
        return cohortColor(props.value, maxValue);
      },
      getLineColor: (feature: unknown) => {
        const fips = (feature as { properties: { fips: string } }).properties.fips;
        return fips === selectedFips ? [240, 249, 255, 255] : [70, 82, 96, 130];
      },
      getLineWidth: (feature: unknown) => {
        const fips = (feature as { properties: { fips: string } }).properties.fips;
        return fips === selectedFips ? 3 : 1;
      },
      lineWidthMinPixels: 1,
      onClick: (info: { object?: { properties: { fips: string; name: string } } }) => {
        if (info.object) onRegionClick(info.object.properties.fips, info.object.properties.name);
      },
      onHover: (info: { object?: { properties: { fips: string; name: string } } | null }) => {
        if (info.object) onRegionHover(info.object.properties.fips, info.object.properties.name);
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
