import { useEffect, useState } from "react";

import { useFinnGenRun } from "@/features/_finngen-foundation";

import { useCreateReport } from "../hooks/useCreateReport";

export function ReportButton({
  sourceKey,
  conceptId,
  onRunIdChange,
}: {
  sourceKey: string;
  conceptId: number;
  onRunIdChange: (runId: string | null) => void;
}) {
  const [runId, setRunId] = useState<string | null>(null);
  const { mutateAsync, isPending, isError, resetIdempotencyKey } = useCreateReport();
  const { data: run } = useFinnGenRun(runId);

  useEffect(() => {
    onRunIdChange(runId);
  }, [runId, onRunIdChange]);

  useEffect(() => {
    if (run?.status === "failed") {
      resetIdempotencyKey();
    }
  }, [run?.status, resetIdempotencyKey]);

  const handleClick = async () => {
    const res = await mutateAsync({ sourceKey, conceptId });
    setRunId(res.id);
  };

  const canGenerate = sourceKey && conceptId;
  const running = run && ["queued", "running", "canceling"].includes(run.status);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        className="self-start rounded border border-cyan-500 bg-cyan-900/50 px-3 py-1.5 text-sm font-medium text-cyan-50 hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-40"
        disabled={!canGenerate || isPending || Boolean(running)}
        onClick={handleClick}
      >
        {isPending || running ? "Generating..." : "Generate report"}
      </button>
      {isError ? (
        <div className="text-xs text-rose-300">Failed to dispatch report.</div>
      ) : null}
      {running && run?.progress ? (
        <div className="text-xs text-slate-400">
          {run.progress.pct ?? 0}% — {run.progress.message ?? run.status}
        </div>
      ) : null}
    </div>
  );
}
