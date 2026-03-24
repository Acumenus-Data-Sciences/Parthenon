export interface SourceRelease {
  id: number;
  source_id: number;
  release_key: string;
  release_name: string;
  release_type: "scheduled_etl" | "snapshot";
  cdm_version: string | null;
  vocabulary_version: string | null;
  etl_version: string | null;
  person_count: number;
  record_count: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChartAnnotation {
  id: number;
  source_id: number | null;
  chart_type: string;
  chart_context: Record<string, unknown>;
  x_value: string;
  y_value: number | null;
  annotation_text: string;
  created_by: number;
  creator?: { id: number; name: string };
  source?: { id: number; source_name: string };
  created_at: string;
  updated_at: string;
}

export interface StoreReleasePayload {
  release_name: string;
  release_type: "scheduled_etl" | "snapshot";
  cdm_version?: string;
  vocabulary_version?: string;
  etl_version?: string;
  notes?: string;
}

export interface UpdateReleasePayload {
  release_name?: string;
  cdm_version?: string;
  vocabulary_version?: string;
  etl_version?: string;
  notes?: string;
}

export interface StoreAnnotationPayload {
  chart_type: string;
  chart_context: Record<string, unknown>;
  x_value: string;
  y_value?: number;
  annotation_text: string;
}

export interface UpdateAnnotationPayload {
  annotation_text: string;
}

export type AresSection =
  | "hub"
  | "network-overview"
  | "concept-comparison"
  | "dq-history"
  | "coverage"
  | "feasibility"
  | "diversity"
  | "releases"
  | "unmapped-codes"
  | "cost"
  | "annotations";
