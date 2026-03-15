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
  safety: "safe" | "unsafe" | "unknown";
  source_type?: "library" | "generated";
  template_name?: string;
  query?: QueryLibraryEntry;
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

export interface QueryLibraryParameter {
  key: string;
  label: string;
  type: string;
  default?: string;
  description?: string;
}

export interface QueryLibraryEntry {
  id: number;
  slug: string;
  name: string;
  domain: string;
  category: string;
  summary: string;
  description?: string;
  parameters?: QueryLibraryParameter[];
  tags: string[];
  example_questions?: string[];
  source: string;
  is_aggregate: boolean;
  safety: "safe" | "unsafe" | "unknown";
}

export interface QueryLibrarySearchMeta {
  query: string;
  domain?: string | null;
  count: number;
  total: number;
  indexed_total: number;
  domain_counts: Array<{
    domain: string;
    count: number;
  }>;
}

export interface QueryLibrarySearchResponse {
  data: QueryLibraryEntry[];
  meta: QueryLibrarySearchMeta;
}

interface RawSchemaColumn {
  name: string;
  type: string;
  description?: string;
  note?: string;
}

interface RawSchemaTable {
  name: string;
  description: string;
  columns?: RawSchemaColumn[];
  key_columns?: RawSchemaColumn[];
}

interface RawJoinPattern {
  name?: string;
  sql?: string;
}

interface RawSchemaResponse {
  clinical_tables?: RawSchemaTable[];
  vocabulary_tables?: RawSchemaTable[];
  common_joins?: string[];
  common_join_patterns?: RawJoinPattern[];
}

export function normalizeSchemaResponse(raw: RawSchemaResponse): SchemaResponse {
  const normalizeTable = (table: RawSchemaTable): SchemaTable => ({
    name: table.name,
    description: table.description,
    columns: (table.columns ?? table.key_columns ?? []).map((column) => ({
      name: column.name,
      type: column.type,
      description: column.description ?? column.note ?? "",
    })),
  });

  return {
    clinical_tables: (raw.clinical_tables ?? []).map(normalizeTable),
    vocabulary_tables: (raw.vocabulary_tables ?? []).map(normalizeTable),
    common_joins:
      raw.common_joins ??
      (raw.common_join_patterns ?? [])
        .map((pattern) => pattern.sql ?? "")
        .filter((pattern): pattern is string => pattern.length > 0),
  };
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
  const { data } = await apiClient.get<{ data: RawSchemaResponse }>(
    "/text-to-sql/schema",
  );
  return normalizeSchemaResponse(data.data ?? {});
}

export async function searchQueryLibrary(params?: {
  q?: string;
  domain?: string;
  limit?: number;
}): Promise<QueryLibrarySearchResponse> {
  const { data } = await apiClient.get<{
    data: QueryLibraryEntry[];
    meta: QueryLibrarySearchMeta;
  }>("/query-library", { params });

  return {
    data: data.data ?? [],
    meta: data.meta ?? {
      query: params?.q ?? "",
      domain: params?.domain ?? null,
      count: 0,
      total: 0,
      indexed_total: 0,
      domain_counts: [],
    },
  };
}

export async function renderQueryLibraryEntry(
  id: number,
  params?: {
    dialect?: string;
    params?: Record<string, string>;
  },
): Promise<GenerateResponse> {
  const { data } = await apiClient.post<{
    data: GenerateResponse;
  }>(`/query-library/${id}/render`, params ?? {});

  return data.data;
}

// ── SQL Execution ────────────────────────────────────────────────────────────

export interface ExecuteResponse {
  execution_id: string;
  columns: string[];
  rows: unknown[][];
  row_count: number;
  elapsed_ms: number;
  truncated: boolean;
}

export interface ExecutionStatus {
  active: boolean;
  state: string;
  wait_event: string | null;
  elapsed_ms: number;
}

export async function executeSql(
  sql: string,
  safety: string = "unknown",
): Promise<ExecuteResponse> {
  const { data } = await apiClient.post<{ data: ExecuteResponse }>(
    "/text-to-sql/execute",
    { sql, safety },
  );
  return data.data;
}

export async function getExecutionStatus(
  executionId: string,
): Promise<ExecutionStatus> {
  const { data } = await apiClient.get<{ data: ExecutionStatus }>(
    `/text-to-sql/execute/${executionId}/status`,
  );
  return data.data;
}

export function downloadExecutionCsv(executionId: string): void {
  const baseUrl = apiClient.defaults.baseURL ?? "";
  const url = `${baseUrl}/text-to-sql/execute/${executionId}/download`;
  window.open(url, "_blank");
}
