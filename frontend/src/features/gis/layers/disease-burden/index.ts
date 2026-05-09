import { Activity } from "lucide-react";
import type { GisLayer, TooltipEntry } from "../types";
import { registerLayer } from "../registry";
import { DiseaseBurdenAnalysisPanel } from "./DiseaseBurdenAnalysisPanel";
import { DiseaseBurdenDetailPanel } from "./DiseaseBurdenDetailPanel";
import { DiseaseBurdenMapOverlay } from "./DiseaseBurdenMapOverlay";
import { useDiseaseBurdenData } from "./useDiseaseBurdenData";
import { tAuto } from "@/i18n/autoUserFacing";

const diseaseBurdenLayer: GisLayer = {
  id: "disease-burden",
  name: "Disease Burden" /* i18n-exempt: GIS layer name */,
  description: "OMOP condition burden by county" /* i18n-exempt: GIS layer description */,
  color: "var(--accent)",
  icon: Activity,
  requiresConcept: true,
  mapOverlay: DiseaseBurdenMapOverlay as unknown as GisLayer["mapOverlay"],
  legendItems: [
    { label: tAuto("low_a124947c"), color: "#28508C50", type: "gradient" },
    { label: tAuto("high_b1a5954a"), color: "var(--accent)", type: "gradient" },
  ],
  getTooltipData: (feature): TooltipEntry[] => [
    {
      layerId: "disease-burden",
      label: tAuto("burden_4903c9ec"),
      value: Number(feature.value).toLocaleString(),
      color: "var(--accent)",
    },
  ],
  analysisPanel: DiseaseBurdenAnalysisPanel,
  detailPanel: DiseaseBurdenDetailPanel,
  useLayerData: useDiseaseBurdenData,
};

registerLayer(diseaseBurdenLayer);

export default diseaseBurdenLayer;
