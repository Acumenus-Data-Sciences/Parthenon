import { Wind } from "lucide-react";
import type { GisLayer, TooltipEntry } from "../types";
import { AirQualityMapOverlay } from "./AirQualityMapOverlay";
import { AirQualityAnalysisPanel } from "./AirQualityAnalysisPanel";
import { AirQualityDetailPanel } from "./AirQualityDetailPanel";
import { useAirQualityData } from "./useAirQualityData";
import { registerLayer } from "../registry";

const airQualityLayer: GisLayer = {
  id: "air-quality",
  name: "Air Quality",
  description: "EPA PM2.5 and ozone levels",
  color: "#10B981",
  icon: Wind,
  mapOverlay: AirQualityMapOverlay as unknown as GisLayer["mapOverlay"],
  legendItems: [
    { label: "Good (low PM2.5)", color: "#10B98130", type: "gradient" },
    { label: "Poor (high PM2.5)", color: "#10B981", type: "gradient" },
  ],
  getTooltipData: (feature): TooltipEntry[] => [
    { layerId: "air-quality", label: "PM2.5", value: `${Number(feature.value).toFixed(1)} µg/m³`, color: "#10B981" },
  ],
  analysisPanel: AirQualityAnalysisPanel,
  detailPanel: AirQualityDetailPanel,
  useLayerData: useAirQualityData,
};

registerLayer(airQualityLayer);
export default airQualityLayer;
