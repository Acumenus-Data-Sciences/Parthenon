// frontend/src/features/finngen-analyses/hooks/useModuleRuns.ts
import { useQuery } from "@tanstack/react-query";
import {
  finngenApi,
  type FinnGenRunsListResponse,
} from "@/features/_finngen-foundation";
import { finngenAnalysesApi } from "../api";

export function useModuleRuns(opts: {
  analysisType?: string;
  sourceKey?: string;
  enabled?: boolean;
}) {
  return useQuery<FinnGenRunsListResponse>({
    queryKey: [
      "finngen",
      "runs",
      { analysis_type: opts.analysisType, source_key: opts.sourceKey },
    ],
    queryFn: () =>
      finngenApi.listRuns({
        analysis_type: opts.analysisType,
        source_key: opts.sourceKey,
        per_page: 50,
      }),
    enabled: opts.enabled !== false && !!opts.analysisType,
    staleTime: 10_000,
  });
}

export function useAllFinnGenRuns(opts: {
  sourceKey?: string;
  status?: string;
  page?: number;
}) {
  return useQuery<FinnGenRunsListResponse>({
    queryKey: [
      "finngen",
      "runs",
      "all",
      { source_key: opts.sourceKey, status: opts.status, page: opts.page },
    ],
    queryFn: () =>
      finngenApi.listRuns({
        source_key: opts.sourceKey,
        status: opts.status,
        page: opts.page,
        per_page: 25,
      }),
    staleTime: 10_000,
  });
}

export function useRunDisplay<T = unknown>(runId: string | null) {
  return useQuery<T>({
    queryKey: ["finngen", "runs", runId, "display"],
    queryFn: () => finngenAnalysesApi.getDisplayArtifact<T>(runId!),
    enabled: runId !== null,
    staleTime: Infinity, // display.json is immutable once written
  });
}
