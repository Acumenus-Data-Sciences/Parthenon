import apiClient from "@/lib/api-client";
import type {
  AdminLevel,
  BoundaryCollection,
  ChoroplethDataPoint,
  ChoroplethParams,
  Country,
  GisStats,
  RegionDetail,
} from "./types";

export async function fetchBoundaries(params: {
  level?: AdminLevel;
  country_code?: string;
  parent_gid?: string;
  bbox?: string;
  simplify?: number;
}): Promise<BoundaryCollection> {
  const { data } = await apiClient.get("/gis/boundaries", { params });
  return data;
}

export async function fetchBoundaryDetail(id: number): Promise<RegionDetail> {
  const { data } = await apiClient.get(`/gis/boundaries/${id}`);
  return data.data;
}

export async function fetchGisStats(): Promise<GisStats> {
  const { data } = await apiClient.get("/gis/stats");
  return data.data;
}

export async function fetchChoropleth(
  params: ChoroplethParams
): Promise<ChoroplethDataPoint[]> {
  const { data } = await apiClient.post("/gis/choropleth", params);
  return data.data;
}

export async function fetchCountries(): Promise<Country[]> {
  const { data } = await apiClient.get("/gis/countries");
  return data.data;
}

export async function loadGisDataset(params: {
  source: string;
  levels?: AdminLevel[];
  country_codes?: string[];
}): Promise<{ features_loaded: number }> {
  const { data } = await apiClient.post("/gis/load", params);
  return data.data;
}
