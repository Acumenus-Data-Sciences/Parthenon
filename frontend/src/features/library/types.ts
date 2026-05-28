export type LibraryStatus = "draft" | "active" | "archived";

export type LibraryEntity =
  | "concept-sets"
  | "cohort-definitions"
  | "characterizations"
  | "incidence-rate-analyses"
  | "pathway-analyses"
  | "estimation-analyses"
  | "prediction-analyses"
  | "feature-analyses"
  | "sccs-analyses"
  | "evidence-synthesis-analyses"
  | "self-controlled-cohort-analyses";

export interface LifecycleResponse {
  id: number;
  status: LibraryStatus;
}

export interface BulkLifecycleResponse {
  done: number[];
  skipped: number[];
  missing: number[];
}

export interface RequiresPromotionPayload {
  requires_promotion: true;
  item_type: string;
  item_id: number;
  item_name: string;
  message: string;
}

export interface CleanupSuggestion {
  user_id: number;
  item_type: string;
  item_id: number;
  last_activity_at: string | null;
  computed_at: string;
}

/**
 * Lifecycle fields present on every library-managed entity (cohort_definitions,
 * concept_sets, *_analyses). The TS interfaces for individual entities
 * augment themselves with this shape.
 */
export interface LibraryLifecycleFields {
  status?: LibraryStatus | null;
  archived_at?: string | null;
  archived_by?: number | null;
  promoted_at?: string | null;
}
