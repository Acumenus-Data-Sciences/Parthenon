import { Hospital } from "lucide-react";
import type { GisLayer, TooltipEntry } from "../types";
import { HospitalMapOverlay } from "./HospitalMapOverlay";
import { HospitalAnalysisPanel } from "./HospitalAnalysisPanel";
import { HospitalDetailPanel } from "./HospitalDetailPanel";
import { useHospitalData } from "./useHospitalData";
import { registerLayer } from "../registry";

const hospitalLayer: GisLayer = {
  id: "hospital-access",
  name: "gis.layers.hospitalAccess.name" /* i18n-exempt: translation key */,
  description: "gis.layers.hospitalAccess.description" /* i18n-exempt: translation key */,
  color: "var(--info)",
  icon: Hospital,
  mapOverlay: HospitalMapOverlay as unknown as GisLayer["mapOverlay"],
  legendItems: [
    { label: "gis.layers.hospitalAccess.legend.withEd" /* i18n-exempt: translation key */, color: "var(--info)", type: "circle" },
    { label: "gis.layers.hospitalAccess.legend.withoutEd" /* i18n-exempt: translation key */, color: "#3B82F680", type: "circle" },
  ],
  getTooltipData: (): TooltipEntry[] => [],
  analysisPanel: HospitalAnalysisPanel,
  detailPanel: HospitalDetailPanel,
  useLayerData: useHospitalData,
};

registerLayer(hospitalLayer);
export default hospitalLayer;
