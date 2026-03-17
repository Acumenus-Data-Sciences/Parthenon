export interface AqueductRuntime {
  status: string;
  adapter_mode: string;
  fallback_active: boolean;
  upstream_ready: boolean;
  dependency_issues: string[];
  notes: string[];
  timings?: Record<string, number>;
  last_error: string | null;
}

export interface AqueductArtifact {
  id: string;
  label: string;
  kind: string;
  content_type?: string;
  path?: string | null;
  summary: string;
  downloadable: boolean;
  previewable: boolean;
  content?: string;
}

export interface AqueductResultEnvelope {
  status: string;
  runtime: AqueductRuntime;
  summary: Record<string, unknown>;
  panels: unknown[];
  artifacts: { artifacts: AqueductArtifact[] };
  warnings: string[];
  next_actions: string[];
}

export interface LookupVocabulary {
  id: string;
  display_name: string;
  domain: string | null;
}

export interface LookupPreviewResponse {
  vocabulary: string;
  sql: string;
  includes_source_to_source: boolean;
}
