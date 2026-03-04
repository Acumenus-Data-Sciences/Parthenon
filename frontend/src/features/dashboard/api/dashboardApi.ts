import apiClient from "@/lib/api-client";
import type { Source } from "@/types/models";

export interface DashboardStats {
  sources: Source[];
  cohortCount: number;
  conceptSetCount: number;
  activeJobCount: number;
  dqdFailures: number;
  recentCohorts: Array<{
    id: number;
    name: string;
    status: string;
    person_count: number | null;
    updated_at: string;
  }>;
  recentJobs: Array<{
    id: number;
    name: string;
    type: string;
    status: string;
    progress: number;
    started_at: string | null;
    duration: string | null;
  }>;
}

/**
 * Unified dashboard stats — single API call replaces 3+N frontend requests.
 */
export async function fetchDashboardStats(): Promise<DashboardStats> {
  const { data } = await apiClient.get("/dashboard/stats");
  const d = data.data ?? data;

  const sources: Source[] = Array.isArray(d.sources) ? d.sources : [];

  return {
    sources,
    cohortCount: d.cohort_count ?? 0,
    conceptSetCount: d.concept_set_count ?? 0,
    activeJobCount: d.active_job_count ?? 0,
    dqdFailures: d.dqd_failures ?? 0,
    recentCohorts: (d.recent_cohorts ?? []).map((c: Record<string, unknown>) => ({
      id: c.id,
      name: c.name,
      status: c.status ?? "draft",
      person_count: c.person_count ?? null,
      updated_at: c.updated_at,
    })),
    recentJobs: d.recent_jobs ?? [],
  };
}
