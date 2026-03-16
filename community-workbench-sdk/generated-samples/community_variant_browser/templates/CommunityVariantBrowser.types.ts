export type CommunityVariantBrowserRuntime = {
  status: string;
  adapter_mode: string;
  fallback_active: boolean;
  upstream_ready: boolean;
  dependency_issues: string[];
  notes: string[];
  last_error?: string | null;
};

export type CommunityVariantBrowserArtifact = {
  id: string;
  label: string;
  kind: string;
  content_type?: string | null;
  path?: string | null;
  summary: string;
  downloadable: boolean;
  previewable: boolean;
};

export type CommunityVariantBrowserResult = {
  status: string;
  runtime: CommunityVariantBrowserRuntime;
  source?: Record<string, unknown> | null;
  summary: Record<string, unknown>;
  panels: Array<Record<string, unknown>>;
  artifacts: {
    artifacts: CommunityVariantBrowserArtifact[];
  };
  warnings: string[];
  next_actions: string[];
};
