import { useState, useCallback } from "react";
import type { MapViewport } from "../types";

const INITIAL_VIEWPORT: MapViewport = {
  longitude: -77.6,
  latitude: 40.9,
  zoom: 7,
  pitch: 0,
  bearing: 0,
};

export function useMapViewport(initial?: Partial<MapViewport>) {
  const [viewport, setViewport] = useState<MapViewport>({
    ...INITIAL_VIEWPORT,
    ...initial,
  });

  const onViewportChange = useCallback(
    (evt: { viewState: MapViewport }) => {
      setViewport(evt.viewState);
    },
    []
  );

  const flyTo = useCallback(
    (target: Partial<MapViewport>) => {
      setViewport((prev) => ({ ...prev, ...target }));
    },
    []
  );

  const resetViewport = useCallback(() => {
    setViewport({ ...INITIAL_VIEWPORT, ...initial });
  }, [initial]);

  const bbox = `${viewport.longitude - 180 / Math.pow(2, viewport.zoom)},${viewport.latitude - 90 / Math.pow(2, viewport.zoom)},${viewport.longitude + 180 / Math.pow(2, viewport.zoom)},${viewport.latitude + 90 / Math.pow(2, viewport.zoom)}`;

  return { viewport, onViewportChange, flyTo, resetViewport, bbox };
}
