import { useState, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchProfileHistory,
  fetchProfile,
  runPersistedScan,
  deleteProfile,
  fetchComparison,
  startAsyncScan,
  subscribeScanProgress,
  completeScan,
  fetchProjectProfileHistory,
  startProjectAsyncScan,
  subscribeProjectScanProgress,
  completeProjectScan,
  deleteProjectProfile,
  type ScanProgressEvent,
  type ProfileSummary,
} from "../api";

export function useProfileHistory(sourceId: number) {
  return useQuery({
    queryKey: ["profiler", "history", sourceId],
    queryFn: () => fetchProfileHistory(sourceId),
    enabled: sourceId > 0,
    staleTime: 60_000,
  });
}

export function useProfile(sourceId: number, profileId: number) {
  return useQuery({
    queryKey: ["profiler", "detail", sourceId, profileId],
    queryFn: () => fetchProfile(sourceId, profileId),
    enabled: sourceId > 0 && profileId > 0,
  });
}

export function useRunScan(sourceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: { tables?: string[]; sample_rows?: number }) =>
      runPersistedScan(sourceId, request),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiler", "history", sourceId] });
    },
  });
}

export function useDeleteProfile(sourceId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profileId: number) => deleteProfile(sourceId, profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiler", "history", sourceId] });
    },
  });
}

export function useComparison(sourceId: number, currentId: number, baselineId: number) {
  return useQuery({
    queryKey: ["profiler", "compare", sourceId, currentId, baselineId],
    queryFn: () => fetchComparison(sourceId, currentId, baselineId),
    enabled: sourceId > 0 && currentId > 0 && baselineId > 0,
  });
}

export interface ScanProgress {
  isScanning: boolean;
  totalTables: number;
  completedTables: number;
  currentTable: string;
  tableResults: Array<{ table: string; rows: number; columns: number; elapsed_ms: number }>;
  errors: Array<{ table: string; message: string }>;
  elapsedMs: number;
}

export function useRunScanWithProgress(sourceId: number) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<ScanProgress>({
    isScanning: false,
    totalTables: 0,
    completedTables: 0,
    currentTable: "",
    tableResults: [],
    errors: [],
    elapsedMs: 0,
  });
  const [result, setResult] = useState<ProfileSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const startScan = useCallback(
    async (request: { tables?: string[]; sample_rows?: number }) => {
      setProgress({
        isScanning: true,
        totalTables: 0,
        completedTables: 0,
        currentTable: "Connecting...",
        tableResults: [],
        errors: [],
        elapsedMs: 0,
      });
      setResult(null);
      setError(null);

      try {
        const { scan_id } = await startAsyncScan(sourceId, request);

        unsubRef.current = subscribeScanProgress(
          sourceId,
          scan_id,
          (event: ScanProgressEvent) => {
            setProgress((prev) => {
              switch (event.event) {
                case "started":
                  return { ...prev, totalTables: event.total_tables ?? 0 };
                case "table_started":
                  return { ...prev, currentTable: event.table ?? "" };
                case "table_done":
                  return {
                    ...prev,
                    completedTables: event.index ?? prev.completedTables,
                    elapsedMs: event.elapsed_ms ? prev.elapsedMs + event.elapsed_ms : prev.elapsedMs,
                    tableResults: [
                      ...prev.tableResults,
                      {
                        table: event.table ?? "",
                        rows: event.rows ?? 0,
                        columns: event.columns ?? 0,
                        elapsed_ms: event.elapsed_ms ?? 0,
                      },
                    ],
                  };
                case "error":
                  return {
                    ...prev,
                    errors: [...prev.errors, { table: event.table ?? "", message: event.message ?? "" }],
                  };
                case "completed":
                case "completed_with_errors":
                  return { ...prev, isScanning: false, elapsedMs: event.total_elapsed_ms ?? prev.elapsedMs };
                default:
                  return prev;
              }
            });
          },
          async () => {
            try {
              const profile = await completeScan(sourceId, scan_id);
              setResult(profile);
              queryClient.invalidateQueries({ queryKey: ["profiler", "history", sourceId] });
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to persist scan results");
            }
            setProgress((prev) => ({ ...prev, isScanning: false }));
          },
          () => {
            setError("Lost connection to scan progress stream");
            setProgress((prev) => ({ ...prev, isScanning: false }));
          },
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to start scan");
        setProgress((prev) => ({ ...prev, isScanning: false }));
      }
    },
    [sourceId, queryClient],
  );

  const cancel = useCallback(() => {
    unsubRef.current?.();
    setProgress((prev) => ({ ...prev, isScanning: false }));
  }, []);

  return { startScan, cancel, progress, result, error };
}

