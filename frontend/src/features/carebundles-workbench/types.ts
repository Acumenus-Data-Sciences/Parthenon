import type { ConditionBundle, QualityMeasure } from "@/features/care-gaps/types/careGap";

export type CareBundleRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "stale";

export type CareBundleTriggerKind = "manual" | "scheduled" | "api";

export interface CareBundleRun {
  id: number;
  condition_bundle_id: number;
  source_id: number;
  status: CareBundleRunStatus;
  started_at: string | null;
  completed_at: string | null;
  triggered_by: number | null;
  trigger_kind: CareBundleTriggerKind;
  qualified_person_count: number | null;
  measure_count: number | null;
  bundle_version: string | null;
  cdm_fingerprint: string | null;
  fail_message: string | null;
  created_at: string;
}

export interface CareBundleCoverageCell {
  condition_bundle_id: number;
  source_id: number;
  qualified_patients: number;
  updated_at: string;
}

export interface CareBundleMeasureResult {
  quality_measure_id: number;
  measure: Pick<
    QualityMeasure,
    "id" | "measure_code" | "measure_name" | "domain" | "frequency"
  >;
  /** Post-exclusion: patients removed via denominator-exclusion rules are not counted. */
  denominator_count: number;
  /** Compliant, non-excluded. */
  numerator_count: number;
  /** Patients removed from BOTH denominator and numerator per eCQM semantics. */
  exclusion_count: number;
  rate: number | null;
  /** Wilson 95% CI lower bound (0–1). Null when denominator is 0. */
  ci_lower: number | null;
  /** Wilson 95% CI upper bound (0–1). Null when denominator is 0. */
  ci_upper: number | null;
  computed_at: string;
}

export interface CareBundleQualificationsResponse {
  bundle_id: number;
  source_id: number;
  qualified_person_count: number;
  run: Pick<
    CareBundleRun,
    | "id"
    | "status"
    | "started_at"
    | "completed_at"
    | "trigger_kind"
    | "bundle_version"
    | "cdm_fingerprint"
  > | null;
  measures: CareBundleMeasureResult[];
}

export interface MaterializeDispatchResponse {
  bundle_id?: number;
  source_id?: number;
  status: "queued";
  message: string;
}

export type IntersectionMode = "all" | "any" | "exactly";

export interface UpsetCell {
  bundles: number[];
  count: number;
}

export interface IntersectionResponse {
  source_id: number;
  bundle_ids: number[];
  mode: IntersectionMode;
  count: number;
  sample_person_ids: number[];
  upset_cells: UpsetCell[];
}

export interface IntersectionToCohortPayload {
  source_id: number;
  bundle_ids: number[];
  mode: IntersectionMode;
  name: string;
  description?: string | null;
  is_public?: boolean;
}

export interface DerivedCohortDefinition {
  id: number;
  name: string;
  description: string | null;
  expression_json: {
    meta?: {
      derived_from?: string;
      source_id?: number;
      bundle_ids?: number[];
      mode?: IntersectionMode;
      derived_at?: string;
    };
  } | null;
  is_public: boolean;
  version: number;
  created_at: string;
}

export type { ConditionBundle, QualityMeasure };

// ---------------------------------------------------------------------------
// Workbench-aware sources (N ≥ min_population gate)
// ---------------------------------------------------------------------------

export interface CareBundleSource {
  id: number;
  source_name: string;
  cdm_schema: string | null;
  person_count: number | null;
  qualifies: boolean;
  reason: string | null;
}

export interface CareBundleSourcesResponse {
  data: CareBundleSource[];
  meta: { min_population: number };
}

// ---------------------------------------------------------------------------
// VSAC reference library — value sets and CMS measures
// ---------------------------------------------------------------------------

export interface VsacValueSetSummary {
  value_set_oid: string;
  name: string;
  definition_version: string | null;
  expansion_version: string | null;
  qdm_category: string | null;
  code_count: number;
  omop_concept_count: number;
}

export interface VsacValueSetDetail {
  value_set: {
    value_set_oid: string;
    name: string;
    definition_version: string | null;
    expansion_version: string | null;
    qdm_category: string | null;
    purpose_clinical_focus: string | null;
    purpose_data_scope: string | null;
    purpose_inclusion: string | null;
    purpose_exclusion: string | null;
  };
  code_count: number;
  omop_concept_count: number;
  code_systems: Array<{ code_system: string; count: number }>;
  linked_measures: Array<{ cms_id: string; cbe_number: string | null; title: string | null }>;
}

