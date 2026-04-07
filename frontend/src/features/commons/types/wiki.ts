export interface WikiWorkspace {
  name: string;
  branch: string;
  page_count: number;
  last_activity_at?: string | null;
}

export interface WikiPageSummary {
  workspace: string;
  title: string;
  slug: string;
  page_type: string;
  path: string;
  keywords: string[];
  links: string[];
  updated_at: string;
  source_slug?: string | null;
  source_type?: string | null;
}

export interface WikiPageDetail extends WikiPageSummary {
  body: string;
  source_title?: string | null;
  stored_filename?: string | null;
}

export interface WikiActivityItem {
  timestamp: string;
  action: string;
  target: string;
  message: string;
}

export interface WikiQueryResponse {
  workspace: string;
  answer: string;
  citations: WikiPageSummary[];
}

export interface WikiLintIssue {
  severity: string;
  page_slug: string;
  message: string;
}

export interface WikiLintResponse {
  workspace: string;
  issues: WikiLintIssue[];
}

export interface WikiIngestResponse {
  workspace: string;
  source_slug: string;
  source_title: string;
  created_pages: WikiPageSummary[];
  activity: WikiActivityItem;
}

export interface WikiChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: WikiPageSummary[];
  timestamp: string;
}
