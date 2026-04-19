// Phase 15 Plan 15-06 — GWAS runs section (UI-SPEC §Layout Section 2 / D-22).
//
// Flat newest-first list over the D-21 `gwas_runs` array (finngen.endpoint_gwas_runs,
// 100-row server cap). Each row is a navigable <Link> to the reserved Phase 16
// PheWeb-lite page; superseded rows are muted and render a "→ replaced by #N"
// back-link (D-10).
//
// Helpers:
//  - formatCaseControl: locale-formatted "case / control" or "—/—" when null.
//  - formatPValue: toExponential(1); clamped to "<1e-300" for extremely small p.
//
// A11y: role="list" + aria-live="polite" on the container for status-change
// announcements; each row carries role="listitem" (UI-SPEC §Live region).
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

import { EmptyState } from "@/components/ui/EmptyState";
import { RunStatusBadge } from "@/features/_finngen-foundation/components/RunStatusBadge";
import type { EndpointGwasRun } from "../api";

type GwasRunsSectionProps = {
  endpointName: string;
  runs: EndpointGwasRun[];
  totalCount?: number;
  isLoading?: boolean;
};

function formatCaseControl(
  caseN: number | null,
  controlN: number | null,
): string {
  if (caseN === null || controlN === null) return "—/—";
  return `${caseN.toLocaleString()} / ${controlN.toLocaleString()}`;
}

function formatPValue(p: number): string {
  if (p < 1e-300) return "<1e-300";
  return p.toExponential(1);
}

export function GwasRunsSection({
  endpointName,
  runs,
  totalCount,
  isLoading,
}: GwasRunsSectionProps) {
  if (!isLoading && runs.length === 0) {
    return (
      <section aria-labelledby="gwas-runs-heading">
        <p
          id="gwas-runs-heading"
          className="text-xs font-semibold uppercase tracking-wider text-slate-500"
        >
          GWAS runs
        </p>
        <div className="mt-2">
          <EmptyState title="No GWAS runs yet — dispatch one below." />
        </div>
      </section>
    );
  }

  // Map tracking_id → run_id so supersede back-links resolve to the Phase 16
  // deep link when the replacement lives in the same 100-row window. Outside
  // that window we fall back to the analyses index (UI-SPEC §Deep-link
  // Forward Compatibility).
  const trackingToRunId = new Map<number, string>();
  for (const r of runs) trackingToRunId.set(r.tracking_id, r.run_id);

  return (
    <section aria-labelledby="gwas-runs-heading">
      <p
        id="gwas-runs-heading"
        className="text-xs font-semibold uppercase tracking-wider text-slate-500"
      >
        GWAS runs
      </p>
      <div className="mt-2 space-y-2" role="list" aria-live="polite">
        {runs.map((run) => {
          const supersededBy = run.superseded_by_tracking_id;
          const replacementRunId =
            supersededBy !== null ? trackingToRunId.get(supersededBy) : undefined;
          return (
            <div key={run.tracking_id} role="listitem">
              <Link
                to={`/workbench/finngen-endpoints/${encodeURIComponent(
                  endpointName,
                )}/gwas/${encodeURIComponent(run.run_id)}`}
                className={`group block rounded border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs hover:border-teal-500/40 hover:bg-slate-900/60 focus:outline-none focus:ring-1 focus:ring-teal-500/40 ${
                  run.status === "superseded" ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <RunStatusBadge status={run.status} />
                    <span className="rounded bg-slate-900 px-1.5 py-0.5 font-mono text-[10px] text-slate-400">
                      {run.source_key}
                    </span>
                    <span className="whitespace-nowrap text-slate-300 tabular-nums">
                      {formatCaseControl(run.case_n, run.control_n)}
                    </span>
                    {run.control_cohort_name && (
                      <span
                        className="max-w-[160px] truncate text-slate-500"
                        title={run.control_cohort_name}
                      >
                        vs. {run.control_cohort_name}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-3">
                    {run.top_hit_p_value !== null && (
                      <span className="font-mono text-[10px] text-slate-300">
                        top hit: p={formatPValue(run.top_hit_p_value)}
                      </span>
                    )}
                    <span className="font-mono text-[10px] text-slate-600">
                      {formatDistanceToNow(new Date(run.created_at), {
                        addSuffix: true,
                      })}
                    </span>
                  </div>
                </div>
              </Link>
              {supersededBy !== null && (
                <div className="mt-1 pl-3 text-[10px] text-slate-500">
                  →{" "}
                  {replacementRunId ? (
                    <Link
                      to={`/workbench/finngen-endpoints/${encodeURIComponent(
                        endpointName,
                      )}/gwas/${encodeURIComponent(replacementRunId)}`}
                      className="text-teal-400 hover:text-teal-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      replaced by run #{supersededBy}
                    </Link>
                  ) : (
                    <Link
                      to={`/workbench/finngen-analyses?tracking_id=${supersededBy}`}
                      className="text-teal-400 hover:text-teal-300"
                      onClick={(e) => e.stopPropagation()}
                    >
                      replaced by run #{supersededBy}
                    </Link>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {totalCount !== undefined && totalCount > runs.length && (
        <Link
          to={`/workbench/finngen-analyses?endpoint=${encodeURIComponent(
            endpointName,
          )}&kind=gwas`}
          className="block w-full py-2 text-center text-[11px] text-slate-500 hover:text-teal-300"
        >
          Show older GWAS runs (showing {runs.length} of {totalCount}) →
        </Link>
      )}
    </section>
  );
}
