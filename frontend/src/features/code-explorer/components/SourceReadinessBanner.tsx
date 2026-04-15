import { useEffect } from "react";

import { useFinnGenRun } from "@/features/_finngen-foundation";

import { useInitializeSource } from "../hooks/useInitializeSource";
import { useSourceReadiness } from "../hooks/useSourceReadiness";

export function SourceReadinessBanner({ sourceKey }: { sourceKey: string }) {
  const { data: readiness, refetch } = useSourceReadiness(sourceKey);
  const initMutation = useInitializeSource();
  const activeRunId = readiness?.setup_run_id ?? initMutation.data?.id ?? null;
  const { data: run } = useFinnGenRun(activeRunId);

  useEffect(() => {
    if (run?.status === "succeeded") {
      void refetch();
    }
  }, [run?.status, refetch]);

  if (!readiness) return null;
  if (readiness.ready) return null;

  if (activeRunId && run && run.status !== "succeeded") {
    const pct = run.progress?.pct ?? 0;
    const msg = run.progress?.message ?? run.status;
    return (
      <div className="rounded border border-cyan-500/40 bg-cyan-950/40 p-3 text-sm text-cyan-100">
        <div className="font-medium">Setting up {sourceKey}...</div>
        <div className="mt-1 text-cyan-200/80">
          {pct}% — {msg}
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded bg-cyan-950">
          <div
            className="h-full bg-cyan-400 transition-[width] duration-500"
            style={{ width: `${Math.max(2, pct)}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded border border-amber-500/40 bg-amber-950/40 p-3 text-sm text-amber-100">
      <div className="font-medium">Source {sourceKey} needs initialization</div>
      <div className="mt-1 text-amber-200/80">
        Missing: {readiness.missing.join(", ")}. This is an admin-only one-time
        setup that materializes the stratified code counts table.
      </div>
      <button
        type="button"
        className="mt-2 rounded border border-amber-400 bg-amber-900/60 px-3 py-1 text-xs font-medium text-amber-50 hover:bg-amber-800"
        disabled={initMutation.isPending}
        onClick={() => initMutation.mutate({ sourceKey })}
      >
        {initMutation.isPending ? "Dispatching..." : "Initialize source"}
      </button>
      {initMutation.isError ? (
        <div className="mt-2 text-rose-300">
          Failed to dispatch. You may lack the `finngen.code-explorer.setup` permission.
        </div>
      ) : null}
    </div>
  );
}
