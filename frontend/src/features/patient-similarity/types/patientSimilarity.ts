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
  recent_shared_count?: number;
  recent_seed_count?: number;
  recent_candidate_count?: number;
  recent_top_shared?: ResolvedConcept[];
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
  anchor_date?: string | null;
  condition_count?: number;
  lab_count?: number;
  dimensions_available?: string[];
  feature_vector_version?: number | null;
  shared_features?: SharedFeatures;
  similarity_summary?: string;
}

export interface SeedPatient {
  person_id: number;
  age_bucket: number | null;
  gender_concept_id: number | null;
  anchor_date?: string | null;
  dimensions_available: string[];
  condition_count?: number;
  lab_count?: number;
  feature_vector_version?: number | null;
}

export interface SimilaritySearchMetadata {
  cache_id?: number;
  query_hash?: string;
  computed_at?: string;
  computed_in_ms?: number;
  candidates_evaluated?: number;
  candidates_loaded?: number;
  total_candidates?: number;
  above_threshold?: number;
  returned_count?: number;
  sql_prescored?: boolean;
  weights?: Record<string, number>;
  filters_applied?: SimilarityFilters;
  limit?: number;
  min_score?: number;
  temporal_window_days?: number;
  feature_vector_version?: number | null;
  seed_anchor_date?: string | null;
  excluded_members?: number;
  diagnostics?: SearchResultDiagnostics;
  cohort_name?: string;
  cohort_member_count?: number;
  cohort_definition_id?: number;
  mode?: string;
  source_id?: number;
  count?: number;
  error?: string;
  [key: string]: unknown;
}

export interface DiagnosticDistributionRow {
  concept_id: number;
  label: string;
  count: number;
  proportion: number;
}

export interface DiagnosticBalanceRow {
  covariate_name: string;
  reference_proportion: number | null;
  result_proportion: number | null;
  smd: number | null;
}

export interface SearchResultDiagnostics {
  result_profile: {
    result_count: number;
    dimension_coverage: Record<string, number>;
    age_summary?: {
      median_bucket?: number;
      p25_bucket?: number;
      p75_bucket?: number;
      median_age?: number;
    };
    gender_distribution?: DiagnosticDistributionRow[];
    race_distribution?: DiagnosticDistributionRow[];
    anchor_date?: {
      coverage: number;
      min?: string | null;
      max?: string | null;
    };
  };
  balance: {
    applicable: boolean;
    reference: string;
    verdict: string;
    mean_abs_smd?: number | null;
    balanced_covariates?: number;
    imbalanced_covariates?: number;
    high_imbalance_covariates?: number;
    covariates: DiagnosticBalanceRow[];
  };
  warnings: string[];
}

export interface SimilaritySearchResult {
  seed: SeedPatient;
  mode: string;
  similar_patients: SimilarPatient[];
  cohort_outcomes?: Record<string, unknown>;
  metadata: SimilaritySearchMetadata;
}

export interface SimilarityFilters {
  age_range?: [number, number];
  gender_concept_id?: number;
}

export interface SimilaritySearchParams {
  person_id: number;
  source_id: number;
  mode?: string;
  weights?: Record<string, number>;
  limit?: number;
  min_score?: number;
  filters?: SimilarityFilters;
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
  filters?: SimilarityFilters;
}

export interface CohortExportParams {
  cache_id: number;
  cohort_name: string;
  cohort_description?: string;
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

// ── Covariate Balance ────────────────────────────────────────────

export interface CovariateBalanceRow {
  covariate: string;
  smd: number;
  type: 'binary' | 'continuous';
  domain: string;
}

// ── Propensity Score Matching ────────────────────────────────────

export interface PropensityMatchParams {
  source_id: number;
  target_cohort_id: number;
  comparator_cohort_id: number;
  max_ratio?: number;
  caliper_scale?: number;
}

export interface PropensityScore {
  person_id: number;
  ps: number;
  preference_score: number;
  cohort: 'target' | 'comparator';
}

export interface MatchedPair {
  target_id: number;
  comparator_id: number;
  distance: number;
}

export interface PropensityModelMetrics {
  auc: number;
  n_covariates: number;
  n_target: number;
  n_comparator: number;
  caliper: number;
}

export interface PreferenceDistribution {
  bins: number[];
  target_density: number[];
  comparator_density: number[];
}

export interface PropensityBalanceResult {
  before: CovariateBalanceRow[];
  after: CovariateBalanceRow[];
}

export interface PropensityMatchResult {
  propensity_scores: PropensityScore[];
  matched_pairs: MatchedPair[];
  balance: PropensityBalanceResult;
  model_metrics: PropensityModelMetrics;
  unmatched: { target_ids: number[]; comparator_ids: number[] };
  preference_distribution: PreferenceDistribution;
}
