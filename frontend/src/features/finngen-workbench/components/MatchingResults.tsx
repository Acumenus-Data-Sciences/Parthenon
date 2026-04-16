// frontend/src/features/finngen-workbench/components/MatchingResults.tsx
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { useMatchRunStatus } from "../hooks/useMatchCohort";

interface MatchingResultsProps {
  runId: string | null;
  cohortNames?: Record<number, string>;
}

type CountRow = {
  cohortId?: number;
  cohort_id?: number;
  cohortName?: string;
  cohort_name?: string;
  cohortEntries?: number;
  cohort_entries?: number;
  cohortSubjects?: number;
  cohort_subjects?: number;
};

export function MatchingResults({ runId, cohortNames }: MatchingResultsProps) {
  const { data, isPending, isError } = useMatchRunStatus(runId);

  if (runId === null) {
    return (
      <div className="rounded border border-dashed border-border-default p-6 text-center text-xs text-text-ghost">
        Configure matching parameters and click Run to see results here.
      </div>
    );
  }

  if (isPending && data === undefined) {
    return (
      <div className="flex items-center gap-2 rounded border border-border-default bg-surface-raised p-4 text-xs text-text-secondary">
        <Loader2 size={14} className="animate-spin" />
        Loading run...
      </div>
    );
  }

  if (isError || data === undefined) {
    return (
      <div className="flex items-center gap-2 rounded border border-error/40 bg-error/5 p-4 text-xs text-error">
        <AlertCircle size={14} /> Could not load run status.
      </div>
    );
  }

  const status = data.status;
  const isRunning = status === "queued" || status === "running";
  const isFailed = status === "failed" || status === "canceled";
  const isDone = status === "succeeded";

  // Counts from the cohort.match worker live in summary.counts (HadesExtras
  // returns a tibble; jsonlite serializes it as an array of row objects).
  const summary = (data as unknown as { summary?: { counts?: CountRow[] } }).summary;
  const counts: CountRow[] = Array.isArray(summary?.counts) ? summary.counts : [];

  return (
    <div className="space-y-3 rounded border border-border-default bg-surface-raised p-4">
      <div className="flex items-center gap-2 text-xs">
        {isRunning && <Loader2 size={14} className="animate-spin text-info" />}
        {isDone && <CheckCircle2 size={14} className="text-success" />}
        {isFailed && <AlertCircle size={14} className="text-error" />}
        <span className={isFailed ? "text-error" : "text-text-secondary"}>
          Status: <span className="font-mono">{status}</span>
        </span>
        {isRunning && <span className="text-text-ghost">— polling every 2s</span>}
      </div>

      {isFailed && (
        <p className="text-xs text-error">
          {(data as unknown as { error?: { message?: string } }).error?.message ?? "Run failed."}
        </p>
      )}

      {isDone && counts.length === 0 && (
        <p className="text-xs text-text-ghost">Match completed but no count rows were emitted.</p>
      )}

      {counts.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border-default text-left text-text-ghost">
                <th className="px-2 py-1.5">Cohort</th>
                <th className="px-2 py-1.5">Name</th>
                <th className="px-2 py-1.5 text-right">Entries</th>
                <th className="px-2 py-1.5 text-right">Subjects</th>
              </tr>
            </thead>
            <tbody>
              {counts.map((row, idx) => {
                const cid = row.cohortId ?? row.cohort_id ?? null;
                const name = row.cohortName ?? row.cohort_name ?? (cid !== null ? cohortNames?.[cid] : undefined) ?? "—";
                const entries = row.cohortEntries ?? row.cohort_entries ?? 0;
                const subjects = row.cohortSubjects ?? row.cohort_subjects ?? 0;
                return (
                  <tr key={idx} className="border-b border-border-default/50">
                    <td className="px-2 py-1.5 font-mono text-text-secondary">{cid ?? "—"}</td>
                    <td className="px-2 py-1.5 text-text-primary">{name}</td>
                    <td className="px-2 py-1.5 text-right font-mono text-text-secondary">
                      {entries.toLocaleString()}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono text-text-secondary">
                      {subjects.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
