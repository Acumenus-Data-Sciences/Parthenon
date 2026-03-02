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

export async function fetchDashboardStats(): Promise<DashboardStats> {
  // Fetch multiple endpoints in parallel for the dashboard
  const [sourcesRes, cohortsRes, conceptSetsRes] = await Promise.allSettled([
    apiClient.get<Source[]>("/sources"),
    apiClient.get<{ data: unknown[]; meta?: { total: number } }>("/cohort-definitions?per_page=5&sort=-updated_at"),
    apiClient.get<{ data: unknown[]; total?: number }>("/concept-sets?per_page=1"),
  ]);

  const sources = sourcesRes.status === "fulfilled" ? sourcesRes.value.data : [];

  const cohortsData = cohortsRes.status === "fulfilled" ? cohortsRes.value.data : { data: [], meta: { total: 0 } };
  const cohortCount = (cohortsData as { meta?: { total: number } }).meta?.total ?? 0;
  const recentCohorts = ((cohortsData as { data: Array<{ id: number; name: string; status?: string; person_count?: number | null; updated_at: string }> }).data ?? []).slice(0, 5).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status ?? "draft",
    person_count: c.person_count ?? null,
    updated_at: c.updated_at,
  }));

  const conceptSetsData = conceptSetsRes.status === "fulfilled" ? conceptSetsRes.value.data : { total: 0 };
  const conceptSetCount = (conceptSetsData as { total?: number }).total ?? 0;

  return {
    sources: sources as Source[],
    cohortCount,
    conceptSetCount,
    activeJobCount: 0,
    dqdFailures: 0,
    recentCohorts,
    recentJobs: [],
  };
}
