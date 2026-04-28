import { useMemo } from "react";
import type { Layer } from "@deck.gl/core";
import { GeoJsonLayer } from "@deck.gl/layers";
import type { BoundaryCollection, BoundaryFeature } from "../types";

interface UseBoundaryMapLayerProps {
  collection: BoundaryCollection | null | undefined;
  selectedBoundaryId: number | null;
  visible: boolean;
  onBoundaryClick: (feature: BoundaryFeature) => void;
}

export function useBoundaryMapLayer({
  collection,
  selectedBoundaryId,
  visible,
  onBoundaryClick,
}: UseBoundaryMapLayerProps): Layer | null {
  return useMemo(() => {
    if (!visible || !collection || collection.features.length === 0) return null;

    return new GeoJsonLayer({
      id: "gadm-boundaries",
      data: collection,
      pickable: true,
      stroked: true,
      filled: true,
      autoHighlight: true,
      highlightColor: [45, 212, 191, 80],
      getFillColor: (feature: unknown) => {
        const boundary = feature as BoundaryFeature;
        return boundary.id === selectedBoundaryId
          ? [45, 212, 191, 80]
          : [14, 165, 233, 34];
      },
      getLineColor: (feature: unknown) => {
        const boundary = feature as BoundaryFeature;
        return boundary.id === selectedBoundaryId
          ? [245, 245, 245, 230]
          : [125, 211, 252, 150];
      },
      getLineWidth: (feature: unknown) => {
        const boundary = feature as BoundaryFeature;
        return boundary.id === selectedBoundaryId ? 3 : 1;
      },
      lineWidthMinPixels: 1,
      onClick: (info: { object?: BoundaryFeature }) => {
        if (info.object) onBoundaryClick(info.object);
      },
      updateTriggers: {
        getFillColor: [selectedBoundaryId],
        getLineColor: [selectedBoundaryId],
        getLineWidth: [selectedBoundaryId],
      },
    });
  }, [collection, onBoundaryClick, selectedBoundaryId, visible]);
}
