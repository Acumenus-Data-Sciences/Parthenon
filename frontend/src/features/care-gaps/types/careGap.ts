// ---------------------------------------------------------------------------
// Care Gap & Condition Bundle types
// ---------------------------------------------------------------------------

export interface ConditionBundle {
  id: number;
  bundle_code: string;
  condition_name: string;
  description: string | null;
  icd10_patterns: string[];
  omop_concept_ids: number[];
  bundle_size: number;
  ecqm_references: string[] | null;
  disease_category: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  measures?: QualityMeasure[];
  latest_evaluation?: CareGapEvaluation | null;
}

export interface QualityMeasure {
  id: number;
  measure_code: string;
  measure_name: string;
  description: string | null;
  measure_type: "preventive" | "chronic" | "behavioral";
  domain: "condition" | "drug" | "procedure" | "measurement" | "observation";
  concept_set_id: number | null;
  frequency: string | null;
  is_active: boolean;
  pivot?: { ordinal: number };
}

export interface BundleOverlapRule {
  id: number;
  rule_code: string;
  shared_domain: string;
  applicable_bundle_codes: string[];
  canonical_measure_code: string;
  description: string | null;
}

export interface CareGapEvaluation {
  id: number;
  bundle_id: number;
  source_id: number;
  cohort_definition_id: number | null;
  status: "pending" | "running" | "completed" | "failed";
  evaluated_at: string | null;
  result_json: CareGapResult | null;
  person_count: number | null;
  compliance_summary: ComplianceSummary | null;
  fail_message: string | null;
  created_at: string;
}

export interface CareGapResult {
  bundle_code: string;
  condition_name: string;
  total_patients: number;
  measures: MeasureResult[];
  overlap_deductions: OverlapDeduction[];
  overall_compliance_pct: number;
  risk_distribution: Record<string, number>;
}

export interface MeasureResult {
  measure_code: string;
  measure_name: string;
  eligible: number;
  met: number;
  not_met: number;
  excluded: number;
  compliance_pct: number;
  is_deduplicated: boolean;
  dedup_source?: string;
}

export interface OverlapDeduction {
  domain: string;
  canonical: string;
  satisfied_for: string[];
}

export interface ComplianceSummary {
  met: number;
  open: number;
  excluded: number;
  compliance_pct: number;
}

export interface PopulationSummary {
  total_bundles: number;
  total_patients: number;
  avg_compliance: number;
  bundles: BundlePopulationEntry[];
}

export interface BundlePopulationEntry {
  bundle_code: string;
  condition_name: string;
  disease_category: string | null;
  patient_count: number;
  avg_compliance_pct: number;
  total_open_gaps: number;
  total_closed_gaps: number;
}

// ---------------------------------------------------------------------------
// Payload types
// ---------------------------------------------------------------------------

export interface CreateBundlePayload {
  bundle_code: string;
  condition_name: string;
  description?: string;
  icd10_patterns?: string[];
  omop_concept_ids?: number[];
  ecqm_references?: string[];
  disease_category?: string;
  is_active?: boolean;
}

export type UpdateBundlePayload = Partial<CreateBundlePayload>;

export interface BundleListParams {
  search?: string;
  disease_category?: string;
  is_active?: boolean;
  page?: number;
  per_page?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
}
