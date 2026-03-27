import { useQuery, useQueries } from "@tanstack/react-query";
import {
  getConceptPhoebe,
  type HecatePhoebeRecommendation,
} from "@/features/vocabulary/api/hecateApi";

// ---------------------------------------------------------------------------
// Single-concept Phoebe recommendations
// ---------------------------------------------------------------------------

export function usePhoebeRecommendations(conceptId: number | null) {
  return useQuery({
    queryKey: ["phoebe", "recommendations", conceptId],
    queryFn: async (): Promise<HecatePhoebeRecommendation[]> => {
      try {
        return await getConceptPhoebe(conceptId!);
      } catch {
        return [];
      }
    },
    enabled: conceptId != null,
    staleTime: 5 * 60 * 1000,
  });
}

// ---------------------------------------------------------------------------
// Aggregated Phoebe recommendations across multiple concepts
// ---------------------------------------------------------------------------

const MAX_CONCEPT_IDS = 20;

export function useAggregatedPhoebeRecommendations(conceptIds: number[]) {
  const limitedIds = conceptIds.slice(0, MAX_CONCEPT_IDS);
  const inputSet = new Set(conceptIds);

  const results = useQueries({
    queries: limitedIds.map((id) => ({
      queryKey: ["phoebe", "recommendations", id],
      queryFn: async (): Promise<HecatePhoebeRecommendation[]> => {
        try {
          return await getConceptPhoebe(id);
        } catch {
          return [];
        }
      },
      staleTime: 5 * 60 * 1000,
    })),
  });

  const isLoading = results.some((r) => r.isLoading);
  const isError = results.every((r) => r.isError) && results.length > 0;

  // Aggregate: dedup by concept_id keeping highest score, exclude input concepts
  const scoreMap = new Map<number, HecatePhoebeRecommendation>();

  for (const result of results) {
    if (!result.data) continue;
    for (const rec of result.data) {
      if (inputSet.has(rec.concept_id)) continue;
      const existing = scoreMap.get(rec.concept_id);
      if (!existing || rec.score > existing.score) {
        scoreMap.set(rec.concept_id, rec);
      }
    }
  }

  const data = Array.from(scoreMap.values()).sort((a, b) => b.score - a.score);

  return { data, isLoading, isError };
}
