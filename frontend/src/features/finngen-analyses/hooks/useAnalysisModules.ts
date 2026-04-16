// frontend/src/features/finngen-analyses/hooks/useAnalysisModules.ts
import { useQuery } from "@tanstack/react-query";
import { finngenAnalysesApi } from "../api";
import type { FinnGenAnalysisModule } from "@/features/_finngen-foundation";

export function useAnalysisModules() {
  return useQuery<FinnGenAnalysisModule[]>({
    queryKey: ["finngen", "analysis-modules"],
    queryFn: async () => {
      const res = await finngenAnalysesApi.listModules();
      return res.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes — matches server-side cache TTL
  });
}

export function useAnalysisModule(key: string | null) {
  return useQuery<FinnGenAnalysisModule>({
    queryKey: ["finngen", "analysis-modules", key],
    queryFn: async () => {
      const res = await finngenAnalysesApi.getModule(key!);
      return res.data;
    },
    enabled: key !== null,
    staleTime: 5 * 60 * 1000,
  });
}
