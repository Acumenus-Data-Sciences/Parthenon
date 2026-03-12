import apiClient from "@/lib/api-client";
import type {
  AdminLevel,
  BoundaryCollection,
  CdmChoroplethParams,
  ChoroplethDataPoint,
  ChoroplethParams,
  ConditionCategory,
  ConditionItem,
  Country,
  CountyChoroplethItem,
  CountyDetailData,
  DiseaseSummary,
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

// CDM Spatial API functions (v2 — disease-agnostic)

export async function fetchConditions(params?: {
  search?: string;
  category?: string;
  limit?: number;
}): Promise<ConditionItem[]> {
  const { data } = await apiClient.get("/gis/cdm/conditions", { params });
  return data.data;
}

export async function fetchConditionCategories(): Promise<ConditionCategory[]> {
  const { data } = await apiClient.get("/gis/cdm/conditions/categories");
  return data.data;
}

export async function fetchCdmChoropleth(
  params: CdmChoroplethParams
): Promise<CountyChoroplethItem[]> {
  const { data } = await apiClient.post("/gis/cdm/choropleth", params);
  return data.data;
}

export async function fetchTimePeriods(conceptId: number): Promise<string[]> {
  const { data } = await apiClient.get("/gis/cdm/time-periods", {
    params: { concept_id: conceptId },
  });
  return data.data;
}

export async function fetchDiseaseSummary(conceptId: number): Promise<DiseaseSummary> {
  const { data } = await apiClient.get("/gis/cdm/summary", {
    params: { concept_id: conceptId },
  });
  return data.data;
}

export async function fetchCountyDetail(
  gadmGid: string,
  conceptId: number
): Promise<CountyDetailData> {
  const { data } = await apiClient.get(`/gis/cdm/county/${gadmGid}`, {
    params: { concept_id: conceptId },
  });
  return data.data;
}

export async function refreshCdmStats(
  conceptId: number
): Promise<{ status: string; metrics_computed: number }> {
  const { data } = await apiClient.post("/gis/cdm/refresh", null, {
    params: { concept_id: conceptId },
  });
  return data.data;
}
