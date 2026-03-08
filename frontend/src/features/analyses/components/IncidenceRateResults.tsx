import { useState } from "react";
import { Loader2, AlertCircle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AnalysisExecution,
  IncidenceRateResult,
} from "../types/analysis";
import { fmt, num } from "@/lib/formatters";

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
    ...results.map((r) => num(r.rate_95_ci_upper) || num(r.incidence_rate) * 1.5),
  );
  const scale = maxRate > 0 ? 100 / maxRate : 1;

  return (
    <div className="panel space-y-3">
      <h4 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
        Forest Plot (IR per 1,000 PY)
      </h4>
      <div className="space-y-2">
        {results.map((r) => (
          <div
            key={r.outcome_cohort_id}
            className="flex items-center gap-3"
          >
            <div className="w-40 shrink-0">
              <p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
                {r.outcome_cohort_name}
              </p>
            </div>
            <div className="flex-1 relative h-6">
              <div className="absolute inset-y-0 left-0 right-0 flex items-center">
                <div className="w-full h-px" style={{ background: "var(--border-subtle)" }} />
              </div>
              <div
                className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded"
                style={{
                  left: `${num(r.rate_95_ci_lower) * scale}%`,
                  width: `${Math.max((num(r.rate_95_ci_upper) - num(r.rate_95_ci_lower)) * scale, 1)}%`,
                  background: "color-mix(in srgb, var(--primary) 20%, transparent)",
                }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
                style={{
                  left: `${num(r.incidence_rate) * scale}%`,
                  marginLeft: "-5px",
                  background: "var(--primary)",
                  border: "1px solid var(--surface-base)",
                }}
              />
            </div>
            <div className="w-36 shrink-0 text-right">
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--text-secondary)" }}>
                {fmt(r.incidence_rate, 1)}
                <span style={{ color: "var(--text-ghost)" }}>
                  {" "}
                  ({fmt(r.rate_95_ci_lower, 1)}-
                  {fmt(r.rate_95_ci_upper, 1)})
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
          {num(result.persons_at_risk).toLocaleString()}
        </td>
        <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-sm text-[#C5C0B8]">
          {num(result.persons_with_outcome).toLocaleString()}
        </td>
        <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-sm text-[#C5C0B8]">
          {num(result.person_years).toLocaleString(undefined, {
            maximumFractionDigits: 1,
          })}
        </td>
        <td className="px-4 py-3 text-right">
          <span className="font-['IBM_Plex_Mono',monospace] text-sm font-medium text-[#2DD4BF]">
            {fmt(result.incidence_rate, 2)}
          </span>
        </td>
        <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D]">
          ({fmt(result.rate_95_ci_lower, 2)} -{" "}
          {fmt(result.rate_95_ci_upper, 2)})
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
              {num(s.persons_at_risk).toLocaleString()}
            </td>
            <td className="px-4 py-2 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D]">
              {num(s.persons_with_outcome).toLocaleString()}
            </td>
            <td className="px-4 py-2 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D]">
              {num(s.person_years).toLocaleString(undefined, {
                maximumFractionDigits: 1,
              })}
            </td>
            <td className="px-4 py-2 text-right font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
              {fmt(s.incidence_rate, 2)}
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
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Outcome</th>
              <th style={{ textAlign: "right" }}>Persons at Risk</th>
              <th style={{ textAlign: "right" }}>With Outcome</th>
              <th style={{ textAlign: "right" }}>Person-Years</th>
              <th style={{ textAlign: "right" }}>IR / 1000 PY</th>
              <th style={{ textAlign: "right" }}>95% CI</th>
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
