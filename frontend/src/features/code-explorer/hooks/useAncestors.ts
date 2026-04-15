import { useQuery } from "@tanstack/react-query";
import { codeExplorerApi } from "../api";
import type { AncestorDirection, AncestorsResponse } from "../types";

export function useAncestors(
  sourceKey: string | null,
  conceptId: number | null,
  direction: AncestorDirection = "both",
  maxDepth = 3,
) {
  return useQuery<AncestorsResponse>({
    queryKey: ["finngen", "code-explorer", "ancestors", sourceKey, conceptId, direction, maxDepth],
    queryFn: () => codeExplorerApi.ancestors(sourceKey!, conceptId!, direction, maxDepth),
    enabled: !!sourceKey && !!conceptId,
    staleTime: 5 * 60_000,
  });
}
