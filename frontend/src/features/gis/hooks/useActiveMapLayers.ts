import type { Layer } from "@deck.gl/core";
import { useLayerStore } from "../stores/layerStore";
import { SviMapOverlay } from "../layers/svi/SviMapOverlay";
import { RuccMapOverlay } from "../layers/rucc/RuccMapOverlay";
import { ComorbidityMapOverlay } from "../layers/comorbidity/ComorbidityMapOverlay";
import { AirQualityMapOverlay } from "../layers/air-quality/AirQualityMapOverlay";
import { HospitalMapOverlay } from "../layers/hospital-access/HospitalMapOverlay";
import { useSviData } from "../layers/svi/useSviData";
import { useRuccData } from "../layers/rucc/useRuccData";
import { useComorbidityData } from "../layers/comorbidity/useComorbidityData";
import { useAirQualityData } from "../layers/air-quality/useAirQualityData";
import { useHospitalData } from "../layers/hospital-access/useHospitalData";

interface UseActiveMapLayersProps {
  conceptId: number | null;
  selectedFips: string | null;
  onRegionClick: (fips: string, name: string) => void;
  onRegionHover: (fips: string | null, name: string | null) => void;
}

/**
 * Collects all 5 GIS map overlay deck.gl layers for active use-cases.
 *
 * All data hooks are called unconditionally (fixed order — Rules of Hooks).
 * Each overlay receives `visible: false` when its layer is not active,
 * which causes it to return null and skip rendering.
 */
export function useActiveMapLayers({
  conceptId,
  selectedFips,
  onRegionClick,
  onRegionHover,
}: UseActiveMapLayersProps): Layer[] {
  const { activeLayers } = useLayerStore();

  const params = { conceptId, selectedFips, metric: "cases" };

  // Data hooks — always called (Rules of Hooks)
  const sviData = useSviData(params);
  const ruccData = useRuccData(params);
  const comorbidityData = useComorbidityData(params);
  const airQualityData = useAirQualityData(params);
  const hospitalData = useHospitalData(params);

  // Overlay hooks — always called with visible=false when inactive
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
    selectedFips,
    onRegionClick,
    onRegionHover,
    visible: activeLayers.has("hospital-access"),
  });

  return [sviLayer, ruccLayer, comorbidityLayer, airQualityLayer, hospitalLayer].filter(
    (l): l is Layer => l !== null
  );
}
