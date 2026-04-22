import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { useFinnGenRun } from "@/features/_finngen-foundation";

import { useInitializeSource } from "../hooks/useInitializeSource";
import { useSourceReadiness } from "../hooks/useSourceReadiness";

export function SourceReadinessBanner({ sourceKey }: { sourceKey: string }) {
  const { t } = useTranslation("app");
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
        <div className="font-medium">
          {t("codeExplorer.sourceReadiness.settingUp", { sourceKey })}
        </div>
        <div className="mt-1 text-cyan-200/80">
          {t("codeExplorer.reports.progress", { percent: pct, message: msg })}
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
      <div className="font-medium">
        {t("codeExplorer.sourceReadiness.sourceNeedsInitialization", {
          sourceKey,
        })}
      </div>
      <div className="mt-1 text-amber-200/80">
        {t("codeExplorer.sourceReadiness.missing", {
          missing: readiness.missing.join(", "),
        })}
      </div>
      <button
        type="button"
        className="mt-2 rounded border border-amber-400 bg-amber-900/60 px-3 py-1 text-xs font-medium text-amber-50 hover:bg-amber-800"
        disabled={initMutation.isPending}
        onClick={() => initMutation.mutate({ sourceKey })}
      >
        {initMutation.isPending
          ? t("codeExplorer.sourceReadiness.dispatching")
          : t("codeExplorer.sourceReadiness.initializeSource")}
      </button>
      {initMutation.isError ? (
        <div className="mt-2 text-rose-300">
          {t("codeExplorer.sourceReadiness.failedToDispatch")}
        </div>
      ) : null}
    </div>
  );
}
