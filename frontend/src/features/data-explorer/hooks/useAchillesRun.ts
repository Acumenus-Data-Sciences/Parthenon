import { useEffect, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getEcho } from "@/lib/echo";
import {
  runAchilles,
  fetchAchillesRuns,
  fetchAchillesProgress,
} from "../api/achillesRunApi";
import type { AchillesRunProgress } from "../api/achillesRunApi";

// ── Run history ──────────────────────────────────────────────────────────────

export function useAchillesRuns(sourceId: number) {
  return useQuery({
    queryKey: ["achilles", "runs", sourceId],
    queryFn: () => fetchAchillesRuns(sourceId),
    enabled: sourceId > 0,
  });
}

// ── Dispatch mutation ────────────────────────────────────────────────────────

export function useRunAchilles(sourceId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (options?: { categories?: string[]; fresh?: boolean }) =>
      runAchilles(sourceId, options),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["achilles", "runs", sourceId] });
    },
  });
}

// ── Progress with hybrid polling + Echo ──────────────────────────────────────

export function useAchillesProgress(sourceId: number, runId: string | null) {
  const qc = useQueryClient();
  // Memoize to prevent useCallback/useEffect re-firing on every render
  const queryKey = useMemo(() => ["achilles", "run-progress", sourceId, runId], [sourceId, runId]);

  // Polling fallback: 2s while active, stop when completed
  const query = useQuery({
    queryKey,
    queryFn: () => fetchAchillesProgress(sourceId, runId!),
    enabled: sourceId > 0 && runId != null,
    refetchInterval: (q) => {
      const status = q.state.data?.status;
      if (status === "completed" || status === "failed" || status === "cancelled") {
        return false;
      }
      return 2000;
    },
  });

  // Reverb listener for instant updates
  const handleStepEvent = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (event: any) => {
      // Optimistically update the cached progress data
      qc.setQueryData<AchillesRunProgress>(queryKey, (old) => {
        if (!old) return old;

        const updated = { ...old };
        updated.completed_analyses = event.completed_analyses;
        updated.failed_analyses = event.failed_analyses;

        // Update the step within its category
        updated.categories = updated.categories.map((cat) => {
          if (cat.category !== event.category) return cat;
          return {
            ...cat,
            completed: cat.steps.filter(
              (s) => s.status === "completed" || (s.analysis_id === event.analysis_id && event.status === "completed"),
            ).length,
            failed: cat.steps.filter(
              (s) => s.status === "failed" || (s.analysis_id === event.analysis_id && event.status === "failed"),
            ).length,
            running: cat.steps.filter(
              (s) => s.status === "running" && s.analysis_id !== event.analysis_id,
            ).length,
            steps: cat.steps.map((step) => {
              if (step.analysis_id !== event.analysis_id) return step;
              return {
                ...step,
                status: event.status,
                elapsed_seconds: event.elapsed_seconds,
                error_message: event.error_message,
                completed_at: event.timestamp,
              };
            }),
          };
        });

        // If all done, mark run completed
        if (updated.completed_analyses + updated.failed_analyses >= updated.total_analyses) {
          updated.status = updated.failed_analyses === updated.total_analyses ? "failed" : "completed";
        }

        return updated;
      });
    },
    [qc, queryKey],
  );

  useEffect(() => {
    if (!runId) return;

    const echo = getEcho();
    if (!echo) return;

    const channel = echo.channel(`achilles.run.${runId}`);
    channel.listen(".step.completed", handleStepEvent);

    return () => {
      echo.leave(`achilles.run.${runId}`);
    };
  }, [runId, handleStepEvent]);

  return query;
}
