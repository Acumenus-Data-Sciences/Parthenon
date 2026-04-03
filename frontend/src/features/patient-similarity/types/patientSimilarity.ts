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
  age_bucket?: number;
  gender_concept_id?: number;
}

export interface SeedPatient {
  person_id: number;
  age_bucket: number | null;
  gender_concept_id: number | null;
  dimensions_available: string[];
  condition_count?: number;
  lab_count?: number;
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
  source_name?: string;
  total_vectors: number;
  latest_computed_at: string | null;
  staleness_warning: boolean;
  staleness_threshold_days?: number;
}

// ── Cohort Integration ────────────────────────────────────────────

export interface CohortSimilaritySearchParams {
  cohort_definition_id: number;
  source_id: number;
  strategy: "centroid" | "exemplar";
  mode?: string;
  weights?: Record<string, number>;
  limit?: number;
  min_score?: number;
}

export interface CohortExportParams {
  cache_id: number;
  cohort_name: string;
  description?: string;
  min_score?: number;
}

export interface CohortExportResult {
  cohort_definition_id: number;
  patient_count: number;
  cohort_name: string;
}

// ── Patient Comparison ────────────────────────────────────────────

export interface PatientComparisonResult {
  person_a: {
    person_id: number;
    age_bucket: number | null;
    gender_concept_id: number | null;
    condition_count: number;
    lab_count: number;
    dimensions_available: string[];
  };
  person_b: {
    person_id: number;
    age_bucket: number | null;
    gender_concept_id: number | null;
    condition_count: number;
    lab_count: number;
    dimensions_available: string[];
  };
  scores: {
    overall_score: number;
    dimension_scores: DimensionScores;
  };
  shared_features: {
    conditions: number[];
    drugs: number[];
    procedures: number[];
    condition_count: number;
    drug_count: number;
    procedure_count: number;
  };
}
