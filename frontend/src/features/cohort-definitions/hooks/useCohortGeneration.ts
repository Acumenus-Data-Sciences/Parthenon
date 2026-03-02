import { useQuery } from "@tanstack/react-query";
import { getCohortGeneration, previewCohortSql } from "../api/cohortApi";

/**
 * Polls a single cohort generation every 2 seconds while its status is
 * running or queued. Stops polling once the generation reaches a terminal
 * state (completed, failed, cancelled).
 */
export function useCohortGeneration(
  defId: number | null,
  genId: number | null,
) {
  return useQuery({
    queryKey: ["cohort-definitions", defId, "generations", genId],
    queryFn: () => getCohortGeneration(defId!, genId!),
    enabled: defId != null && defId > 0 && genId != null && genId > 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "running" || status === "queued" || status === "pending") {
        return 2000;
      }
      return false;
    },
  });
}

/**
 * Preview the SQL that would be generated for a cohort definition against a
 * specific data source.
 */
export function usePreviewSql(
  defId: number | null,
  sourceId: number | null,
) {
  return useQuery({
    queryKey: ["cohort-definitions", defId, "sql", sourceId],
    queryFn: () => previewCohortSql(defId!, { source_id: sourceId! }),
    enabled:
      defId != null && defId > 0 && sourceId != null && sourceId > 0,
  });
}
