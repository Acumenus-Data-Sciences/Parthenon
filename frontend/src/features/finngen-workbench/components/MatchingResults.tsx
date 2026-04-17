// frontend/src/features/finngen-workbench/components/MatchingResults.tsx
//
// Polling results view for cohort.match runs. Renders (in reading order):
//   1. Status strip  — queued / running / succeeded / failed + run id
//   2. Promote CTA   — save matched controls as a first-class cohort
//   3. Headline KPIs — primary N, comparator N (pooled), matched N (pooled)
//   4. Counts table  — one row per cohort the match touched (entries/subjects)
//   5. Attrition waterfall — primary → comparator inputs → matched outputs
//   6. SMD diagnostics     — covariate × comparator, pre vs post
import { AlertCircle, Award, CheckCheck, Clock, Loader2 } from "lucide-react";
import { useFinnGenRunStatus } from "../hooks/useFinnGenRunStatus";
import { usePromoteMatchedCohort } from "../hooks/usePromoteMatchedCohort";
import type { MatchedCohortPromotion } from "../types";
import { Panel, Shell, StatusStrip } from "@/components/workbench/primitives";

interface MatchingResultsProps {
  runId: string | null;
  cohortNames?: Record<number, string>;
  /** SP4 Phase D.3 — existing promotion for this run, if any. */
  promotion?: MatchedCohortPromotion;
  /** Called when the user promotes a succeeded match into a cohort_definition. */
  onPromote?: (promotion: MatchedCohortPromotion) => void;
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

const SHELL_TITLE = "Matching results";
const SHELL_SUBTITLE = "Status, balance diagnostics, and attrition for the current run.";

export function MatchingResults({
  runId,
  cohortNames,
  promotion,
  onPromote,
}: MatchingResultsProps) {
  const { data, isPending, isError } = useFinnGenRunStatus(runId);

  if (runId === null) {
    return (
      <Shell title={SHELL_TITLE} subtitle={SHELL_SUBTITLE}>
        <EmptyState />
      </Shell>
    );
  }

  if (isPending && data === undefined) {
    return (
      <Shell title={SHELL_TITLE} subtitle={SHELL_SUBTITLE}>
        <div className="flex items-center gap-2 p-4 text-xs text-text-secondary">
          <Loader2 size={14} className="animate-spin" />
          Loading run…
        </div>
      </Shell>
    );
  }

  if (isError || data === undefined) {
    return (
      <Shell title={SHELL_TITLE} subtitle={SHELL_SUBTITLE}>
        <div className="flex items-center gap-2 p-4 text-xs text-error">
          <AlertCircle size={14} /> Could not load run status.
        </div>
      </Shell>
    );
  }

  const status = data.status;
  const isRunning = status === "queued" || status === "running";
  const isFailed = status === "failed" || status === "canceled";
  const isDone = status === "succeeded";

  const summary = (
    data as unknown as {
      summary?: { counts?: CountRow[]; waterfall?: WaterfallRow[]; smd?: SmdRow[] };
    }
  ).summary;
  const counts: CountRow[] = Array.isArray(summary?.counts) ? summary.counts : [];
  const waterfall: WaterfallRow[] = Array.isArray(summary?.waterfall) ? summary.waterfall : [];
  const smd: SmdRow[] = Array.isArray(summary?.smd) ? summary.smd : [];

  const kpis = computeKpis(waterfall);

  return (
    <Shell title={SHELL_TITLE} subtitle={SHELL_SUBTITLE}>
      <StatusStrip status={status} runId={data.id} />

      {isFailed && (
        <div className="mx-4 mb-4 flex items-start gap-2 rounded border border-error/40 bg-error/5 p-3 text-xs text-error">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <span>
            {(data as unknown as { error?: { message?: string } }).error?.message ??
              "Run failed."}
          </span>
        </div>
      )}

      {isRunning && (
        <div className="px-4 pb-4 text-xs text-text-ghost">
          Matching in progress. Results appear here once complete.
        </div>
      )}

      {isDone && (
        <div className="space-y-4 px-4 pb-4">
          <PromoteCta
            runId={runId}
            promotion={promotion}
            onPromote={onPromote}
            primaryCohortId={
              (waterfall.find((r) => r.step === "primary_input")?.cohort_id as
                | number
                | undefined) ?? null
            }
          />

          {kpis && <KpiRow kpis={kpis} />}

          {counts.length === 0 && (
            <p className="text-xs text-text-ghost">
              Match completed but no count rows were emitted.
            </p>
          )}

          {counts.length > 0 && (
            <Panel label="Cohorts in this match">
              <CountsTable rows={counts} cohortNames={cohortNames} />
            </Panel>
          )}

          {waterfall.length > 0 && (
            <Panel label="Attrition waterfall">
              <WaterfallChart rows={waterfall} />
            </Panel>
          )}

          {smd.length > 0 && (
            <Panel label="Covariate balance (SMD)">
              <SmdTable rows={smd} />
            </Panel>
          )}
        </div>
      )}
    </Shell>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <div className="rounded-full border border-dashed border-border-default p-3 text-text-ghost">
        <Clock size={18} />
      </div>
      <p className="text-xs text-text-secondary">No run yet.</p>
      <p className="text-[10px] text-text-ghost">
        Configure matching on the left and press <span className="font-mono">Run matching</span>.
      </p>
    </div>
  );
}

function computeKpis(waterfall: WaterfallRow[]): {
  primary: number;
  comparators: number;
  matched: number;
  rate: number | null;
} | null {
  if (waterfall.length === 0) return null;
  const primary = waterfall
    .filter((r) => r.step === "primary_input")
    .reduce((acc, r) => acc + (r.count ?? 0), 0);
  const comparators = waterfall
    .filter((r) => r.step === "comparator_input")
    .reduce((acc, r) => acc + (r.count ?? 0), 0);
  const matched = waterfall
    .filter((r) => r.step === "matched_output")
    .reduce((acc, r) => acc + (r.count ?? 0), 0);
  const rate = comparators > 0 ? matched / comparators : null;
  return { primary, comparators, matched, rate };
}

function KpiRow({
  kpis,
}: {
  kpis: { primary: number; comparators: number; matched: number; rate: number | null };
}) {
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      <Kpi label="Primary (cases)" value={kpis.primary.toLocaleString()} tone="info" />
      <Kpi
        label="Comparators (input)"
        value={kpis.comparators.toLocaleString()}
        tone="warning"
      />
      <Kpi label="Matched (output)" value={kpis.matched.toLocaleString()} tone="success" />
      <Kpi
        label="Match rate"
        value={kpis.rate === null ? "—" : `${(kpis.rate * 100).toFixed(1)}%`}
        tone="neutral"
      />
    </div>
  );
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "info" | "warning" | "success" | "neutral";
}) {
  const accent = {
    info: "border-l-info",
    warning: "border-l-warning",
    success: "border-l-success",
    neutral: "border-l-border-default",
  }[tone];
  return (
    <div
      className={`rounded border border-border-default border-l-2 bg-surface-overlay/30 px-3 py-2 ${accent}`}
    >
      <div className="text-[10px] uppercase tracking-wide text-text-ghost">{label}</div>
      <div className="mt-0.5 font-mono text-sm text-text-primary">{value}</div>
    </div>
  );
}

