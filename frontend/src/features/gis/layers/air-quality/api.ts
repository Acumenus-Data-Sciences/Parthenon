import apiClient from "@/lib/api-client";
import type { LayerChoroplethItem } from "../types";
import { normalizeChoropleth } from "../utils";

export interface AqRespiratoryItem {
  tertile: number;
  total_patients: number;
  outcome_count: number;
  rate: number;
  tertile_min: number;
  tertile_max: number;
}

export interface AqCountyDetail {
  location_name: string;
  fips: string;
  population: number;
  pm25_value: number | null;
  ozone_value: number | null;
  patient_count: number;
}

export async function fetchAqChoropleth(pollutant: string = "pm25"): Promise<LayerChoroplethItem[]> {
  const { data } = await apiClient.get("/gis/air-quality/choropleth", { params: { pollutant } });
  return normalizeChoropleth(data.data, "pollutant_value");
}

export async function fetchAqRespiratoryOutcomes(conceptId: number, pollutant: string = "pm25"): Promise<AqRespiratoryItem[]> {
  const { data } = await apiClient.get("/gis/air-quality/respiratory-outcomes", { params: { concept_id: conceptId, pollutant } });
  return data.data;
}

export async function fetchAqCountyDetail(fips: string): Promise<AqCountyDetail> {
  const { data } = await apiClient.get(`/gis/air-quality/county-detail/${fips}`);
  return data.data;
}
