import { useQuery } from "@tanstack/react-query";
import type { LayerDataParams, LayerDataResult } from "../types";
import { fetchRuccChoropleth, fetchRuccOutcomeComparison, fetchRuccCountyDetail } from "./api";

export function useRuccData(params: LayerDataParams): LayerDataResult {
  const { conceptId, selectedFips, enabled = true } = params;

  const choropleth = useQuery({
    queryKey: ["gis", "rucc", "choropleth"],
    queryFn: fetchRuccChoropleth,
    enabled,
    staleTime: 5 * 60_000,
  });

  const outcomes = useQuery({
    queryKey: ["gis", "rucc", "outcomes", conceptId],
    queryFn: () => fetchRuccOutcomeComparison(conceptId!, "cases"),
    enabled: enabled && conceptId !== null,
    staleTime: 60_000,
  });

  const detail = useQuery({
    queryKey: ["gis", "rucc", "detail", selectedFips],
    queryFn: () => fetchRuccCountyDetail(selectedFips!),
    enabled: enabled && selectedFips !== null,
  });

  return {
    choroplethData: choropleth.data,
    analysisData: outcomes.data,
    detailData: detail.data,
    isLoading: choropleth.isLoading,
  };
}
