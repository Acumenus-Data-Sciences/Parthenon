import apiClient from "@/lib/api-client";

// ── Types ────────────────────────────────────────────────────────────────────

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
export type Metadata = Record<string, Json>;

export interface CollectionSummary {
  name: string;
  count?: number;
  metadata?: Record<string, Json>;
}

export interface MetadataFacet {
  key: string;
  values: Array<{ label: string; count: number }>;
}

export interface SampleRecord {
  id: string;
  document?: string | null;
  metadata?: Metadata | null;
  embedding?: number[] | null;
}

export interface ProjectionPoint {
  id: string;
  x: number;
  y: number;
  document?: string | null;
  metadata?: Metadata | null;
}

export interface CollectionOverview {
  name: string;
  count: number;
  dimension?: number | null;
  metadataKeys: string[];
  facets: MetadataFacet[];
  sampleRecords: SampleRecord[];
  collectionMetadata?: Record<string, Json>;
}

export interface QueryResultItem {
  id: string;
  distance?: number | null;
  document?: string | null;
  metadata?: Metadata | null;
}

export interface QueryResponse {
  items: QueryResultItem[];
  elapsedMs?: number;
}

export interface QueryInput {
  collectionName: string;
  queryText: string;
  nResults: number;
  where?: Record<string, Json> | null;
  whereDocument?: Record<string, Json> | null;
}

export interface IngestResult {
  ingested?: number;
  skipped?: number;
  chunks?: number;
  total?: number;
  batches?: number;
  scanned?: number;
  promoted?: number;
}

// ── Projection Types ────────────────────────────────────────────────────────

export interface ProjectedPoint3D {
  id: string;
  x: number;
  y: number;
  z: number;
  metadata: Record<string, unknown>;
  cluster_id: number;
}

export interface ClusterInfo {
  id: number;
  label: string;
  centroid: [number, number, number];
  size: number;
}

export interface QualityReport {
  outlier_ids: string[];
  duplicate_pairs: [string, string][];
  orphan_ids: string[];
}

export interface ProjectionStats {
  total_vectors: number;
  sampled: number;
  projection_time_ms: number;
}

export interface ProjectionResponse {
  points: ProjectedPoint3D[];
  clusters: ClusterInfo[];
  quality: QualityReport;
  stats: ProjectionStats;
}

export interface ProjectionRequest {
  sample_size: number;
  method: "pca-umap";
  dimensions: 2 | 3;
}

// ── API Functions ────────────────────────────────────────────────────────────

export const fetchCollections = () =>
  apiClient.get<CollectionSummary[]>("/admin/chroma-studio/collections").then((r) => r.data);

export const fetchCollectionOverview = (name: string, includeEmbeddings = false) =>
  apiClient
    .get<CollectionOverview>(`/admin/chroma-studio/collections/${encodeURIComponent(name)}/overview`, {
      params: includeEmbeddings ? { include_embeddings: true } : undefined,
    })
    .then((r) => r.data);

export const queryCollection = (input: QueryInput) =>
  apiClient.post<QueryResponse>("/admin/chroma-studio/query", input).then((r) => r.data);

export const ingestDocs = () =>
  apiClient.post<IngestResult>("/admin/chroma-studio/ingest-docs").then((r) => r.data);

export const ingestClinical = (limit?: number) =>
  apiClient
    .post<IngestResult>("/admin/chroma-studio/ingest-clinical", null, {
      params: limit ? { limit } : undefined,
    })
    .then((r) => r.data);

export const promoteFaq = (days = 7) =>
  apiClient
    .post<IngestResult>("/admin/chroma-studio/promote-faq", null, { params: { days } })
    .then((r) => r.data);

export const ingestOhdsiPapers = () =>
  apiClient.post<IngestResult>("/admin/chroma-studio/ingest-ohdsi-papers").then((r) => r.data);

export const ingestOhdsiKnowledge = () =>
  apiClient.post<Record<string, IngestResult>>("/admin/chroma-studio/ingest-ohdsi-knowledge").then((r) => r.data);

export const fetchProjection = (
  name: string,
  request: ProjectionRequest & { refresh?: boolean },
  signal?: AbortSignal,
) =>
  apiClient
    .post<ProjectionResponse>(`/admin/chroma-studio/collections/${encodeURIComponent(name)}/project`, request, {
      signal,
      timeout: 130_000,
    })
    .then((r) => r.data);
