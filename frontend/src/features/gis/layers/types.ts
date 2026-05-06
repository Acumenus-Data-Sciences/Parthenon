import type { LucideIcon } from "lucide-react";
import type { CohortGeographySelection } from "../types";

/** Data params passed to every layer's data hook. */
export interface LayerDataParams {
  conceptId: number | null;
  selectedFips: string | null;
  metric: string;
  cohortGeography?: CohortGeographySelection | null;
  enabled?: boolean;
}

/** Standard result shape from a layer data hook. */
export interface LayerDataResult {
  choroplethData: LayerChoroplethItem[] | undefined;
  analysisData: unknown;
  detailData: unknown;
  mapData?: unknown;
  isLoading: boolean;
}

/** Single item in a layer's choropleth dataset. */
export interface LayerChoroplethItem {
  geographic_location_id: number;
  location_name: string;
  fips: string;
  latitude: number;
  longitude: number;
  value: number;
  patient_count: number;
  geometry: GeoJSON.Geometry | null;
  /** Extra fields per layer (category, burden_score, etc.) */
  [key: string]: unknown;
}

/** Props passed to a layer's map overlay component. */
export interface LayerMapProps {
  data: LayerChoroplethItem[];
  mapData?: unknown;
  selectedFips: string | null;
  onRegionClick: (fips: string, name: string) => void;
  onRegionHover: (fips: string | null, name: string | null) => void;
  visible: boolean;
}

/** Props passed to a layer's analysis panel component. */
export interface LayerAnalysisProps {
  conceptId: number;
  metric: string;
  cohortGeography?: CohortGeographySelection | null;
}

/** Props passed to a layer's detail panel component. */
export interface LayerDetailProps {
  fips: string;
  conceptId: number;
  cohortGeography?: CohortGeographySelection | null;
}

/** Legend item for composite legend. */
export interface LegendItem {
  label: string;
  color: string;
  type: "gradient" | "category" | "circle";
  min?: number;
  max?: number;
  categories?: { label: string; color: string }[];
}

/** Tooltip entry returned by a layer for a hovered feature. */
export interface TooltipEntry {
  layerId: string;
  label: string;
  value: string | number;
  color: string;
}

/** The core layer interface. Every use case implements this. */
export interface GisLayer {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: LucideIcon;
  requiresConcept?: boolean;
  requiresCohortGeography?: boolean;
  mapOverlay: React.FC<LayerMapProps>;
  legendItems: LegendItem[];
  getTooltipData: (feature: LayerChoroplethItem) => TooltipEntry[];
  analysisPanel: React.FC<LayerAnalysisProps>;
  detailPanel: React.FC<LayerDetailProps>;
  useLayerData: (params: LayerDataParams) => LayerDataResult;
}
