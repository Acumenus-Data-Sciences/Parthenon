// Phase 15 Plan 15-06 — Generation history section (UI-SPEC §Layout Section 1 / D-22).
//
// Grouped-by-source disclosures over the D-18 `generation_runs` array (filtered
// query on `finngen.runs`, 100-row server cap). Each source group header shows
// the status of the LATEST run + subject count + relative timestamp; clicking
// expands the full history for that source.
//
// Typography: font-semibold only (UI-SPEC 2-weight contract; weight-500 banned).
// A11y: <button> disclosures with aria-expanded + aria-controls on every group.
import { useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

import { EmptyState } from "@/components/ui/EmptyState";
import { RunStatusBadge } from "@/features/_finngen-foundation/components/RunStatusBadge";
import type { EndpointGenerationRun } from "../api";

type GenerationHistorySectionProps = {
  endpointName: string;
  longname: string | null;
  cohortDefinitionId: number;
  runs: EndpointGenerationRun[];
  totalCount?: number;
  isLoading?: boolean;
};

export function GenerationHistorySection({
  endpointName,
  runs,
  totalCount,
  isLoading,
}: GenerationHistorySectionProps) {
  const [expandedSources, setExpandedSources] = useState<Set<string>>(
    new Set(),
  );

  const groupedBySource = useMemo(() => {
    const map = new Map<string, EndpointGenerationRun[]>();
    for (const run of runs) {
      const list = map.get(run.source_key) ?? [];
      list.push(run);
      map.set(run.source_key, list);
    }
    return map;
  }, [runs]);

  if (!isLoading && runs.length === 0) {
    return (
      <section aria-labelledby="gen-history-heading">
        <p
          id="gen-history-heading"
          className="text-xs font-semibold uppercase tracking-wider text-slate-500"
        >
          Generation history
        </p>
        <div className="mt-2">
          <EmptyState
            title="This endpoint hasn't been generated yet."
            message='Pick a source under "Run GWAS" below to generate first.'
          />
        </div>
      </section>
    );
  }

  const toggle = (sourceKey: string) => {
    setExpandedSources((prev) => {
      const next = new Set(prev);
      if (next.has(sourceKey)) next.delete(sourceKey);
      else next.add(sourceKey);
      return next;
    });
  };

  return (
    <section aria-labelledby="gen-history-heading">
      <p
        id="gen-history-heading"
        className="text-xs font-semibold uppercase tracking-wider text-slate-500"
      >
        Generation history
      </p>
      <div className="mt-2 space-y-1.5">
        {Array.from(groupedBySource.entries()).map(([sourceKey, sourceRuns]) => {
          const isExpanded = expandedSources.has(sourceKey);
          const latest = sourceRuns[0];
          return (
            <div key={sourceKey}>
              <button
                type="button"
                onClick={() => toggle(sourceKey)}
                aria-expanded={isExpanded}
                aria-controls={`gen-history-${sourceKey}-body`}
                className="flex w-full items-center justify-between rounded border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs hover:border-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500/40"
              >
                <div className="flex items-center gap-2">
                  <ChevronRight
                    size={12}
                    className={
                      isExpanded
                        ? "rotate-90 transition-transform"
                        : "transition-transform"
                    }
                  />
                  <span className="font-mono text-[10px] text-slate-300">
                    {sourceKey}
                  </span>
                  <RunStatusBadge status={latest.status} />
                  <span className="text-slate-300 tabular-nums">
                    {(latest.subject_count ?? 0).toLocaleString()} subjects
                  </span>
                </div>
                <span className="font-mono text-[10px] text-slate-600">
                  {formatDistanceToNow(new Date(latest.created_at), {
                    addSuffix: true,
                  })}
                </span>
              </button>
              {isExpanded && (
                <div
                  id={`gen-history-${sourceKey}-body`}
                  className="mt-1.5 ml-4 space-y-1 border-l border-slate-800 pl-3"
                >
                  {sourceRuns.map((run) => (
                    <div
                      key={run.run_id}
                      className={`flex items-center justify-between rounded border border-slate-800 bg-slate-950/60 px-3 py-2 text-xs ${
                        run.status !== "succeeded" ? "opacity-60" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <RunStatusBadge status={run.status} />
                        <span className="text-slate-300 tabular-nums">
                          {(run.subject_count ?? 0).toLocaleString()} subjects
                        </span>
                      </div>
                      <span className="font-mono text-[10px] text-slate-600">
                        {formatDistanceToNow(new Date(run.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalCount !== undefined && totalCount > runs.length && (
        <a
          href={`/workbench/finngen-analyses?endpoint=${encodeURIComponent(endpointName)}`}
          className="block py-2 text-center text-[11px] text-slate-500 hover:text-teal-300"
        >
          Show older runs (showing {runs.length} of {totalCount}) →
        </a>
      )}
    </section>
  );
}
