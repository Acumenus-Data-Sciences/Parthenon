export type ImportStatus =
  | "pending"
  | "uploaded"
  | "analyzed"
  | "mapped"
  | "configured"
  | "queued"
  | "importing"
  | "complete"
  | "failed"
  | "rolled_back";

export type ColumnPurpose =
  | "geography_code"
  | "geography_name"
  | "latitude"
  | "longitude"
  | "value"
  | "metadata"
  | "skip";

export interface ColumnSuggestion {
  column: string;
  purpose: ColumnPurpose;
  geo_type: string | null;
  exposure_type: string | null;
  confidence: number;
  reasoning: string;
}

export interface ColumnMapping {
  [column: string]: {
    purpose: ColumnPurpose;
    geo_type?: string;
    exposure_type?: string;
  };
}

export interface ImportConfig {
  layer_name: string;
  exposure_type: string;
  geography_level: string;
  value_type: "continuous" | "categorical" | "binary";
  aggregation: "sum" | "mean" | "max" | "min" | "latest";
}

export interface GisImport {
  id: number;
  user_id: number;
  filename: string;
  import_mode: string;
  status: ImportStatus;
  column_mapping: ColumnMapping;
  abby_suggestions: { suggestions: ColumnSuggestion[]; source: string };
  config: ImportConfig | Record<string, never>;
  row_count: number | null;
  progress_percentage: number;
  log_output: string | null;
  error_log: Array<{ time: string; message: string }>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  user?: { id: number; name: string };
}

export interface UploadResult {
  import_id: number;
  filename: string;
  import_mode: string;
  preview: {
    headers: string[];
    rows: Record<string, string>[];
    row_count: number;
    encoding: string;
  };
}

export interface ValidationResult {
  total_rows: number;
  unique_geographies: number;
  matched: number;
  unmatched: number;
  match_rate: number;
  stubs_to_create: number;
  location_type: string;
}

export interface ImportWizardState {
  step: number;
  importId: number | null;
  preview: UploadResult["preview"] | null;
  suggestions: ColumnSuggestion[];
  mapping: ColumnMapping;
  config: Partial<ImportConfig>;
  validation: ValidationResult | null;
}
