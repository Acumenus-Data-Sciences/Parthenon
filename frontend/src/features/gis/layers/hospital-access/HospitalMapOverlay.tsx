import { useMemo } from "react";
import { ScatterplotLayer } from "@deck.gl/layers";
import type { LayerMapProps } from "../types";
import type { HospitalPoint } from "./api";

/**
 * Hospital layer uses ScatterplotLayer for point markers rather than GeoJsonLayer.
 * The `data` prop from LayerMapProps is not used — instead, hospital points are
 * passed via the analysisData field from useHospitalData and injected by GisPage.
 *
 * GisPage should pass hospital point data as a separate prop or via a context.
 * For simplicity, we accept hospital data via a custom `hospitals` prop.
 */

interface HospitalMapOverlayProps extends LayerMapProps {
  hospitals?: HospitalPoint[];
}

export function HospitalMapOverlay({ hospitals, visible }: HospitalMapOverlayProps) {
  const layer = useMemo(() => {
    if (!hospitals?.length || !visible) return null;

    return new ScatterplotLayer({
      id: "hospital-points",
      data: hospitals,
      getPosition: (d: HospitalPoint) => [d.longitude, d.latitude],
      getRadius: (d: HospitalPoint) => Math.max(Math.sqrt(d.bed_count) * 50, 500),
      getFillColor: (d: HospitalPoint) => d.has_emergency ? [59, 130, 246, 200] : [59, 130, 246, 100],
      getLineColor: [255, 255, 255, 150],
      lineWidthMinPixels: 1,
      stroked: true,
      pickable: true,
      radiusMinPixels: 3,
      radiusMaxPixels: 20,
    });
  }, [hospitals, visible]);

  return layer;
}
