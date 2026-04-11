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
  color: "var(--critical)",
  icon: Shield,
  mapOverlay: SviMapOverlay as unknown as GisLayer["mapOverlay"],
  legendItems: [
    { label: "Low vulnerability", color: "color-mix(in srgb, var(--critical) 18%, transparent)", type: "gradient" },
    { label: "High vulnerability", color: "var(--critical)", type: "gradient" },
  ],
  getTooltipData: (feature): TooltipEntry[] => [
    {
      layerId: "svi",
      label: "SVI",
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
