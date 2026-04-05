import apiClient from "@/lib/api-client";

export type JobStatus = "pending" | "queued" | "running" | "completed" | "failed" | "cancelled";
export type JobType =
  | "cohort_generation"
  | "achilles"
  | "dqd"
  | "characterization"
  | "incidence_rate"
  | "pathway"
  | "estimation"
  | "prediction"
  | "sccs"
  | "evidence_synthesis"
  | "ingestion"
  | "vocabulary_load"
  | "fhir_export"
  | "fhir_sync"
  | "gis_import"
  | "gis_boundary"
  | "genomic_parse"
  | "heel"
  | "care_gap"
  | "poseidon"
  | "analysis";

export interface JobActions {
  retry: boolean;
  cancel: boolean;
}

export interface Job {
  id: number;
  type: JobType;
  name: string;
  status: JobStatus;
  source_name: string | null;
  triggered_by: string | null;
  progress: number;
  started_at: string | null;
  completed_at: string | null;
  duration: string | null;
  error_message: string | null;
  log_output: string | null;
  created_at: string;
  actions: JobActions;
}

export interface TimelineEntry {
  timestamp: string;
  level: string;
  message: string;
}

export interface JobDetail extends Job {
  details: Record<string, unknown>;
  timeline: TimelineEntry[];
}

export interface JobsResponse {
  data: Job[];
  meta: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
  };
}

export type JobScope = "recent" | "archived" | "all";

export async function fetchJobs(params?: {
  status?: JobStatus;
  type?: JobType;
  scope?: JobScope;
  page?: number;
  per_page?: number;
}): Promise<JobsResponse> {
  const { data } = await apiClient.get<JobsResponse>("/jobs", { params });
  return data;
}

export async function fetchJob(id: number, type: JobType): Promise<JobDetail> {
  if (id == null) {
    throw new Error("Job id is required");
  }
  const { data } = await apiClient.get<JobDetail>(`/jobs/${id}`, { params: { type } });
  return data;
}

export async function retryJob(id: number, type: JobType): Promise<Job> {
  const { data } = await apiClient.post<Job>(`/jobs/${id}/retry`, undefined, { params: { type } });
  return data;
}

export async function cancelJob(id: number, type: JobType): Promise<void> {
  await apiClient.post(`/jobs/${id}/cancel`, undefined, { params: { type } });
}
