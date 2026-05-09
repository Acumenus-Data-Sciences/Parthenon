/**
 * Frontend types matching Plan 2's `/api/v1/ingestion/templates/*` OpenAPI contract.
 *
 * NOTE: Once Plan 2 lands and `./deploy.sh --openapi` is run, the project's
 * `frontend/src/types/api.generated.ts` will contain the canonical shapes.
 * At that point this file should re-export those generated types instead of
 * declaring them. For Phase 0 we declare them manually.
 */

export type TemplateRunStatus =
  | "pending"
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

// Upstream categories evolve as new manifests are added. Keep the union
// open-ended so the SPA does not crash on a new category emitted by the
// templates service. The known values are listed for autocomplete but any
// string is accepted.
export type TemplateCategory =
  | "bootstrap"
  | "diagnostic"
  | "vocabulary"
  | "demo_data"
  | "etl"
  | "validation"
  | "ingestion"
  | "transform"
  | (string & {});

export interface JsonSchemaProperty {
  type: "string" | "number" | "integer" | "boolean";
  title?: string;
  description?: string;
  default?: unknown;
  enum?: ReadonlyArray<string | number>;
  minimum?: number;
  maximum?: number;
  /** Custom Parthenon flag — when true, render as <input type="password">. */
  secret?: boolean;
}

export interface JsonSchemaObject {
  type: "object";
  properties: Record<string, JsonSchemaProperty>;
  required?: string[];
}

/**
 * Catalog summary returned by GET /ingestion/templates.
 *
 * `description` and `parameters_schema` are NOT in the list response — only
 * the manifest endpoint returns them. They are required on TemplateManifest
 * (the detail shape) but optional here.
 */
export interface Template {
  id: string;
  name: string;
  version: string;
  description?: string;
  category: TemplateCategory;
  tags: string[];
  cdm_versions: string[];
  parameters_schema?: JsonSchemaObject;
}

export interface TemplateNode {
  id: string;
  kind: string;
  inputs: string[];
  outputs: string[];
}

export interface PostCondition {
  kind: "row_count" | "dqd_check" | "sql_assert";
  target: string;
  op?: ">=" | "<=" | "==" | ">" | "<";
  value?: number | string;
  status?: "passed" | "failed" | "skipped";
  detail?: string;
}

/**
 * Detail shape returned by GET /ingestion/templates/{id}.
 *
 * Promotes `description` and `parameters_schema` to required (the manifest
 * endpoint always returns them) and adds nodes/post_conditions.
 */
export interface TemplateManifest extends Template {
  description: string;
  parameters_schema: JsonSchemaObject;
  nodes: TemplateNode[];
  post_conditions: PostCondition[];
}

export interface TemplateRun {
  id: number;
  template_id: string;
  template_version: string;
  parameters: Record<string, unknown>;
  status: TemplateRunStatus;
  progress: number;
  current_node: string | null;
  prefect_run_id: string | null;
  error_message: string | null;
  post_conditions: PostCondition[];
  artifacts_path: string | null;
  submitted_by: number;
  submitted_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface TemplateRunLog {
  timestamp: string;
  node_id: string | null;
  level: "debug" | "info" | "warn" | "error";
  message: string;
}

export interface TemplateRunArtifact {
  name: string;
  size_bytes: number;
  signed_url: string;
  content_type: string;
}

export const TERMINAL_STATUSES: ReadonlySet<TemplateRunStatus> = new Set([
  "completed",
  "failed",
  "cancelled",
]);

export function isTerminal(status: TemplateRunStatus): boolean {
  return TERMINAL_STATUSES.has(status);
}
