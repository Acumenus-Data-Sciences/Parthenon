// Phase 3 Plan 7 (T-024B) — Harmonia concept-mapping reviewer types.
// Mirrors the Laravel HarmoniaReviewController response shapes.

export type QueueStatus = "pending" | "approved" | "rejected" | "escalated";

export type StatusFilter = QueueStatus | "all";

export type SortBy =
  | "confidence_asc"
  | "confidence_desc"
  | "age_asc"
  | "age_desc"
  | "seen_count_desc";

export interface TopCandidate {
  concept_id: number;
  concept_name: string;
  vocabulary_id: string;
  similarity: number;
}

export interface QueueRow {
  queue_id: number;
  source_code: string;
  source_vocab: string;
  source_text: string | null;
  seen_count: number;
  top1_confidence: number;
  top_candidate: TopCandidate | null;
  model_version: string;
  status: QueueStatus;
  reviewer: { id: number; name: string } | null;
  created_at: string | null;
  reviewed_at: string | null;
}

export interface PaginatedQueue {
  data: QueueRow[];
  meta: {
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
  };
}

export interface QueueStats {
  pending: number;
  approved: number;
  rejected: number;
  escalated: number;
}

export interface CandidateDetail {
  concept_id: number;
  concept_name: string;
  vocabulary_id: string;
  domain_id: string;
  concept_class_id: string | null;
  standard_concept: string | null;
  similarity: number;
  rerank_score: number | null;
  rerank_rationale: string | null;
  concept_still_valid: boolean;
}

export interface QueueDetail {
  queue_id: number;
  source_code: string;
  source_vocab: string;
  source_text: string | null;
  seen_count: number;
  top1_confidence: number;
  model_version: string;
  status: QueueStatus;
  rejection_reason: string | null;
  approved_concept_id: number | null;
  approved_map_id: number | null;
  reviewer: { id: number; name: string; email: string } | null;
  reviewed_at: string | null;
  escalated_at: string | null;
  created_at: string | null;
  candidates: CandidateDetail[];
}

export interface QueueFilters {
  status?: StatusFilter;
  source_vocab?: string;
  q?: string;
  sort_by?: SortBy;
  per_page?: number;
  page?: number;
}

export interface ApproveBody {
  concept_id: number;
  confidence_override?: number;
  comment?: string;
}

export interface RejectBody {
  rejection_reason: string;
}

export interface EscalateBody {
  note: string;
}

// A small extensible enum of common source vocabularies the queue surfaces.
// Reviewer can also type-in a custom value via the q filter.
export const COMMON_SOURCE_VOCABS = [
  "ICD10CM",
  "ICD9CM",
  "NDC",
  "RxNorm",
  "LOINC",
  "SNOMED",
  "LOCAL_LIS",
  "READ",
  "OTHER",
] as const;
