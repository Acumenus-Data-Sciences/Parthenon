import apiClient from "@/lib/api-client";

export interface HospitalPoint {
  hospital_id: number;
  cms_provider_id: string;
  hospital_name: string;
  city: string;
  county_fips: string;
  latitude: number;
  longitude: number;
  hospital_type: string;
  has_emergency: boolean;
  bed_count: number;
}

export interface AccessBin {
  distance_bin: string;
  bin_order: number;
  total_patients: number;
  outcome_count: number;
  rate: number;
}

export interface DesertArea {
  geographic_location_id: number;
  location_name: string;
  fips: string;
  avg_distance_km: number;
  patient_count: number;
  geometry: GeoJSON.Geometry;
}

export async function fetchHospitalMapData(): Promise<HospitalPoint[]> {
  const { data } = await apiClient.get("/gis/hospitals/map-data");
  return data.data;
}

export async function fetchAccessAnalysis(conceptId: number, metric: string = "cases"): Promise<AccessBin[]> {
  const { data } = await apiClient.get("/gis/hospitals/access-analysis", { params: { concept_id: conceptId, metric } });
  return data.data;
}

export async function fetchDeserts(): Promise<DesertArea[]> {
  const { data } = await apiClient.get("/gis/hospitals/deserts");
  return data.data;
}
