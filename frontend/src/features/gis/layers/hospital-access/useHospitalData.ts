import { useQuery } from "@tanstack/react-query";
import type { LayerDataParams, LayerDataResult } from "../types";
import { fetchHospitalMapData, fetchAccessAnalysis, fetchDeserts } from "./api";

export function useHospitalData(params: LayerDataParams): LayerDataResult {
  const { conceptId, enabled = true } = params;

  const hospitals = useQuery({
    queryKey: ["gis", "hospitals", "map"],
    queryFn: fetchHospitalMapData,
    enabled,
    staleTime: 5 * 60_000,
  });

  const access = useQuery({
    queryKey: ["gis", "hospitals", "access", conceptId],
    queryFn: () => fetchAccessAnalysis(conceptId!, "cases"),
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
    isLoading: hospitals.isLoading,
  };
}
