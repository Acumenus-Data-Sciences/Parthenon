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
  denominator_count: number;
  numerator_count: number;
  exclusion_count: number;
  rate: number | null;
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
