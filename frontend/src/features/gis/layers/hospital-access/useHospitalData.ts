import { useQuery } from "@tanstack/react-query";
import type { LayerDataParams, LayerDataResult } from "../types";
import { fetchHospitalMapData, fetchAccessAnalysis, fetchDeserts } from "./api";
import { normalizeOutcomeMetric } from "../utils";

export function useHospitalData(params: LayerDataParams): LayerDataResult {
  const { conceptId, metric, enabled = true } = params;
  const outcomeMetric = normalizeOutcomeMetric(metric);

  const hospitals = useQuery({
    queryKey: ["gis", "hospitals", "map"],
    queryFn: fetchHospitalMapData,
    enabled,
    staleTime: 5 * 60_000,
  });

  const access = useQuery({
    queryKey: ["gis", "hospitals", "access", conceptId, outcomeMetric],
    queryFn: () => fetchAccessAnalysis(conceptId!, outcomeMetric),
    enabled: enabled && conceptId !== null,
    staleTime: 60_000,
  });

  const deserts = useQuery({
    queryKey: ["gis", "hospitals", "deserts"],
    queryFn: fetchDeserts,
    enabled,
    staleTime: 5 * 60_000,
  });

  return {
    choroplethData: undefined, // hospitals use ScatterplotLayer, not choropleth
    analysisData: { hospitals: hospitals.data, access: access.data, deserts: deserts.data },
    detailData: null,
    mapData: hospitals.data,
    isLoading: hospitals.isLoading,
  };
}
