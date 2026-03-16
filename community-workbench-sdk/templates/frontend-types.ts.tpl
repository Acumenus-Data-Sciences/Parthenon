export type __TYPE_NAME__Runtime = {
  status: string;
  adapter_mode: string;
  fallback_active: boolean;
  upstream_ready: boolean;
  dependency_issues: string[];
  notes: string[];
  last_error?: string | null;
};

export type __TYPE_NAME__Artifact = {
  id: string;
  label: string;
  kind: string;
  content_type?: string | null;
  path?: string | null;
  summary: string;
  downloadable: boolean;
  previewable: boolean;
};

export type __TYPE_NAME__Result = {
  status: string;
  runtime: __TYPE_NAME__Runtime;
  source?: Record<string, unknown> | null;
  summary: Record<string, unknown>;
  panels: Array<Record<string, unknown>>;
  artifacts: {
    artifacts: __TYPE_NAME__Artifact[];
  };
  warnings: string[];
  next_actions: string[];
};
