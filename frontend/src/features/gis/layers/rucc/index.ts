import { MapPin } from "lucide-react";
import type { GisLayer, TooltipEntry } from "../types";
import { RuccMapOverlay } from "./RuccMapOverlay";
import { RuccAnalysisPanel } from "./RuccAnalysisPanel";
import { RuccDetailPanel } from "./RuccDetailPanel";
import { useRuccData } from "./useRuccData";
import { registerLayer } from "../registry";

const ruccLayer: GisLayer = {
  id: "rucc",
  name: "Urban-Rural",
  description: "USDA Rural-Urban Continuum Codes",
  color: "#8B5CF6",
  icon: MapPin,
  mapOverlay: RuccMapOverlay as unknown as GisLayer["mapOverlay"],
  legendItems: [
    { label: "Metro", color: 'var(--info)', type: "category" },
    { label: "Micropolitan", color: "#8B5CF6", type: "category" },
    { label: "Rural", color: 'var(--warning)', type: "category" },
  ],
  getTooltipData: (feature): TooltipEntry[] => [
    {
      layerId: "rucc",
      label: "Classification",
      value: String((feature as { category?: string }).category ?? "—"),
      color: "#8B5CF6",
    },
  ],
  analysisPanel: RuccAnalysisPanel,
  detailPanel: RuccDetailPanel,
  useLayerData: useRuccData,
};

registerLayer(ruccLayer);

export default ruccLayer;
