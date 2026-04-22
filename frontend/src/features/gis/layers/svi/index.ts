import { Shield } from "lucide-react";
import type { GisLayer, TooltipEntry } from "../types";
import { SviMapOverlay } from "./SviMapOverlay";
import { SviAnalysisPanel } from "./SviAnalysisPanel";
import { SviDetailPanel } from "./SviDetailPanel";
import { useSviData } from "./useSviData";
import { registerLayer } from "../registry";

const sviLayer: GisLayer = {
  id: "svi",
  name: "gis.layers.svi.name",
  description: "gis.layers.svi.description",
  color: "var(--critical)",
  icon: Shield,
  mapOverlay: SviMapOverlay as unknown as GisLayer["mapOverlay"],
  legendItems: [
    { label: "gis.layers.svi.legend.low", color: "#E85A6B30", type: "gradient" },
    { label: "gis.layers.svi.legend.high", color: "var(--critical)", type: "gradient" },
  ],
  getTooltipData: (feature): TooltipEntry[] => [
    {
      layerId: "svi",
      label: "gis.layers.svi.tooltip.score",
      value: feature.value !== undefined ? `${(Number(feature.value) * 100).toFixed(0)}%` : "—",
      color: "var(--critical)",
    },
  ],
  analysisPanel: SviAnalysisPanel,
  detailPanel: SviDetailPanel,
  useLayerData: useSviData,
};

registerLayer(sviLayer);

export default sviLayer;
