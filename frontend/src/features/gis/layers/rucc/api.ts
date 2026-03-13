import apiClient from "@/lib/api-client";
import type { LayerChoroplethItem } from "../types";
import { normalizeChoropleth } from "../utils";

export interface RuccChoroplethItem extends LayerChoroplethItem {
  rucc_code: number;
  category: "metro" | "micro" | "rural";
}

export interface RuccOutcomeItem {
  category: string;
  total_patients: number;
  outcome_count: number;
  rate: number;
}

export interface RuccCountyDetail {
  location_name: string;
  fips: string;
  population: number;
  rucc_code: number;
  rucc_label: string;
  category: string;
  patient_count: number;
}

export async function fetchRuccChoropleth(): Promise<RuccChoroplethItem[]> {
  const { data } = await apiClient.get("/gis/rucc/choropleth");
  return normalizeChoropleth(data.data, "rucc_code") as RuccChoroplethItem[];
}

export async function fetchRuccOutcomeComparison(
  conceptId: number,
  metric: string = "cases"
): Promise<RuccOutcomeItem[]> {
  const { data } = await apiClient.get("/gis/rucc/outcome-comparison", {
    params: { concept_id: conceptId, metric },
  });
  return data.data;
}

export async function fetchRuccCountyDetail(
  fips: string
): Promise<RuccCountyDetail> {
  const { data } = await apiClient.get(`/gis/rucc/county-detail/${fips}`);
  return data.data;
}
