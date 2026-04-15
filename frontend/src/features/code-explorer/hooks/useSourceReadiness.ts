import { useQuery } from "@tanstack/react-query";
import { codeExplorerApi } from "../api";
import type { SourceReadiness } from "../types";

export function useSourceReadiness(sourceKey: string | null) {
  return useQuery<SourceReadiness>({
    queryKey: ["finngen", "code-explorer", "source-readiness", sourceKey],
    queryFn: () => codeExplorerApi.sourceReadiness(sourceKey!),
    enabled: !!sourceKey,
    staleTime: 15_000,
  });
}
