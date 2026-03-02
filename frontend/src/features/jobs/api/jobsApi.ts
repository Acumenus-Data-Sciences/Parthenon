import apiClient from "@/lib/api-client";

export type JobStatus = "pending" | "queued" | "running" | "completed" | "failed" | "cancelled";
export type JobType = "cohort_generation" | "achilles" | "dqd" | "characterization" | "incidence_rate" | "pathway" | "estimation" | "prediction" | "ingestion" | "vocabulary_load";

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

export async function fetchJobs(params?: {
  status?: JobStatus;
  type?: JobType;
  page?: number;
  per_page?: number;
}): Promise<JobsResponse> {
  const { data } = await apiClient.get<JobsResponse>("/jobs", { params });
  return data;
}

export async function fetchJob(id: number): Promise<Job> {
  const { data } = await apiClient.get<Job>(`/jobs/${id}`);
  return data;
}

export async function retryJob(id: number): Promise<Job> {
  const { data } = await apiClient.post<Job>(`/jobs/${id}/retry`);
  return data;
}

export async function cancelJob(id: number): Promise<void> {
  await apiClient.post(`/jobs/${id}/cancel`);
}
