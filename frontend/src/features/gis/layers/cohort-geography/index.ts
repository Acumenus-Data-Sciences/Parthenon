import { UsersRound } from "lucide-react";
import type { GisLayer, TooltipEntry } from "../types";
import { registerLayer } from "../registry";
import { CohortGeographyAnalysisPanel } from "./CohortGeographyAnalysisPanel";
import { CohortGeographyDetailPanel } from "./CohortGeographyDetailPanel";
import { CohortGeographyMapOverlay } from "./CohortGeographyMapOverlay";
import { useCohortGeographyData } from "./useCohortGeographyData";
import { tAuto } from "@/i18n/autoUserFacing";

const cohortGeographyLayer: GisLayer = {
  id: "cohort-geography",
  name: "Cohort Geography" /* i18n-exempt: GIS layer name */,
  description: "Acumenus cohort membership by Pennsylvania geography" /* i18n-exempt: GIS layer description */,
  color: "#06B6D4",
  icon: UsersRound,
  requiresCohortGeography: true,
  mapOverlay: CohortGeographyMapOverlay as unknown as GisLayer["mapOverlay"],
  legendItems: [
    { label: tAuto("low_a124947c"), color: "#08768C40", type: "gradient" },
    { label: tAuto("high_b1a5954a"), color: "#06B6D4", type: "gradient" },
  ],
  getTooltipData: (feature): TooltipEntry[] => [
    {
      layerId: "cohort-geography",
      label: tAuto("cohort_1b02f699"),
      value: Number(feature.value).toLocaleString(),
      color: "#06B6D4",
    },
  ],
  analysisPanel: CohortGeographyAnalysisPanel,
  detailPanel: CohortGeographyDetailPanel,
  useLayerData: useCohortGeographyData,
};

registerLayer(cohortGeographyLayer);

export default cohortGeographyLayer;
