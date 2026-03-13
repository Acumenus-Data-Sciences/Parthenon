import { useQuery } from "@tanstack/react-query";
import type { LayerDataParams, LayerDataResult } from "../types";
import { fetchComorbidityChoropleth, fetchBurdenScore } from "./api";

export function useComorbidityData(_params: LayerDataParams): LayerDataResult {
  const choropleth = useQuery({
    queryKey: ["gis", "comorbidity", "choropleth"],
    queryFn: fetchComorbidityChoropleth,
    staleTime: 5 * 60_000,
  });

  const burden = useQuery({
    queryKey: ["gis", "comorbidity", "burden"],
    queryFn: fetchBurdenScore,
    staleTime: 5 * 60_000,
  });

  return {
    choroplethData: choropleth.data,
    analysisData: burden.data,
    detailData: null,
    isLoading: choropleth.isLoading,
  };
}