export interface VsacCode {
  id: number;
  value_set_oid: string;
  code: string;
  description: string | null;
  code_system: string;
  code_system_oid: string | null;
  code_system_version: string | null;
}

export interface VsacOmopConcept {
  concept_id: number;
  concept_name: string;
  vocabulary_id: string;
  code: string;
  code_system: string;
}

export interface VsacMeasureSummary {
  cms_id: string;
  cbe_number: string | null;
  program_candidate: string | null;
  title: string | null;
  expansion_version: string | null;
  value_set_count: number;
}

export interface VsacMeasureValueSet {
  value_set_oid: string;
  name: string;
  qdm_category: string | null;
  code_count: number;
  omop_concept_count: number;
}

export interface VsacMeasureDetail {
  measure: VsacMeasureSummary;
  value_sets: VsacMeasureValueSet[];
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    per_page: number;
    last_page?: number;
  };
}

// ---------------------------------------------------------------------------
// Methodology card + Data Quality flags
// ---------------------------------------------------------------------------

export interface MethodologyConcept {
  concept_id: number;
  concept_name: string;
  vocabulary_id: string;
  descendant_count: number;
}

export interface MethodologyExclusion {
  label: string;
  domain: string;
  lookback_days: number;
  vsac_oid: string | null;
  concepts: MethodologyConcept[];
  total_descendants: number;
}

export interface DataQualityFlag {
  level: "info" | "warning" | "critical";
  code: string;
  message: string;
}

export interface MeasureMethodology {
  bundle: {
    id: number;
    bundle_code: string;
    condition_name: string;
    qualification: {
      domain: string;
      concepts: MethodologyConcept[];
      total_descendants: number;
    };
  };
  measure: {
    id: number;
    measure_code: string;
    measure_name: string;
    domain: string;
    frequency: string | null;
    numerator: {
      lookback_days: number;
      concepts: MethodologyConcept[];
      total_descendants: number;
    };
    exclusions: MethodologyExclusion[];
  };
  source: {
    id: number;
    source_name: string;
    cdm_schema: string;
    cdm_max_dates: Record<string, string | null>;
  };
  run: {
    id: number;
    status: string;
    started_at: string | null;
    completed_at: string | null;
    qualified_person_count: number | null;
    measure_count: number | null;
    bundle_version: string | null;
    cdm_fingerprint: string | null;
    trigger_kind: string;
  } | null;
  data_quality_flags: DataQualityFlag[];
}

// ---------------------------------------------------------------------------
// Stratification
// ---------------------------------------------------------------------------

export interface MeasureStratum {
  stratum: string;
  denom: number;
  numer: number;
  excl: number;
  rate: number | null;
  ci_lower: number | null;
  ci_upper: number | null;
}

export interface MeasureStrata {
  age_band: MeasureStratum[];
  sex: MeasureStratum[];
}

// ---------------------------------------------------------------------------
// Source comparison + Time trend (Tier B)
// ---------------------------------------------------------------------------

export interface CompareSource {
  id: number;
  source_name: string;
  person_count: number | null;
  qualifies: boolean;
  run_id: number | null;
  qualified_person_count: number | null;
  completed_at: string | null;
}

export interface CompareCell {
  denominator_count: number;
  numerator_count: number;
  exclusion_count: number;
  rate: number | null;
  ci_lower: number | null;
  ci_upper: number | null;
  computed_at: string | null;
}

export interface CompareMeasure {
  measure_id: number;
  measure_code: string;
  measure_name: string;
  domain: string;
  by_source: Record<string, CompareCell>;
}

export interface ComparisonResponse {
  bundle_id: number;
  sources: CompareSource[];
  measures: CompareMeasure[];
}

export interface TrendPoint {
  run_id: number;
  completed_at: string | null;
  qualified_person_count: number;
  denominator_count: number;
  numerator_count: number;
  exclusion_count: number;
  rate: number | null;
  ci_lower: number | null;
  ci_upper: number | null;
}

export interface TrendResponse {
  bundle_id: number;
  source_id: number;
  measure_id: number;
  points: TrendPoint[];
}
