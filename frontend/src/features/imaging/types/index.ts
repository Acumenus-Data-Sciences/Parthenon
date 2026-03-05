export type ImagingModality = 'CT' | 'MR' | 'PT' | 'US' | 'CR' | 'DX' | 'MG' | 'XA' | 'NM' | 'RF' | string;
export type StudyStatus = 'indexed' | 'processed' | 'error';
export type FeatureType = 'nlp_finding' | 'ai_classification' | 'radiomic' | 'manual';
export type CriteriaType = 'modality' | 'anatomy' | 'quantitative' | 'ai_classification' | 'dose';

export interface ImagingStudy {
  id: number;
  source_id: number;
  person_id: number | null;
  study_instance_uid: string;
  accession_number: string | null;
  modality: ImagingModality | null;
  body_part_examined: string | null;
  study_description: string | null;
  study_date: string | null;
  num_series: number;
  num_images: number;
  orthanc_study_id: string | null;
  wadors_uri: string | null;
  status: StudyStatus;
  image_occurrence_id: number | null;
  created_at: string;
  updated_at: string;
  series?: ImagingSeries[];
}

export interface ImagingSeries {
  id: number;
  study_id: number;
  series_instance_uid: string;
  series_description: string | null;
  modality: ImagingModality | null;
  body_part_examined: string | null;
  series_number: number | null;
  num_images: number;
  slice_thickness_mm: number | null;
  manufacturer: string | null;
  manufacturer_model: string | null;
  created_at: string;
}

export interface ImagingFeature {
  id: number;
  study_id: number;
  source_id: number;
  person_id: number | null;
  feature_type: FeatureType;
  algorithm_name: string | null;
  feature_name: string;
  feature_source_value: string | null;
  value_as_number: number | null;
  value_as_string: string | null;
  value_concept_id: number | null;
  unit_source_value: string | null;
  body_site: string | null;
  confidence: number | null;
  created_at: string;
}

export interface ImagingCohortCriterion {
  id: number;
  created_by: number;
  name: string;
  criteria_type: CriteriaType;
  criteria_definition: Record<string, unknown>;
  description: string | null;
  is_shared: boolean;
  created_at: string;
}

export interface ImagingStats {
  total_studies: number;
  total_features: number;
  studies_by_modality: Record<string, number>;
  features_by_type: Record<string, number>;
  persons_with_imaging: number;
}

export interface PopulationAnalytics {
  by_modality: Array<{ modality: string; n: number; unique_persons: number }>;
  by_body_part: Array<{ body_part_examined: string; n: number }>;
  top_features: Array<{ feature_name: string; feature_type: string; n: number }>;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}
