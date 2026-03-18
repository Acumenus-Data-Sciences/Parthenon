/**
 * Abby AI Research Companion — Type Definitions
 *
 * Types for the Abby Commons integration including RAG responses,
 * source attribution, feedback, and ChromaDB ingestion status.
 */

// ─── Core Entities ──────────────────────────────────────────────

export interface AbbyUser {
  id: string;
  name: "Abby";
  email: "abby@parthenon.local";
  is_ai_agent: true;
  avatar_url: null;
}

export interface ObjectReference {
  id: string;
  type: ObjectReferenceType;
  referenceable_id: string;
  display_name: string;
  status?: string;
  last_modified?: string;
}

export type ObjectReferenceType =
  | "cohort_definition"
  | "concept_set"
  | "study"
  | "analysis_result"
  | "data_source"
  | "dq_report";

// ─── RAG Response ───────────────────────────────────────────────

export interface AbbyQueryRequest {
  query: string;
  channel_id: string;
  channel_name: string;
  user_name: string;
  parent_message_id?: string;
  object_type?: string;
  object_id?: string;
  conversation_id?: number;
  page_context?: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface AbbyQueryResponse {
  content: string;
  sources: AbbySource[];
  object_references: ObjectReference[];
  confidence_score?: number;
  collections_searched: string[];
  retrieval_time_ms: number;
  generation_time_ms: number;
  conversation_id?: number;
}

export interface AbbySource {
  collection: string;
  document_id: string;
  snippet: string;
  relevance_score: number;
  metadata: AbbySourceMetadata;
}

export interface AbbySourceMetadata {
  channel_id?: string;
  channel_name?: string;
  user_id?: string;
  user_name?: string;
  created_at?: string;
  article_id?: string;
  review_id?: string;
  cohort_id?: string;
  study_id?: string;
  [key: string]: string | undefined;
}

// ─── Message Integration ────────────────────────────────────────

export interface AbbyMessage {
  id: string;
  channel_id: string;
  user_id: string;
  body: string;
  body_html?: string;
  parent_id?: string;
  object_references: ObjectReference[];
  created_at: string;
  metadata: AbbyMessageMetadata;
}

export interface AbbyMessageMetadata {
  is_ai_generated: true;
  model: string;
  sources: AbbySource[];
  confidence_score?: number;
  collections_searched?: string[];
  retrieval_time_ms?: number;
  generation_time_ms?: number;
}

// ─── Feedback ───────────────────────────────────────────────────

export type FeedbackRating = "helpful" | "not_helpful";

export type FeedbackCategory =
  | "inaccurate_recall"
  | "wrong_source"
  | "missing_context"
  | "too_verbose"
  | "hallucination"
  | "other";

export interface AbbyFeedback {
  id: string;
  message_id: string;
  user_id: string;
  rating: FeedbackRating;
  categories?: FeedbackCategory[];
  comment?: string;
  created_at: string;
}

export interface AbbyFeedbackRequest {
  message_id: string;
  rating: FeedbackRating;
  categories?: FeedbackCategory[];
  comment?: string;
}

// ─── RAG Pipeline State (for typing indicator) ──────────────────

export type RagStage =
  | "analyzing"
  | "retrieving"
  | "reading"
  | "composing"
  | "complete"
  | "error";

export interface RagPipelineState {
  stage: RagStage;
  collections_count?: number;
  sources_found?: number;
  error_message?: string;
}

// ─── Component Props ────────────────────────────────────────────

export interface AbbyResponseCardProps {
  message: AbbyMessage;
  sources: AbbySource[];
  objectReferences: ObjectReference[];
  onFeedback?: (feedback: AbbyFeedbackRequest) => void;
  onObjectReferenceClick?: (ref: ObjectReference) => void;
  compact?: boolean;
}

export interface AbbySourceAttributionProps {
  sources: AbbySource[];
  defaultExpanded?: boolean;
  onSourceClick?: (source: AbbySource) => void;
}

export interface AbbyTypingIndicatorProps {
  pipelineState: RagPipelineState;
}

export interface AbbyFeedbackProps {
  messageId: string;
  existingFeedback?: AbbyFeedback;
  onSubmit: (feedback: AbbyFeedbackRequest) => void;
}

export interface AbbyMentionHandlerProps {
  channelId: string;
  channelName: string;
  parentMessageId?: string;
  onQueryStart?: () => void;
  onQueryComplete?: (response: AbbyQueryResponse) => void;
  onQueryError?: (error: Error) => void;
}

export interface AskAbbyChannelProps {
  className?: string;
}

export interface AbbyConversationSummary {
  id: number;
  title: string | null;
  page_context: string;
  updated_at: string;
  created_at: string;
  messages_count: number;
}

export interface AbbyConversationMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface AbbyAvatarProps {
  size?: "sm" | "md" | "lg";
  showStatus?: boolean;
  className?: string;
}
