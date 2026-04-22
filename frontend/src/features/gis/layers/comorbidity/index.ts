import { Activity } from "lucide-react";
import type { GisLayer, TooltipEntry } from "../types";
import { ComorbidityMapOverlay } from "./ComorbidityMapOverlay";
import { ComorbidityAnalysisPanel } from "./ComorbidityAnalysisPanel";
import { ComorbidityDetailPanel } from "./ComorbidityDetailPanel";
import { useComorbidityData } from "./useComorbidityData";
import { registerLayer } from "../registry";

const comorbidityLayer: GisLayer = {
  id: "comorbidity",
  name: "gis.layers.comorbidity.name",
  description: "gis.layers.comorbidity.description",
  color: "var(--warning)",
  icon: Activity,
  mapOverlay: ComorbidityMapOverlay as unknown as GisLayer["mapOverlay"],
  legendItems: [
    { label: "gis.layers.comorbidity.legend.low", color: "#F59E0B30", type: "gradient" },
    { label: "gis.layers.comorbidity.legend.high", color: "var(--warning)", type: "gradient" },
  ],
  getTooltipData: (feature): TooltipEntry[] => [
    { layerId: "comorbidity", label: "gis.layers.comorbidity.tooltip.burden", value: Number(feature.value).toFixed(1), color: "var(--warning)" },
  ],
  analysisPanel: ComorbidityAnalysisPanel,
  detailPanel: ComorbidityDetailPanel,
  useLayerData: useComorbidityData,
};

registerLayer(comorbidityLayer);
export default comorbidityLayer;
