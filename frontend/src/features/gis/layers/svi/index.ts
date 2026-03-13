import { Shield } from "lucide-react";
import type { GisLayer, TooltipEntry } from "../types";
import { SviMapOverlay } from "./SviMapOverlay";
import { SviAnalysisPanel } from "./SviAnalysisPanel";
import { SviDetailPanel } from "./SviDetailPanel";
import { useSviData } from "./useSviData";
import { registerLayer } from "../registry";

const sviLayer: GisLayer = {
  id: "svi",
  name: "Social Vulnerability",
  description: "CDC/ATSDR SVI by census tract",
  color: "#E85A6B",
  icon: Shield,
  mapOverlay: SviMapOverlay as unknown as GisLayer["mapOverlay"],
  legendItems: [
    { label: "Low vulnerability", color: "#E85A6B30", type: "gradient" },
    { label: "High vulnerability", color: "#E85A6B", type: "gradient" },
  ],
  getTooltipData: (feature): TooltipEntry[] => [
    {
      layerId: "svi",
      label: "SVI",
      value: feature.value !== undefined ? `${(Number(feature.value) * 100).toFixed(0)}%` : "—",
      color: "#E85A6B",
    },
  ],
  analysisPanel: SviAnalysisPanel,
  detailPanel: SviDetailPanel,
  useLayerData: useSviData,
};

registerLayer(sviLayer);

export default sviLayer;
