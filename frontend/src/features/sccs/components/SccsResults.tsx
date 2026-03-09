import { useState, useMemo } from "react";
import { Loader2, AlertCircle, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { SccsTimeline } from "@/features/estimation/components/SccsTimeline";
import { SccsVerdictDashboard, InlineMiniForestPlot } from "./SccsVerdictDashboard";
import type { AnalysisExecution } from "@/features/analyses/types/analysis";
import type { SccsResult, SccsEstimate } from "../types/sccs";
import { fmt, num } from "@/lib/formatters";

interface SccsResultsProps {
  execution: AnalysisExecution | null;
  isLoading?: boolean;
}

type SortField = "covariate" | "irr";
type SortDir = "asc" | "desc";

export function SccsResults({ execution, isLoading }: SccsResultsProps) {
  const [sortField, setSortField] = useState<SortField>("irr");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  if (!execution) {
    return (
      <div className="text-center py-12 text-[#5A5650] text-sm">
        No execution selected. Run the analysis to see results.
      </div>
    );
  }

  if (execution.status === "running" || execution.status === "queued" || execution.status === "pending") {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 size={24} className="animate-spin text-[#2DD4BF]" />
        <p className="text-sm text-[#8A857D]">
          SCCS analysis is {execution.status}...
        </p>
      </div>
    );
  }

  if (execution.status === "failed") {
    return (
      <div className="rounded-lg border border-[#E85A6B]/30 bg-[#E85A6B]/5 p-4">
        <div className="flex items-start gap-2">
          <AlertCircle size={16} className="text-[#E85A6B] shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-[#E85A6B]">Execution Failed</p>
            <p className="text-xs text-[#8A857D] mt-1">
              {execution.fail_message ?? "Unknown error"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const result = execution.result_json as unknown as SccsResult | null;

  if (!result || result.status !== "completed") {
    return (
      <div className="text-center py-12 text-[#5A5650] text-sm">
        {result?.message ?? "No results available."}
      </div>
    );
  }

  return (
    <SccsResultsContent
      result={result}
      sortField={sortField}
      sortDir={sortDir}
      toggleSort={toggleSort}
    />
  );
}

// ---------------------------------------------------------------------------
// Inner content component (avoids conditional hook calls)
// ---------------------------------------------------------------------------

function SccsResultsContent({
  result,
  sortField,
  sortDir,
  toggleSort,
}: {
  result: SccsResult;
  sortField: SortField;
  sortDir: SortDir;
  toggleSort: (field: SortField) => void;
}) {
  const sortedEstimates = useMemo(() => {
    if (!result.estimates || result.estimates.length === 0) return [];
    const sorted = [...result.estimates].sort((a, b) => {
      if (sortField === "irr") {
        return num(a.irr) - num(b.irr);
      }
      return a.covariate.localeCompare(b.covariate);
    });
    return sortDir === "desc" ? sorted.reverse() : sorted;
  }, [result.estimates, sortField, sortDir]);

  return (
    <div className="space-y-6">
      {/* Verdict Dashboard — above all existing content */}
      <SccsVerdictDashboard result={result} />

      {/* Population Summary */}
      {result.population && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Cases", value: result.population.cases },
            { label: "Outcomes", value: result.population.outcomes },
            { label: "Observation Periods", value: result.population.observation_periods },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-[#232328] bg-[#151518] p-4 text-center"
            >
              <p className="text-2xl font-bold text-[#F0EDE8]">
                {num(card.value).toLocaleString()}
              </p>
              <p className="text-xs text-[#8A857D] mt-1">{card.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Enhanced IRR Estimates Table */}
      {sortedEstimates.length > 0 && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
          <div className="p-4 border-b border-[#232328]">
            <h3 className="text-sm font-semibold text-[#F0EDE8]">
              Incidence Rate Ratios
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#232328]">
                  <th
                    className="px-4 py-2 text-left text-xs font-medium text-[#8A857D] cursor-pointer hover:text-[#F0EDE8] select-none"
                    onClick={() => toggleSort("covariate")}
                  >
                    <span className="inline-flex items-center gap-1">
                      Covariate
                      <ArrowUpDown size={12} className="opacity-50" />
                    </span>
                  </th>
                  <th
                    className="px-4 py-2 text-left text-xs font-medium text-[#8A857D] cursor-pointer hover:text-[#F0EDE8] select-none"
                    onClick={() => toggleSort("irr")}
                  >
                    <span className="inline-flex items-center gap-1">
                      IRR
                      <ArrowUpDown size={12} className="opacity-50" />
                    </span>
                  </th>
                  {["95% CI Lower", "95% CI Upper", "Log RR", "SE", ""].map((h) => (
                    <th key={h || "forest"} className="px-4 py-2 text-left text-xs font-medium text-[#8A857D]">
                      {h || "Forest Plot"}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedEstimates.map((est, idx) => (
                  <tr key={idx} className="border-b border-[#232328] last:border-0">
                    <td className="px-4 py-2 text-[#F0EDE8]">{est.covariate}</td>
                    <td className={cn(
                      "px-4 py-2 font-mono font-semibold",
                      num(est.irr) > 1 ? "text-[#E85A6B]" : num(est.irr) < 1 ? "text-[#2DD4BF]" : "text-[#F0EDE8]",
                    )}>
                      {fmt(est.irr)}
                    </td>
                    <td className="px-4 py-2 font-mono text-[#8A857D]">{fmt(est.ci_lower)}</td>
                    <td className="px-4 py-2 font-mono text-[#8A857D]">{fmt(est.ci_upper)}</td>
                    <td className="px-4 py-2 font-mono text-[#8A857D]">{fmt(est.log_rr, 4)}</td>
                    <td className="px-4 py-2 font-mono text-[#8A857D]">{fmt(est.se_log_rr, 4)}</td>
                    <td className="px-4 py-2">
                      <InlineMiniForestPlot
                        irr={num(est.irr)}
                        ciLower={est.ci_lower != null ? num(est.ci_lower) : undefined}
                        ciUpper={est.ci_upper != null ? num(est.ci_upper) : undefined}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SCCS Era Timeline */}
      {result.eras && result.eras.length > 0 && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <h3 className="text-sm font-semibold text-[#F0EDE8] mb-4">
            Risk Window Timeline
          </h3>
          <div className="flex justify-center">
            <SccsTimeline eras={result.eras} />
          </div>
        </div>
      )}

      {/* Execution Info */}
      {result.elapsed_seconds != null && (
        <p className="text-xs text-[#5A5650]">
          Completed in {fmt(result.elapsed_seconds, 1)}s
        </p>
      )}
    </div>
  );
}