function CountsTable({
  rows,
  cohortNames,
}: {
  rows: CountRow[];
  cohortNames?: Record<number, string>;
}) {
  return (
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
          {rows.map((row, idx) => {
            const cid = row.cohortId ?? row.cohort_id ?? null;
            const name =
              row.cohortName ??
              row.cohort_name ??
              (cid !== null ? cohortNames?.[cid] : undefined) ??
              "—";
            const entries = row.cohortEntries ?? row.cohort_entries ?? 0;
            const subjects = row.cohortSubjects ?? row.cohort_subjects ?? 0;
            return (
              <tr key={idx} className="border-b border-border-default/50 last:border-b-0">
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
  );
}

function WaterfallChart({ rows }: { rows: WaterfallRow[] }) {
  const maxCount = Math.max(1, ...rows.map((r) => r.count ?? 0));
  return (
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
              <div className={`h-3 rounded ${color}`} style={{ width: `${width}%` }} />
            </div>
            <span className="w-16 text-right font-mono text-text-secondary">
              {n.toLocaleString()}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function SmdTable({ rows }: { rows: SmdRow[] }) {
  return (
    <div className="space-y-2">
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
              <tr key={idx} className="border-b border-border-default/50 last:border-b-0">
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

// SP4 Phase D.3 — Promote CTA. Renders the "Save as cohort" button when the
// run isn't promoted yet, or a confirmation badge with the resulting
// cohort_definition_id when it is. Unavailable if primaryCohortId is null
// (shouldn't happen on a succeeded match but we fail closed).
function PromoteCta({
  runId,
  promotion,
  onPromote,
  primaryCohortId,
}: {
  runId: string;
  promotion?: MatchedCohortPromotion;
  onPromote?: (promotion: MatchedCohortPromotion) => void;
  primaryCohortId: number | null;
}) {
  const mutation = usePromoteMatchedCohort();

  if (promotion !== undefined) {
    return (
      <div className="flex items-center gap-2 rounded border border-success/40 bg-success/5 px-3 py-2 text-xs text-success">
        <CheckCheck size={14} className="flex-shrink-0" />
        <span>
          Promoted as cohort{" "}
          <span className="font-mono">#{promotion.cohort_definition_id}</span>
          {" · "}
          <span className="text-text-secondary">{promotion.name}</span>
        </span>
      </div>
    );
  }

  const disabled = mutation.isPending || primaryCohortId === null;

  function handleClick() {
    if (disabled) return;
    mutation.mutate(
      { run_id: runId },
      {
        onSuccess: (result) => {
          if (onPromote === undefined) return;
          onPromote({
            run_id: result.run_id,
            cohort_definition_id: result.cohort_definition_id,
            name: result.name,
            promoted_at: new Date().toISOString(),
            primary_cohort_id: result.provenance.primary_cohort_id,
            comparator_cohort_ids: result.provenance.comparator_cohort_ids,
            ratio: result.provenance.ratio,
          });
        },
      },
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded border border-border-default bg-surface-overlay/40 px-3 py-2">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-primary">
          Save matched controls as a first-class cohort
        </p>
        <p className="text-[10px] text-text-ghost">
          Makes this match available to downstream analyses (incidence rate, estimation, prediction…).
        </p>
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled}
        className={[
          "flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
          disabled
            ? "cursor-not-allowed bg-surface-overlay text-text-ghost"
            : "bg-success text-bg-canvas hover:bg-success/90",
        ].join(" ")}
      >
        {mutation.isPending ? (
          <Loader2 size={12} className="animate-spin" />
        ) : (
          <Award size={12} />
        )}
        {mutation.isPending ? "Promoting…" : "Save as cohort"}
      </button>
      {mutation.isError && (
        <p className="w-full text-[10px] text-error">
          Promotion failed: {mutation.error.message}
        </p>
      )}
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
