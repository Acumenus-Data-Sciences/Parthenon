import { useQuery } from "@tanstack/react-query";
import type { LayerDataParams, LayerDataResult } from "../types";
import { fetchAqChoropleth, fetchAqRespiratoryOutcomes, fetchAqCountyDetail } from "./api";

export function useAirQualityData(params: LayerDataParams): LayerDataResult {
  const { conceptId, selectedFips } = params;

  const choropleth = useQuery({
    queryKey: ["gis", "aq", "choropleth"],
    queryFn: () => fetchAqChoropleth("pm25"),
    staleTime: 5 * 60_000,
  });

  const respiratory = useQuery({
    queryKey: ["gis", "aq", "respiratory", conceptId],
    queryFn: () => fetchAqRespiratoryOutcomes(conceptId!, "pm25"),
    enabled: conceptId !== null,
    staleTime: 60_000,
  });

  const detail = useQuery({
    queryKey: ["gis", "aq", "detail", selectedFips],
    queryFn: () => fetchAqCountyDetail(selectedFips!),
    enabled: selectedFips !== null,
  });

  return { choroplethData: choropleth.data, analysisData: respiratory.data, detailData: detail.data, isLoading: choropleth.isLoading };
}
