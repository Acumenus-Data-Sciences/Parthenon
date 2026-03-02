import { useQuery } from "@tanstack/react-query";
import { getConceptHierarchy } from "../api/vocabularyApi";

export function useConceptHierarchy(conceptId: number | null) {
  return useQuery({
    queryKey: ["vocabulary", "hierarchy", conceptId],
    queryFn: () => getConceptHierarchy(conceptId!),
    enabled: conceptId != null && conceptId > 0,
  });
}
