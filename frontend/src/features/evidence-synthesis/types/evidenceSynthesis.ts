// ---------------------------------------------------------------------------
// Evidence Synthesis (Meta-Analysis) Types
// ---------------------------------------------------------------------------

import type { AnalysisExecution } from "@/features/analyses/types/analysis";

export interface SiteEstimate {
  logRr: number;
  seLogRr: number;
  siteName: string;
}

export interface EvidenceSynthesisDesign {
  estimates: SiteEstimate[];
  method: "bayesian" | "fixed";
  chainLength?: number;
  burnIn?: number;
  subSample?: number;
}

export interface EvidenceSynthesisAnalysis {
  id: number;
  name: string;
  description: string | null;
  design_json: EvidenceSynthesisDesign;
  author_id: number;
  author?: { id: number; name: string; email: string };
  created_at: string;
  updated_at: string;
  executions?: AnalysisExecution[];
  latest_execution?: AnalysisExecution | null;
}

export interface PooledEstimate {
  log_rr: number;
  se_log_rr: number;
  hr: number;
  ci_lower: number;
  ci_upper: number;
  tau: number;
}

export interface PerSiteResult {
  site_name: string;
  log_rr: number;
  se_log_rr: number;
  hr: number;
  ci_lower: number;
  ci_upper: number;
}

export interface EvidenceSynthesisResult {
  status: string;
  method: string;
  pooled: PooledEstimate;
  per_site: PerSiteResult[];
  logs?: { level: string; message: string; timestamp: string }[];
  elapsed_seconds?: number;
  message?: string;
}
