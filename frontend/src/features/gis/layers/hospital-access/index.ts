import { Hospital } from "lucide-react";
import type { GisLayer, TooltipEntry } from "../types";
import { HospitalMapOverlay } from "./HospitalMapOverlay";
import { HospitalAnalysisPanel } from "./HospitalAnalysisPanel";
import { HospitalDetailPanel } from "./HospitalDetailPanel";
import { useHospitalData } from "./useHospitalData";
import { registerLayer } from "../registry";

const hospitalLayer: GisLayer = {
  id: "hospital-access",
  name: "Hospital Access",
  description: "CMS hospital proximity",
  color: "#3B82F6",
  icon: Hospital,
  mapOverlay: HospitalMapOverlay as unknown as GisLayer["mapOverlay"],
  legendItems: [
    { label: "Hospital (ED)", color: "#3B82F6", type: "circle" },
    { label: "Hospital (no ED)", color: "#3B82F680", type: "circle" },
  ],
  getTooltipData: (): TooltipEntry[] => [],
  analysisPanel: HospitalAnalysisPanel,
  detailPanel: HospitalDetailPanel,
  useLayerData: useHospitalData,
};

registerLayer(hospitalLayer);
export default hospitalLayer;
