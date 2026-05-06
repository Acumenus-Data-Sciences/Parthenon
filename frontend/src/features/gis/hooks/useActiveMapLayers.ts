import type { Layer } from "@deck.gl/core";
import { useLayerStore } from "../stores/layerStore";
import { SviMapOverlay } from "../layers/svi/SviMapOverlay";
import { RuccMapOverlay } from "../layers/rucc/RuccMapOverlay";
import { ComorbidityMapOverlay } from "../layers/comorbidity/ComorbidityMapOverlay";
import { AirQualityMapOverlay } from "../layers/air-quality/AirQualityMapOverlay";
import { HospitalMapOverlay } from "../layers/hospital-access/HospitalMapOverlay";
import { DiseaseBurdenMapOverlay } from "../layers/disease-burden/DiseaseBurdenMapOverlay";
import { CohortGeographyMapOverlay } from "../layers/cohort-geography/CohortGeographyMapOverlay";
import { useSviData } from "../layers/svi/useSviData";
import { useRuccData } from "../layers/rucc/useRuccData";
import { useComorbidityData } from "../layers/comorbidity/useComorbidityData";
import { useAirQualityData } from "../layers/air-quality/useAirQualityData";
import { useHospitalData } from "../layers/hospital-access/useHospitalData";
import { useDiseaseBurdenData } from "../layers/disease-burden/useDiseaseBurdenData";
import { useCohortGeographyData } from "../layers/cohort-geography/useCohortGeographyData";
import type { CohortGeographySelection } from "../types";

interface UseActiveMapLayersProps {
  conceptId: number | null;
  selectedFips: string | null;
  metric: string;
  cohortGeography?: CohortGeographySelection | null;
  enabled?: boolean;
  onRegionClick: (fips: string, name: string) => void;
  onRegionHover: (fips: string | null, name: string | null) => void;
}

/**
 * Collects all GIS map overlay deck.gl layers for active use-cases.
 *
 * All data hooks are called unconditionally (fixed order — Rules of Hooks).
 * Each overlay receives `visible: false` when its layer is not active,
 * which causes it to return null and skip rendering.
 */
export function useActiveMapLayers({
  conceptId,
  selectedFips,
  metric,
  cohortGeography,
  enabled = true,
  onRegionClick,
  onRegionHover,
}: UseActiveMapLayersProps): Array<Layer | null> {
  const { activeLayers } = useLayerStore();

  const params = { conceptId, selectedFips, metric, cohortGeography };

  // Data hooks — always called (Rules of Hooks)
  const cohortGeographyData = useCohortGeographyData({
    ...params,
    enabled: enabled && activeLayers.has("cohort-geography"),
  });
  const diseaseBurdenData = useDiseaseBurdenData({
    ...params,
    enabled: enabled && activeLayers.has("disease-burden") && conceptId !== null,
  });
  const sviData = useSviData({
    ...params,
    enabled: enabled && activeLayers.has("svi"),
  });
  const ruccData = useRuccData({
    ...params,
    enabled: enabled && activeLayers.has("rucc"),
  });
  const comorbidityData = useComorbidityData({
    ...params,
    enabled: enabled && activeLayers.has("comorbidity"),
  });
  const airQualityData = useAirQualityData({
    ...params,
    enabled: enabled && activeLayers.has("air-quality"),
  });
  const hospitalData = useHospitalData({
    ...params,
    enabled: enabled && activeLayers.has("hospital-access"),
  });

  // Overlay hooks — always called with visible=false when inactive
  const cohortGeographyLayer = CohortGeographyMapOverlay({
    data: cohortGeographyData.choroplethData ?? [],
    selectedFips,
    onRegionClick,
    onRegionHover,
    visible: activeLayers.has("cohort-geography"),
  });

  const diseaseBurdenLayer = DiseaseBurdenMapOverlay({
    data: diseaseBurdenData.choroplethData ?? [],
    selectedFips,
    onRegionClick,
    onRegionHover,
    visible: activeLayers.has("disease-burden"),
  });

  const sviLayer = SviMapOverlay({
    data: sviData.choroplethData ?? [],
    selectedFips,
    onRegionClick,
    onRegionHover,
    visible: activeLayers.has("svi"),
  });

  const ruccLayer = RuccMapOverlay({
    data: ruccData.choroplethData ?? [],
    selectedFips,
    onRegionClick,
    onRegionHover,
    visible: activeLayers.has("rucc"),
  });

  const comorbidityLayer = ComorbidityMapOverlay({
    data: comorbidityData.choroplethData ?? [],
    selectedFips,
    onRegionClick,
    onRegionHover,
    visible: activeLayers.has("comorbidity"),
  });

  const airQualityLayer = AirQualityMapOverlay({
    data: airQualityData.choroplethData ?? [],
    selectedFips,
    onRegionClick,
    onRegionHover,
    visible: activeLayers.has("air-quality"),
  });

  const hospitalLayer = HospitalMapOverlay({
    data: hospitalData.choroplethData ?? [],
    mapData: hospitalData.mapData,
    selectedFips,
    onRegionClick,
    onRegionHover,
    visible: activeLayers.has("hospital-access"),
  });

  return [
    cohortGeographyLayer,
    diseaseBurdenLayer,
    sviLayer,
    ruccLayer,
    comorbidityLayer,
    airQualityLayer,
    hospitalLayer,
  ].filter(Boolean);
}
