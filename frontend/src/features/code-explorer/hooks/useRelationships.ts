import { useQuery } from "@tanstack/react-query";
import { codeExplorerApi } from "../api";
import type { RelationshipsResponse } from "../types";

export function useRelationships(sourceKey: string | null, conceptId: number | null) {
  return useQuery<RelationshipsResponse>({
    queryKey: ["finngen", "code-explorer", "relationships", sourceKey, conceptId],
    queryFn: () => codeExplorerApi.relationships(sourceKey!, conceptId!),
    enabled: !!sourceKey && !!conceptId,
    staleTime: 5 * 60_000,
  });
}
