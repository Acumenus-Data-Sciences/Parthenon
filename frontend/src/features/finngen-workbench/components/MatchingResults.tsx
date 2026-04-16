// frontend/src/features/finngen-workbench/components/MatchingResults.tsx
//
// SP4 Phase D.2 + Polish 5 — polling results view for cohort.match runs.
// Renders three panels when the run succeeds:
//   1. HadesExtras counts table (cohortId / name / entries / subjects)
//   2. Attrition waterfall (primary input → comparator input(s) → matched
//      output(s)) — horizontal bar chart of step counts
//   3. SMD diagnostics table — per covariate (age_years, pct_female) and
//      per comparator, shows mean_primary / mean_comparator pre+post +
//      SMD pre vs post (color-coded: green |SMD|<0.1, amber <0.25, red ≥0.25).
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

type WaterfallRow = {
  step: "primary_input" | "comparator_input" | "matched_output" | string;
  label: string;
  count: number | null;
  cohort_id?: number | null;
  ratio?: number;
};

type SmdRow = {
  covariate: string;
  comparator_id: number;
  mean_primary: number | null;
  mean_comparator_pre: number | null;
  mean_comparator_post: number | null;
  smd_pre: number | null;
  smd_post: number | null;
  n_primary: number | null;
  n_comparator_pre: number | null;
  n_comparator_post: number | null;
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
  const summary = (data as unknown as {
    summary?: { counts?: CountRow[]; waterfall?: WaterfallRow[]; smd?: SmdRow[] };
  }).summary;
  const counts: CountRow[] = Array.isArray(summary?.counts) ? summary.counts : [];
  const waterfall: WaterfallRow[] = Array.isArray(summary?.waterfall) ? summary.waterfall : [];
  const smd: SmdRow[] = Array.isArray(summary?.smd) ? summary.smd : [];

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

      {/* Polish 5 — attrition waterfall */}
      {waterfall.length > 0 && <WaterfallChart rows={waterfall} />}

      {/* Polish 5 — SMD diagnostics */}
      {smd.length > 0 && <SmdTable rows={smd} />}
    </div>
  );
}

// SP4 Polish 5 — attrition waterfall (horizontal bar chart). Primary input
// sets the scale; each comparator + matched row renders a bar proportional
// to its share of the primary size.
function WaterfallChart({ rows }: { rows: WaterfallRow[] }) {
  const maxCount = Math.max(1, ...rows.map((r) => r.count ?? 0));
  return (
    <div className="space-y-1.5 rounded border border-border-default bg-surface-overlay/30 p-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-text-ghost">
        Attrition waterfall
      </h3>
      <ol className="space-y-1">
        {rows.map((row, idx) => {
          const n = row.count ?? 0;
          const width = Math.max(2, Math.round((n / maxCount) * 100));
          const color =
            row.step === "primary_input"
              ? "bg-info"
              : row.step === "matched_output"
              ? "bg-success"
              : "bg-warning";
          return (
            <li key={idx} className="flex items-center gap-2 text-xs">
              <span className="w-48 truncate text-text-secondary" title={row.label}>
                {row.label}
              </span>
              <div className="relative flex-1">
                <div
                  className={["h-3 rounded", color].join(" ")}
                  style={{ width: `${width}%` }}
                />
              </div>
              <span className="w-16 text-right font-mono text-text-secondary">
                {n.toLocaleString()}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

// SP4 Polish 5 — SMD diagnostics table. Color-codes each SMD cell:
//   |SMD| < 0.10 → green (well balanced)
//   |SMD| < 0.25 → amber (moderate imbalance)
//   |SMD| ≥ 0.25 → red   (material imbalance)
function SmdTable({ rows }: { rows: SmdRow[] }) {
  return (
    <div className="rounded border border-border-default bg-surface-overlay/30 p-3 space-y-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-wide text-text-ghost">
        Covariate balance (SMD)
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-border-default text-left text-text-ghost">
              <th className="px-2 py-1.5">Covariate</th>
              <th className="px-2 py-1.5 text-right">Comparator #</th>
              <th className="px-2 py-1.5 text-right">Primary</th>
              <th className="px-2 py-1.5 text-right">Cmp (pre)</th>
              <th className="px-2 py-1.5 text-right">Cmp (post)</th>
              <th className="px-2 py-1.5 text-right">SMD pre</th>
              <th className="px-2 py-1.5 text-right">SMD post</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className="border-b border-border-default/50">
                <td className="px-2 py-1.5 text-text-primary">{r.covariate}</td>
                <td className="px-2 py-1.5 text-right font-mono text-text-secondary">
                  {r.comparator_id}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-text-secondary">
                  {formatStat(r.covariate, r.mean_primary)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-text-secondary">
                  {formatStat(r.covariate, r.mean_comparator_pre)}
                </td>
                <td className="px-2 py-1.5 text-right font-mono text-text-secondary">
                  {formatStat(r.covariate, r.mean_comparator_post)}
                </td>
                <td className={`px-2 py-1.5 text-right font-mono ${smdColor(r.smd_pre)}`}>
                  {formatSmd(r.smd_pre)}
                </td>
                <td className={`px-2 py-1.5 text-right font-mono ${smdColor(r.smd_post)}`}>
                  {formatSmd(r.smd_post)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-text-ghost">
        SMD color: <span className="text-success">green</span> &lt; 0.10 ·{" "}
        <span className="text-warning">amber</span> &lt; 0.25 ·{" "}
        <span className="text-error">red</span> ≥ 0.25.
      </p>
    </div>
  );
}

function formatStat(covariate: string, v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  if (covariate === "pct_female") return `${(v * 100).toFixed(1)}%`;
  return v.toFixed(1);
}

function formatSmd(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toFixed(3);
}

function smdColor(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "text-text-ghost";
  const abs = Math.abs(v);
  if (abs < 0.1) return "text-success";
  if (abs < 0.25) return "text-warning";
  return "text-error";
}
