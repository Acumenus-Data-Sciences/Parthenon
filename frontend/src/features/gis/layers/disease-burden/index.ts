import { Activity } from "lucide-react";
import type { GisLayer, TooltipEntry } from "../types";
import { registerLayer } from "../registry";
import { DiseaseBurdenAnalysisPanel } from "./DiseaseBurdenAnalysisPanel";
import { DiseaseBurdenDetailPanel } from "./DiseaseBurdenDetailPanel";
import { DiseaseBurdenMapOverlay } from "./DiseaseBurdenMapOverlay";
import { useDiseaseBurdenData } from "./useDiseaseBurdenData";

const diseaseBurdenLayer: GisLayer = {
  id: "disease-burden",
  name: "Disease Burden" /* i18n-exempt: GIS layer name */,
  description: "OMOP condition burden by county" /* i18n-exempt: GIS layer description */,
  color: "var(--accent)",
  icon: Activity,
  requiresConcept: true,
  mapOverlay: DiseaseBurdenMapOverlay as unknown as GisLayer["mapOverlay"],
  legendItems: [
    { label: "Low", color: "#28508C50", type: "gradient" },
    { label: "High", color: "var(--accent)", type: "gradient" },
  ],
  getTooltipData: (feature): TooltipEntry[] => [
    {
      layerId: "disease-burden",
      label: "Burden",
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
