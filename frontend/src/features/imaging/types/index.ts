export type ImagingModality = 'CT' | 'MR' | 'PT' | 'US' | 'CR' | 'DX' | 'MG' | 'XA' | 'NM' | 'RF' | string;
export type StudyStatus = 'indexed' | 'processed' | 'error';
export type FeatureType = 'nlp_finding' | 'ai_classification' | 'radiomic' | 'manual';
export type CriteriaType = 'modality' | 'anatomy' | 'quantitative' | 'ai_classification' | 'dose';

export type MeasurementType =
  | 'tumor_volume' | 'suvmax' | 'opacity_score' | 'lesion_count'
  | 'longest_diameter' | 'perpendicular_diameter' | 'density_hu'
  | 'enhancement_ratio' | 'ground_glass_extent' | 'consolidation_extent'
  | 'metabolic_tumor_volume' | 'total_lesion_glycolysis' | 'ct_severity_score'
  | string;

export type ResponseCategory = 'CR' | 'PR' | 'SD' | 'PD' | 'NE' | string;
export type ResponseCriteria = 'recist' | 'ct_severity' | 'deauville' | 'rano';

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
  omop_procedure_xrefs?: ImagingProcedureOmopXref[];
  measurements_count?: number;
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
  image_occurrence_id: number | null;
  created_at: string;
  updated_at: string;
  omop_xref?: ImagingSeriesOmopXref | null;
}

export interface ImagingSeriesOmopXref {
  series_id: number;
  image_occurrence_id: number | null;
  procedure_occurrence_id: number | null;
  visit_occurrence_id: number | null;
  modality_concept_id: number | null;
  anatomic_site_concept_id: number | null;
  backfill_run_id: number | null;
  mapping_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImagingProcedureOmopXref {
  study_id: number;
  modality: string;
  procedure_occurrence_id: number;
  procedure_concept_id: number;
  procedure_type_concept_id: number;
  source_strategy: string;
  source_procedure_occurrence_id: number | null;
  visit_occurrence_id: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
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
  omop_linked_studies: number;
  total_series: number;
  omop_linked_series: number;
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

// ── Imaging Outcomes Research Types ──────────────────────────────────────

export interface ImagingMeasurement {
  id: number;
  study_id: number;
  person_id: number | null;
  series_id: number | null;
  measurement_type: MeasurementType;
  measurement_name: string;
  value_as_number: number;
  unit: string;
  body_site: string | null;
  laterality: 'LEFT' | 'RIGHT' | 'BILATERAL' | null;
  algorithm_name: string | null;
  confidence: number | null;
  created_by: number | null;
  measured_at: string | null;
  is_target_lesion: boolean;
  target_lesion_number: number | null;
  created_at: string;
  updated_at: string;
  study?: Pick<ImagingStudy, 'id' | 'study_date' | 'modality' | 'body_part_examined'>;
}

export interface ImagingResponseAssessment {
  id: number;
  person_id: number;
  criteria_type: ResponseCriteria;
  assessment_date: string;
  body_site: string | null;
  baseline_study_id: number;
  current_study_id: number;
  baseline_value: number | null;
  nadir_value: number | null;
  current_value: number | null;
  percent_change_from_baseline: number | null;
  percent_change_from_nadir: number | null;
  response_category: ResponseCategory;
  rationale: string | null;
  assessed_by: number | null;
  is_confirmed: boolean;
  created_at: string;
  baseline_study?: Pick<ImagingStudy, 'id' | 'study_date' | 'modality'>;
  current_study?: Pick<ImagingStudy, 'id' | 'study_date' | 'modality'>;
}

export interface PersonDemographics {
  person_id: number;
  year_of_birth: number | null;
  gender: string | null;
  race: string | null;
}

export interface DrugExposure {
  drug_concept_id: number;
  drug_name: string;
  drug_class: string | null;
  start_date: string;
  end_date: string | null;
  total_days: number;
}

export interface TimelineStudy {
  id: number;
  study_instance_uid: string;
  study_date: string | null;
  modality: ImagingModality | null;
  body_part_examined: string | null;
  study_description: string | null;
  num_series: number;
  num_images: number;
  status: StudyStatus;
  measurement_count: number;
}

export interface TimelineSummary {
  total_studies: number;
  modalities: string[];
  date_range: { first: string | null; last: string | null };
  total_measurements: number;
  measurement_types: string[];
  total_drugs: number;
  imaging_span_days: number | null;
}

export interface PatientTimeline {
  person: PersonDemographics;
  studies: TimelineStudy[];
  drug_exposures: DrugExposure[];
  measurements: ImagingMeasurement[];
  summary: TimelineSummary;
}

export interface MeasurementTrend {
  date: string;
  value: number;
  unit: string;
  study_id: number;
  measurement_name: string;
  body_site: string | null;
  is_target_lesion: boolean;
}

export interface PatientWithImaging {
  person_id: number;
  study_count: number;
  modality_count: number;
  modalities: string[];
  first_study_date: string | null;
  last_study_date: string | null;
}
