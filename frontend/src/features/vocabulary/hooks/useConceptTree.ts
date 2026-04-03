import { useQuery } from "@tanstack/react-query";
import { fetchConceptTreeChildren } from "../api/vocabularyApi";

export function useConceptTree(parentConceptId: number, domainId?: string) {
  return useQuery({
    queryKey: ["vocabulary", "tree", parentConceptId, domainId],
    queryFn: () => fetchConceptTreeChildren(parentConceptId, domainId),
  });
}
