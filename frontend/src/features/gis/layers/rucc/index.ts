import { MapPin } from "lucide-react";
import type { GisLayer, TooltipEntry } from "../types";
import { RuccMapOverlay } from "./RuccMapOverlay";
import { RuccAnalysisPanel } from "./RuccAnalysisPanel";
import { RuccDetailPanel } from "./RuccDetailPanel";
import { useRuccData } from "./useRuccData";
import { registerLayer } from "../registry";

const ruccLayer: GisLayer = {
  id: "rucc",
  name: "gis.layers.rucc.name",
  description: "gis.layers.rucc.description",
  color: "var(--domain-observation)",
  icon: MapPin,
  mapOverlay: RuccMapOverlay as unknown as GisLayer["mapOverlay"],
  legendItems: [
    { label: "gis.layers.rucc.legend.metro", color: "var(--info)", type: "category" },
    { label: "gis.layers.rucc.legend.micropolitan", color: "var(--domain-observation)", type: "category" },
    { label: "gis.layers.rucc.legend.rural", color: "var(--warning)", type: "category" },
  ],
  getTooltipData: (feature): TooltipEntry[] => [
    {
      layerId: "rucc",
      label: "gis.layers.rucc.tooltip.classification",
      value: (feature as { category?: string }).category
        ? `gis.layers.rucc.categories.${(feature as { category?: string }).category}`
        : "—",
      color: "var(--domain-observation)",
    },
  ],
  analysisPanel: RuccAnalysisPanel,
  detailPanel: RuccDetailPanel,
  useLayerData: useRuccData,
};

registerLayer(ruccLayer);

export default ruccLayer;
