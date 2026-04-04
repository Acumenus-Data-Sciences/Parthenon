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

export interface ResolvedConcept {
  concept_id: number;
  name: string;
}

export interface SharedFeatureCategory {
  shared_count: number;
  seed_count: number;
  candidate_count: number;
  top_shared: ResolvedConcept[];
}

export interface SharedFeatures {
  conditions: SharedFeatureCategory;
  drugs: SharedFeatureCategory;
  procedures: SharedFeatureCategory;
}

export interface SimilarPatient {
  person_id?: number;
  overall_score: number;
  dimension_scores: DimensionScores;
  age_bucket?: number;
  gender_concept_id?: number;
  shared_features?: SharedFeatures;
  similarity_summary?: string;
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
  total_embeddings: number;
  embeddings_ready: boolean;
  recommended_mode: "interpretable" | "embedding";
  latest_computed_at: string | null;
  staleness_warning: boolean;
  staleness_threshold_days?: number;
}

// ── Cohort Integration ────────────────────────────────────────────

export interface CohortSimilaritySearchParams {
  cohort_definition_id: number;
  source_id: number;
  mode?: string;
  weights?: Record<string, number>;
  limit?: number;
  min_score?: number;
  filters?: Record<string, unknown>;
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

// ── Cohort Profile (Radar Chart) ────────────────────────────────────

export interface CohortDimensionProfile {
  coverage: number;
  label: string;
  unique_concepts?: number;
  unique_measurements?: number;
  unique_genes?: number;
  median_age_bucket?: number;
  dominant_gender?: number;
}

export interface CohortProfileResult {
  cohort_definition_id: number;
  source_id: number;
  member_count: number;
  generated: boolean;
  dimensions: Record<string, CohortDimensionProfile>;
  dimensions_available: string[];
}

// ── Cohort Expansion ────────────────────────────────────────────

export interface ExpandCohortParams {
  cohort_definition_id: number;
  source_id: number;
  person_ids: number[];
}

export interface ExpandCohortResult {
  cohort_definition_id: number;
  added_count: number;
  skipped_duplicates: number;
  new_total: number;
}

// ── Cohort Comparison ────────────────────────────────────────────

export interface CohortComparisonParams {
  source_cohort_id: number;
  target_cohort_id: number;
  source_id: number;
}

export interface CohortDivergence {
  score: number;
  label: string;
}

export interface CohortComparisonCohort {
  cohort_definition_id: number;
  name: string;
  member_count: number;
  dimensions: Record<string, CohortDimensionProfile>;
}

export interface CohortComparisonResult {
  source_cohort: CohortComparisonCohort;
  target_cohort: CohortComparisonCohort;
  divergence: Record<string, CohortDivergence>;
  overall_divergence: number;
}

export interface CrossCohortSearchParams {
  source_cohort_id: number;
  target_cohort_id: number;
  source_id: number;
  limit?: number;
  min_score?: number;
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
    condition_names?: ResolvedConcept[];
    drug_names?: ResolvedConcept[];
    procedure_names?: ResolvedConcept[];
  };
}
