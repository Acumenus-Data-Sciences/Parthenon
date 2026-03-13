import { useQuery } from "@tanstack/react-query";
import type { LayerDataParams, LayerDataResult } from "../types";
import {
  fetchSviChoropleth,
  fetchSviQuartileAnalysis,
  fetchSviTractDetail,
} from "./api";

export function useSviData(params: LayerDataParams): LayerDataResult {
  const { conceptId, selectedFips } = params;

  const choropleth = useQuery({
    queryKey: ["gis", "svi", "choropleth"],
    queryFn: () => fetchSviChoropleth("county", "overall"),
    staleTime: 5 * 60_000,
  });

  const quartiles = useQuery({
    queryKey: ["gis", "svi", "quartiles", conceptId],
    queryFn: () => fetchSviQuartileAnalysis(conceptId!, "cases"),
    enabled: conceptId !== null,
    staleTime: 60_000,
  });

  // Only fetch tract detail for 11-digit tract FIPS codes, not 5-digit county FIPS
  const isTractFips = selectedFips !== null && selectedFips.length === 11;
  const detail = useQuery({
    queryKey: ["gis", "svi", "tract-detail", selectedFips],
    queryFn: () => fetchSviTractDetail(selectedFips!),
    enabled: isTractFips,
  });

  return {
    choroplethData: choropleth.data,
    analysisData: quartiles.data,
    detailData: detail.data,
    isLoading: choropleth.isLoading,
  };
}
