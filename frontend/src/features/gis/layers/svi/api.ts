import apiClient from "@/lib/api-client";
import type { LayerChoroplethItem } from "../types";
import { normalizeChoropleth } from "../utils";

export interface SviQuartileItem {
  quartile: number;
  total_patients: number;
  outcome_count: number;
  rate: number;
  quartile_min: number;
  quartile_max: number;
}

export interface SviTractDetail {
  geographic_location_id: number;
  location_name: string;
  fips: string;
  population: number;
  svi_overall: number | null;
  svi_theme1: number | null;
  svi_theme2: number | null;
  svi_theme3: number | null;
  svi_theme4: number | null;
}

export async function fetchSviChoropleth(
  level: string = "county",
  theme: string = "overall"
): Promise<LayerChoroplethItem[]> {
  const { data } = await apiClient.get("/gis/svi/choropleth", {
    params: { level, theme },
  });
  return normalizeChoropleth(data.data, "svi_value");
}

export async function fetchSviQuartileAnalysis(
  conceptId: number,
  metric: string = "cases"
): Promise<SviQuartileItem[]> {
  const { data } = await apiClient.get("/gis/svi/quartile-analysis", {
    params: { concept_id: conceptId, metric },
  });
  return data.data;
}

export async function fetchSviThemeCorrelations(
  conceptId: number
): Promise<Record<string, unknown[]>> {
  const { data } = await apiClient.get("/gis/svi/theme-correlations", {
    params: { concept_id: conceptId },
  });
  return data.data;
}

export async function fetchSviTractDetail(
  fips: string
): Promise<SviTractDetail> {
  const { data } = await apiClient.get(`/gis/svi/tract-detail/${fips}`);
  return data.data;
}
