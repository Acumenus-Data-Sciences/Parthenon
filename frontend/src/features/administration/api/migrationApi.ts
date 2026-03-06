import apiClient from "@/lib/api-client";

// ── Types ────────────────────────────────────────────────────────────────────

export interface AtlasTestResult {
  success: boolean;
  message: string;
  version: string | null;
  sources_count: number;
}

export interface AtlasEntitySummary {
  id: number;
  name: string;
  description?: string | null;
}

export interface AtlasDiscoveryResult {
  sources: { count: number; items: AtlasEntitySummary[] };
  concept_sets: { count: number; items: AtlasEntitySummary[] };
  cohort_definitions: { count: number; items: AtlasEntitySummary[] };
  incidence_rates: { count: number; items: AtlasEntitySummary[] };
  characterizations: { count: number; items: AtlasEntitySummary[] };
  pathways: { count: number; items: AtlasEntitySummary[] };
  estimations: { count: number; items: AtlasEntitySummary[] };
  predictions: { count: number; items: AtlasEntitySummary[] };
}

export interface MappingSummaryEntry {
  imported: number;
  skipped: number;
  failed: number;
  total: number;
}

export interface AtlasMigration {
  id: number;
  webapi_url: string;
  webapi_name: string | null;
  status: "pending" | "discovering" | "importing" | "validating" | "completed" | "failed";
  selected_entities: Record<string, number[]> | null;
  discovery_results: AtlasDiscoveryResult | null;
  import_results: Record<string, { imported: number; skipped: number; failed: number }> | null;
  validation_results: Record<string, unknown> | null;
  current_step: string | null;
  total_entities: number;
  imported_entities: number;
  failed_entities: number;
  skipped_entities: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  mapping_summary?: Record<string, MappingSummaryEntry>;
  created_by_user?: { id: number; name: string };
}

export interface SelectedEntities {
  concept_sets: number[];
  cohort_definitions: number[];
  incidence_rates: number[];
  characterizations: number[];
  pathways: number[];
  estimations: number[];
  predictions: number[];
}

// ── API Calls ────────────────────────────────────────────────────────────────

export const testAtlasConnection = (data: {
  webapi_url: string;
  auth_type?: string;
  auth_credentials?: string;
}) =>
  apiClient
    .post<{ data: AtlasTestResult }>("/admin/atlas-migration/test-connection", data)
    .then((r) => r.data.data);

export const discoverAtlasEntities = (data: {
  webapi_url: string;
  auth_type?: string;
  auth_credentials?: string;
}) =>
  apiClient
    .post<{ data: AtlasDiscoveryResult }>("/admin/atlas-migration/discover", data)
    .then((r) => r.data.data);

export const startAtlasMigration = (data: {
  webapi_url: string;
  webapi_name?: string;
  auth_type?: string;
  auth_credentials?: string;
  selected_entities: SelectedEntities;
}) =>
  apiClient
    .post<{ data: AtlasMigration }>("/admin/atlas-migration/start", data)
    .then((r) => r.data.data);

export const fetchMigrationStatus = (id: number) =>
  apiClient
    .get<{ data: AtlasMigration }>(`/admin/atlas-migration/${id}/status`)
    .then((r) => r.data.data);

export const fetchMigrationHistory = () =>
  apiClient
    .get<{ data: AtlasMigration[] }>("/admin/atlas-migration/history")
    .then((r) => r.data.data);

export const retryMigration = (id: number) =>
  apiClient
    .post<{ data: AtlasMigration }>(`/admin/atlas-migration/${id}/retry`)
    .then((r) => r.data.data);
