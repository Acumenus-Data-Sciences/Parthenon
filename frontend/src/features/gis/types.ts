export interface BoundaryLevel {
  code: string;
  label: string;
  count: number;
}

export interface GisStats {
  total_boundaries: number;
  total_countries: number;
  levels: BoundaryLevel[];
}

export interface BoundaryProperties {
  id: number;
  gid: string;
  name: string;
  country_code: string;
  country_name: string;
  type: string | null;
  parent_gid: string | null;
}

export interface BoundaryFeature {
  type: "Feature";
  id: number;
  geometry: GeoJSON.Geometry;
  properties: BoundaryProperties;
}

export interface BoundaryCollection {
  type: "FeatureCollection";
  features: BoundaryFeature[];
}

export interface ChoroplethDataPoint {
  boundary_id: number;
  gid: string;
  name: string;
  country_code: string;
  value: number;
}

export interface RegionDetail {
  id: number;
  gid: string;
  name: string;
  country_code: string;
  country_name: string;
  level: string;
  type: string | null;
  parent_gid: string | null;
  area_km2: number | null;
  child_count: number;
  exposures: ExposureSummary[];
}

export interface ExposureSummary {
  concept_id: number;
  count: number;
  avg: number | null;
  min: number | null;
  max: number | null;
}

export interface Country {
  code: string;
  name: string;
  boundaries: number;
}

export interface GisDataset {
  id: number;
  name: string;
  slug: string;
  source: string;
  data_type: string;
  feature_count: number;
  status: string;
  loaded_at: string | null;
}

export interface GisDatasetJob {
  id: number;
  name: string;
  slug: string;
  source: string;
  status: "pending" | "running" | "completed" | "failed";
  progress_percentage: number;
  log_output: string | null;
  error_message: string | null;
  feature_count: number;
  levels_requested: string[] | null;
  started_at: string | null;
  completed_at: string | null;
}

export type AdminLevel = "ADM0" | "ADM1" | "ADM2" | "ADM3" | "ADM4" | "ADM5";

export type ChoroplethMetric =
  | "patient_count"
  | "condition_prevalence"
  | "incidence_rate"
  | "exposure_value"
  | "mortality_rate";

export interface MapViewport {
  longitude: number;
  latitude: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

export interface ChoroplethParams {
  level: AdminLevel;
  metric: ChoroplethMetric;
  country_code?: string;
  concept_id?: number;
  date_from?: string;
  date_to?: string;
}

// CDM Spatial types (v2 — disease-agnostic)
export type CdmMetricType =
  | "patient_count"
  | "cases"
  | "deaths"
  | "cfr"
  | "cases_monthly"
  | "hospitalization";

export interface ConditionItem {
  concept_id: number;
  name: string;
  patient_count: number;
  snomed_category: string;
}

export interface ConditionCategory {
  category: string;
  condition_count: number;
  total_patients: number;
}

export interface CountyChoroplethItem {
  boundary_id: number;
  gid: string;
  name: string;
  value: number;
  denominator: number | null;
  rate: number | null;
}

export interface DiseaseSummary {
  condition_concept_id: number;
  condition_name: string;
  total_cases: number;
  total_deaths: number;
  case_fatality_rate: number;
  total_population: number;
  prevalence_per_100k: number;
  affected_counties: number;
  total_counties: number;
  date_range: { start: string | null; end: string | null };
}

export interface CountyDetailData {
  gadm_gid: string;
  name: string;
  boundary_id: number | null;
  area_km2: number | null;
  metrics: Record<string, { value: number; denominator: number | null; rate: number | null }>;
  timeline: { period: string; metric: string; value: number }[];
  demographics: {
    age_groups: { group: string; count: number }[];
    gender: { gender: string; count: number }[];
  };
}

export interface CdmChoroplethParams {
  metric: CdmMetricType;
  concept_id: number;
  time_period?: string;
}
