import { useState } from "react";
import { Loader2, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AnalysisExecution,
  IncidenceRateResult,
} from "../types/analysis";

interface IncidenceRateResultsProps {
  execution?: AnalysisExecution | null;
  isLoading?: boolean;
}

function parseResults(
  execution: AnalysisExecution | null | undefined,
): IncidenceRateResult[] {
  if (!execution?.result_json) return [];
  const json = execution.result_json;
  if (Array.isArray(json)) return json as IncidenceRateResult[];
  if (typeof json === "object" && "results" in json) {
    return (json as { results: IncidenceRateResult[] }).results;
  }
  return [];
}

function ForestPlot({ results }: { results: IncidenceRateResult[] }) {
  if (results.length === 0) return null;

  const maxRate = Math.max(
    ...results.map((r) => r.rate_95_ci_upper || r.incidence_rate * 1.5),
  );
  const scale = maxRate > 0 ? 100 / maxRate : 1;

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4 space-y-3">
      <h4 className="text-sm font-semibold text-[#F0EDE8]">
        Forest Plot (IR per 1,000 PY)
      </h4>
      <div className="space-y-2">
        {results.map((r) => (
          <div
            key={r.outcome_cohort_id}
            className="flex items-center gap-3"
          >
            <div className="w-40 shrink-0">
              <p className="text-xs text-[#C5C0B8] truncate">
                {r.outcome_cohort_name}
              </p>
            </div>
            <div className="flex-1 relative h-6">
              {/* Background bar */}
              <div className="absolute inset-y-0 left-0 right-0 flex items-center">
                <div className="w-full h-px bg-[#323238]" />
              </div>
              {/* CI range */}
              <div
                className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-[#2DD4BF]/20 rounded"
                style={{
                  left: `${r.rate_95_ci_lower * scale}%`,
                  width: `${Math.max((r.rate_95_ci_upper - r.rate_95_ci_lower) * scale, 1)}%`,
                }}
              />
              {/* Point estimate */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-[#2DD4BF] border border-[#0E0E11]"
                style={{
                  left: `${r.incidence_rate * scale}%`,
                  marginLeft: "-5px",
                }}
              />
            </div>
            <div className="w-36 shrink-0 text-right">
              <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
                {r.incidence_rate.toFixed(1)}
                <span className="text-[#5A5650]">
                  {" "}
                  ({r.rate_95_ci_lower.toFixed(1)}-
                  {r.rate_95_ci_upper.toFixed(1)})
                </span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExpandableRow({ result }: { result: IncidenceRateResult }) {
  const [expanded, setExpanded] = useState(false);
  const hasStrata = result.strata && result.strata.length > 0;

  return (
    <>
      <tr
        className={cn(
          "border-t border-[#1C1C20] transition-colors",
          hasStrata && "cursor-pointer hover:bg-[#1C1C20]",
        )}
        onClick={() => hasStrata && setExpanded(!expanded)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            {hasStrata &&
              (expanded ? (
                <ChevronDown size={12} className="text-[#8A857D]" />
              ) : (
                <ChevronRight size={12} className="text-[#8A857D]" />
              ))}
            <span className="text-sm text-[#F0EDE8]">
              {result.outcome_cohort_name}
            </span>
          </div>
        </td>
        <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-sm text-[#C5C0B8]">
          {result.persons_at_risk.toLocaleString()}
        </td>
        <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-sm text-[#C5C0B8]">
          {result.persons_with_outcome.toLocaleString()}
        </td>
        <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-sm text-[#C5C0B8]">
          {result.person_years.toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })}
        </td>
        <td className="px-4 py-3 text-right">
          <span className="font-['IBM_Plex_Mono',monospace] text-sm font-medium text-[#2DD4BF]">
            {result.incidence_rate.toFixed(2)}
          </span>
        </td>
        <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D]">
          ({result.rate_95_ci_lower.toFixed(2)} -{" "}
          {result.rate_95_ci_upper.toFixed(2)})
        </td>
      </tr>
      {expanded &&
        result.strata?.map((s) => (
          <tr
            key={`${result.outcome_cohort_id}-${s.stratum_name}-${s.stratum_value}`}
            className="border-t border-[#1C1C20] bg-[#0E0E11]"
          >
            <td className="px-4 py-2 pl-10">
              <span className="text-xs text-[#8A857D]">
                {s.stratum_name}: {s.stratum_value}
              </span>
            </td>
            <td className="px-4 py-2 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D]">
              {s.persons_at_risk.toLocaleString()}
            </td>
            <td className="px-4 py-2 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D]">
              {s.persons_with_outcome.toLocaleString()}
            </td>
            <td className="px-4 py-2 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D]">
              {s.person_years.toLocaleString(undefined, {
                maximumFractionDigits: 1,
              })}
            </td>
            <td className="px-4 py-2 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
              {s.incidence_rate.toFixed(2)}
            </td>
            <td className="px-4 py-2" />
          </tr>
        ))}
    </>
  );
}

export function IncidenceRateResults({
  execution,
  isLoading,
}: IncidenceRateResultsProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 size={24} className="animate-spin text-[#8A857D]" />
      </div>
    );
  }

  if (!execution || execution.status !== "completed") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
        <AlertCircle size={24} className="text-[#323238] mb-3" />
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          No results available
        </h3>
        <p className="mt-1 text-xs text-[#8A857D]">
          {execution
            ? `Execution status: ${execution.status}`
            : "Execute the analysis to generate results."}
        </p>
        {execution?.fail_message && (
          <p className="mt-2 text-xs text-[#E85A6B] max-w-md text-center">
            {execution.fail_message}
          </p>
        )}
      </div>
    );
  }

  const results = parseResults(execution);

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[#323238] bg-[#151518] py-16">
        <AlertCircle size={24} className="text-[#323238] mb-3" />
        <p className="text-sm text-[#8A857D]">
          Execution completed but no results were returned.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Table */}
      <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-[#1C1C20]">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Outcome
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Persons at Risk
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                With Outcome
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                Person-Years
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                IR / 1000 PY
              </th>
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-[#8A857D]">
                95% CI
              </th>
            </tr>
          </thead>
          <tbody>
            {results.map((r) => (
              <ExpandableRow
                key={r.outcome_cohort_id}
                result={r}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Forest Plot */}
      <ForestPlot results={results} />
    </div>
  );
}
