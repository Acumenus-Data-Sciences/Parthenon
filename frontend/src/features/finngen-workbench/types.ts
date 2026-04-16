// frontend/src/features/finngen-workbench/types.ts
//
// SP4 Phase A — types for cohort-workbench session storage. The session_state
// envelope is intentionally loose at this layer; the operation tree shape is
// owned by Phase B and bumped via schema_version.

export type WorkbenchSessionStateV1 = {
  // Phase A scaffold — fields below are placeholders that Phase B will refine
  // when the operation builder ships. Keep optional so older sessions load.
  step?: number;
  selected_cohort_ids?: number[];
  operation_tree?: unknown;
  ui?: Record<string, unknown>;
  // Free-form so autosave never rejects an unknown field.
  [key: string]: unknown;
};

export type WorkbenchSession = {
  id: string;
  user_id: number;
  source_key: string;
  name: string;
  description: string | null;
  schema_version: number;
  session_state: WorkbenchSessionStateV1;
  last_active_at: string;
  created_at: string;
  updated_at: string;
};

export type CreateWorkbenchSessionPayload = {
  source_key: string;
  name: string;
  description?: string | null;
  session_state?: WorkbenchSessionStateV1;
  schema_version?: number;
};

export type UpdateWorkbenchSessionPayload = Partial<{
  name: string;
  description: string | null;
  session_state: WorkbenchSessionStateV1;
  schema_version: number;
}>;
