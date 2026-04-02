export interface SimilarityDimension {
  id: number;
  key: string;
  name: string;
  description: string | null;
  default_weight: number;
  is_active: boolean;
  config: Record<string, unknown> | null;
}

export interface DimensionScores {
  demographics: number | null;
  conditions: number | null;
  measurements: number | null;
  drugs: number | null;
  procedures: number | null;
  genomics: number | null;
}

export interface SimilarPatient {
  person_id?: number;
  overall_score: number;
  dimension_scores: DimensionScores;
  shared_conditions?: Array<{ concept_id: number; concept_name: string }>;
  shared_drugs?: Array<{ concept_id: number; concept_name: string }>;
  shared_variants?: Array<{ variant_id: string; gene: string }>;
  demographics?: { age: number; gender: string };
}

export interface SeedPatient {
  person_id: number;
  age_bucket: string | null;
  gender_concept_id: number | null;
  condition_count: number;
  lab_count: number;
  dimensions_available: string[];
}

export interface SimilaritySearchResult {
  seed: SeedPatient;
  mode: string;
  similar_patients: SimilarPatient[];
  cohort_outcomes?: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

export interface SimilaritySearchParams {
  person_id: number;
  source_id: number;
  mode?: string;
  weights?: Record<string, number>;
  limit?: number;
  min_score?: number;
  filters?: Record<string, unknown>;
}

export interface ComputeStatus {
  source_id: number;
  patient_count: number;
  last_computed_at: string | null;
  staleness_warning: boolean;
  days_since_compute: number | null;
}
