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
