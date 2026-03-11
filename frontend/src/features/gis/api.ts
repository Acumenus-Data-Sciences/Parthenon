import apiClient from "@/lib/api-client";
import type {
  AdminLevel,
  BoundaryCollection,
  ChoroplethDataPoint,
  ChoroplethParams,
  Country,
  GisDatasetJob,
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
}): Promise<{ dataset: GisDatasetJob; cli_command: string }> {
  const { data } = await apiClient.post("/gis/load", params);
  return { dataset: data.data, cli_command: data.cli_command };
}

export async function fetchDatasetStatus(id: number): Promise<GisDatasetJob> {
  const { data } = await apiClient.get(`/gis/datasets/${id}`);
  return data.data;
}
