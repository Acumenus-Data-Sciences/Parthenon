import { useQuery } from "@tanstack/react-query";
import type { LayerDataParams, LayerDataResult } from "../types";
import { fetchComorbidityChoropleth, fetchBurdenScore } from "./api";

export function useComorbidityData(params: LayerDataParams): LayerDataResult {
  const { enabled = true } = params;

  const choropleth = useQuery({
    queryKey: ["gis", "comorbidity", "choropleth"],
    queryFn: fetchComorbidityChoropleth,
    enabled,
    staleTime: 5 * 60_000,
  });

  const burden = useQuery({
    queryKey: ["gis", "comorbidity", "burden"],
    queryFn: fetchBurdenScore,
    enabled,
    staleTime: 5 * 60_000,
  });

  return {
    choroplethData: choropleth.data,
    analysisData: burden.data,
    detailData: null,
    isLoading: choropleth.isLoading,
  };
}