// ---------------------------------------------------------------------------
// Ingestion Project Profiler Hooks
// ---------------------------------------------------------------------------

export function useProjectProfileHistory(projectId: number) {
  return useQuery({
    queryKey: ["profiler", "project-history", projectId],
    queryFn: () => fetchProjectProfileHistory(projectId),
    enabled: projectId > 0,
    staleTime: 60_000,
  });
}

export function useDeleteProjectProfile(projectId: number) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (profileId: number) => deleteProjectProfile(projectId, profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profiler", "project-history", projectId] });
    },
  });
}

export function useRunProjectScanWithProgress(projectId: number) {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<ScanProgress>({
    isScanning: false,
    totalTables: 0,
    completedTables: 0,
    currentTable: "",
    tableResults: [],
    errors: [],
    elapsedMs: 0,
  });
  const [result, setResult] = useState<ProfileSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const unsubRef = useRef<(() => void) | null>(null);

  const startScan = useCallback(
    async (request: { tables?: string[]; sample_rows?: number }) => {
      setProgress({
        isScanning: true,
        totalTables: 0,
        completedTables: 0,
        currentTable: "Connecting...",
        tableResults: [],
        errors: [],
        elapsedMs: 0,
      });
      setResult(null);
      setError(null);

      try {
        const { scan_id } = await startProjectAsyncScan(projectId, request);

        unsubRef.current = subscribeProjectScanProgress(
          projectId,
          scan_id,
          (event: ScanProgressEvent) => {
            setProgress((prev) => {
              switch (event.event) {
                case "started":
                  return { ...prev, totalTables: event.total_tables ?? 0 };
                case "table_started":
                  return { ...prev, currentTable: event.table ?? "" };
                case "table_done":
                  return {
                    ...prev,
                    completedTables: event.index ?? prev.completedTables,
                    elapsedMs: event.elapsed_ms ? prev.elapsedMs + event.elapsed_ms : prev.elapsedMs,
                    tableResults: [
                      ...prev.tableResults,
                      {
                        table: event.table ?? "",
                        rows: event.rows ?? 0,
                        columns: event.columns ?? 0,
                        elapsed_ms: event.elapsed_ms ?? 0,
                      },
                    ],
                  };
                case "error":
                  return {
                    ...prev,
                    errors: [...prev.errors, { table: event.table ?? "", message: event.message ?? "" }],
                  };
                case "completed":
                case "completed_with_errors":
                  return { ...prev, isScanning: false, elapsedMs: event.total_elapsed_ms ?? prev.elapsedMs };
                default:
                  return prev;
              }
            });
          },
          async () => {
            try {
              const profile = await completeProjectScan(projectId, scan_id);
              setResult(profile);
              queryClient.invalidateQueries({ queryKey: ["profiler", "project-history", projectId] });
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to persist scan results");
            }
            setProgress((prev) => ({ ...prev, isScanning: false }));
          },
          () => {
            setError("Lost connection to scan progress stream");
            setProgress((prev) => ({ ...prev, isScanning: false }));
          },
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to start scan");
        setProgress((prev) => ({ ...prev, isScanning: false }));
      }
    },
    [projectId, queryClient],
  );

  const cancel = useCallback(() => {
    unsubRef.current?.();
    setProgress((prev) => ({ ...prev, isScanning: false }));
  }, []);

  return { startScan, cancel, progress, result, error };
}
