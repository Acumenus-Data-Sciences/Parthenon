import { useState } from "react";

import { useFinnGenRun } from "@/features/_finngen-foundation";
import apiClient from "@/lib/api-client";

import { ReportButton } from "./ReportButton";

export function ReportTab({
  sourceKey,
  conceptId,
  initialRunId = null,
}: {
  sourceKey: string;
  conceptId: number;
  initialRunId?: string | null;
}) {
  const [runId, setRunId] = useState<string | null>(initialRunId);
  const { data: run } = useFinnGenRun(runId);
  const artifactUrl =
    run?.status === "succeeded" && run.artifacts?.report
      ? `${apiClient.defaults.baseURL}/finngen/runs/${run.id}/artifacts/report`
      : null;

  return (
    <div className="flex flex-col gap-4">
      <ReportButton sourceKey={sourceKey} conceptId={conceptId} onRunIdChange={setRunId} />

      {run?.status === "failed" ? (
        <div className="rounded border border-rose-500/40 bg-rose-950/40 p-3 text-sm text-rose-100">
          <div className="font-medium">Report generation failed</div>
          <div className="mt-1 text-rose-200/80">
            {run.error?.category ?? "ANALYSIS_EXCEPTION"}: {run.error?.message ?? "unknown"}
          </div>
        </div>
      ) : null}

      {artifactUrl ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="text-sm text-slate-300">Report ready</div>
            <a
              href={artifactUrl}
              download
              className="rounded border border-emerald-500 bg-emerald-900/40 px-3 py-1 text-xs font-medium text-emerald-100 hover:bg-emerald-800"
            >
              Download HTML
            </a>
          </div>
          <iframe
            src={artifactUrl}
            title="ROMOPAPI report"
            className="h-[720px] w-full rounded border border-slate-700 bg-white"
            sandbox="allow-same-origin"
          />
          <div className="text-xs text-slate-500">
            Inline preview is sandboxed (scripts + cross-origin disabled). Download the file for the full interactive view in your browser.
          </div>
        </div>
      ) : null}
    </div>
  );
}
