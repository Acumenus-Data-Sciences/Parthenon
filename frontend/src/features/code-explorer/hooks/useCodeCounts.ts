import { useQuery } from "@tanstack/react-query";
import { codeExplorerApi } from "../api";
import type { CodeCountsResponse } from "../types";

export function useCodeCounts(sourceKey: string | null, conceptId: number | null) {
  return useQuery<CodeCountsResponse>({
    queryKey: ["finngen", "code-explorer", "counts", sourceKey, conceptId],
    queryFn: () => codeExplorerApi.counts(sourceKey!, conceptId!),
    enabled: !!sourceKey && !!conceptId,
    staleTime: 30_000,
    retry: false,
  });
}
