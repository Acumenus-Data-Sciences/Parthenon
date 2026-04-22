import { Wind } from "lucide-react";
import type { GisLayer, TooltipEntry } from "../types";
import { AirQualityMapOverlay } from "./AirQualityMapOverlay";
import { AirQualityAnalysisPanel } from "./AirQualityAnalysisPanel";
import { AirQualityDetailPanel } from "./AirQualityDetailPanel";
import { useAirQualityData } from "./useAirQualityData";
import { registerLayer } from "../registry";

const airQualityLayer: GisLayer = {
  id: "air-quality",
  name: "gis.layers.airQuality.name" /* i18n-exempt: translation key */,
  description: "gis.layers.airQuality.description" /* i18n-exempt: translation key */,
  color: "var(--success)",
  icon: Wind,
  mapOverlay: AirQualityMapOverlay as unknown as GisLayer["mapOverlay"],
  legendItems: [
    { label: "gis.layers.airQuality.legend.good" /* i18n-exempt: translation key */, color: "#10B98130", type: "gradient" },
    { label: "gis.layers.airQuality.legend.poor" /* i18n-exempt: translation key */, color: "var(--success)", type: "gradient" },
  ],
  getTooltipData: (feature): TooltipEntry[] => [
    { layerId: "air-quality", label: "gis.layers.airQuality.tooltip.pm25" /* i18n-exempt: translation key */, value: `${Number(feature.value).toFixed(1)} µg/m³`, color: "var(--success)" },
  ],
  analysisPanel: AirQualityAnalysisPanel,
  detailPanel: AirQualityDetailPanel,
  useLayerData: useAirQualityData,
};

registerLayer(airQualityLayer);
export default airQualityLayer;
