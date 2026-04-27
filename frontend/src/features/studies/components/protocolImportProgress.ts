import { useEffect, useMemo, useState } from "react";

export type ProtocolImportPhase = "idle" | "uploading" | "analyzing" | "output" | "error";

interface ProtocolImportPhaseInput {
  isPending: boolean;
  elapsedSeconds: number;
  completedAt?: number | null;
  failedAt?: number | null;
}

export function useProtocolImportElapsed(startedAt: number | null, endedAt?: number | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (startedAt === null || endedAt != null) return undefined;

    const intervalId = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, [endedAt, startedAt]);

  return useMemo(() => {
    if (startedAt === null) return 0;
    return Math.max(0, Math.round(((endedAt ?? now) - startedAt) / 1000));
  }, [endedAt, now, startedAt]);
}

export function getProtocolImportPhase({
  isPending,
  elapsedSeconds,
  completedAt,
  failedAt,
}: ProtocolImportPhaseInput): ProtocolImportPhase {
  if (failedAt != null) return "error";
  if (completedAt != null) return "output";
  if (!isPending) return "idle";
  return elapsedSeconds < 2 ? "uploading" : "analyzing";
}
