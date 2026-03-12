import apiClient from "@/lib/api-client";

// ── Request / Response types ──────────────────────────────────────────────────

export interface GenerateRequest {
  question: string;
  cdm_schema?: string;
}

export interface GenerateResponse {
  sql: string;
  explanation: string;
  tables_referenced: string[];
  is_aggregate: boolean;
  safety: "safe" | "unsafe";
}

export interface ValidateResponse {
  valid: boolean;
  read_only: boolean;
  tables: string[];
  warnings: string[];
  estimated_complexity: "low" | "medium" | "high";
}

export interface SchemaColumn {
  name: string;
  type: string;
  description: string;
}

export interface SchemaTable {
  name: string;
  description: string;
  columns: SchemaColumn[];
}

export interface SchemaResponse {
  clinical_tables: SchemaTable[];
  vocabulary_tables: SchemaTable[];
  common_joins: string[];
}

// ── API functions ─────────────────────────────────────────────────────────────

export async function generateSql(req: GenerateRequest): Promise<GenerateResponse> {
  const { data } = await apiClient.post<{ data: GenerateResponse }>(
    "/text-to-sql/generate",
    req,
  );
  return data.data;
}

export async function validateSql(
  sql: string,
  schema?: string,
): Promise<ValidateResponse> {
  const { data } = await apiClient.post<{ data: ValidateResponse }>(
    "/text-to-sql/validate",
    { sql, cdm_schema: schema },
  );
  return data.data;
}

export async function fetchSchema(): Promise<SchemaResponse> {
  const { data } = await apiClient.get<{ data: SchemaResponse }>(
    "/text-to-sql/schema",
  );
  return data.data;
}
