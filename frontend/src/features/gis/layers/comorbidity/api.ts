import apiClient from "@/lib/api-client";
import type { LayerChoroplethItem } from "../types";
import { normalizeChoropleth } from "../utils";

export interface BurdenBucket {
  bucket: number;
  county_count: number;
  bucket_min: number;
  bucket_max: number;
  total_patients: number;
}

export async function fetchComorbidityChoropleth(): Promise<LayerChoroplethItem[]> {
  const { data } = await apiClient.get("/gis/comorbidity/choropleth");
  return normalizeChoropleth(data.data, "burden_score");
}

export async function fetchComorbidityHotspots(conceptId: number): Promise<LayerChoroplethItem[]> {
  const { data } = await apiClient.get("/gis/comorbidity/hotspots", { params: { concept_id: conceptId } });
  return data.data;
}

export async function fetchBurdenScore(): Promise<BurdenBucket[]> {
  const { data } = await apiClient.get("/gis/comorbidity/burden-score");
  return data.data;
}
