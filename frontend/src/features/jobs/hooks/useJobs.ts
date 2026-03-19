import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchJobs, fetchJob, retryJob, cancelJob, type JobStatus, type JobType, type JobScope } from "../api/jobsApi";

export function useJobs(params?: { status?: JobStatus; type?: JobType; scope?: JobScope; page?: number }) {
  return useQuery({
    queryKey: ["jobs", params],
    queryFn: () => fetchJobs({ per_page: 50, ...params }),
    refetchInterval: (query) => {
      const jobs = query.state.data?.data;
      const hasActive = jobs?.some(
        (j) => j.status === "running" || j.status === "queued" || j.status === "pending",
      );
      return hasActive ? 1_000 : 10_000;
    },
  });
}

export function useJob(id: number | null) {
  return useQuery({
    queryKey: ["jobs", id],
    queryFn: () => fetchJob(id!),
    enabled: id != null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "running" || status === "queued" || status === "pending" ? 1_000 : false;
    },
  });
}

export function useRetryJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: retryJob,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useCancelJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: cancelJob,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["jobs"] }),
  });
}
