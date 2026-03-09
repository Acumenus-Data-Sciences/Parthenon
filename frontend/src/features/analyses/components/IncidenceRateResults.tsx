import { useState, useMemo } from "react";
import { Loader2, AlertCircle, ChevronDown, ChevronRight, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AnalysisExecution,
  IncidenceRateResult,
} from "../types/analysis";
import { fmt, num } from "@/lib/formatters";
import { IncidenceRateVerdictDashboard } from "./IncidenceRateVerdictDashboard";

interface IncidenceRateResultsProps {
  execution?: AnalysisExecution | null;
  isLoading?: boolean;
}

type SortField =
  | "outcome"
  | "persons_at_risk"
  | "persons_with_outcome"
  | "person_years"
  | "incidence_rate"
  | "ci";

type SortDir = "asc" | "desc";

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

/**
 * Classify CI width relative to the point estimate.
 * Narrow: CI width < 50% of IR; Wide: CI width > 200% of IR; Medium otherwise.
 */
function ciPrecision(
  ir: number,
  ciLower: number,
  ciUpper: number,
): "narrow" | "medium" | "wide" {
  const width = num(ciUpper) - num(ciLower);
  const rate = num(ir);
  if (rate === 0) return width === 0 ? "narrow" : "wide";
  const ratio = width / rate;
  if (ratio < 0.5) return "narrow";
  if (ratio > 2.0) return "wide";
  return "medium";
}

/** Background style for IR cell: gradient intensity proportional to magnitude */
function irCellStyle(
  ir: number,
  maxIR: number,
  precision: "narrow" | "medium" | "wide",
): React.CSSProperties {
  const intensity = maxIR > 0 ? Math.min(num(ir) / maxIR, 1) : 0;
  const alpha = 0.05 + intensity * 0.15; // 5% to 20% opacity

  // Precision-based border coloring
  let borderColor: string;
  if (precision === "narrow") {
    borderColor = `rgba(45, 212, 191, ${alpha + 0.1})`; // teal
  } else if (precision === "wide") {
    borderColor = `rgba(201, 162, 39, ${alpha + 0.1})`; // amber/gold
  } else {
    borderColor = "transparent";
  }

  return {
    background: `linear-gradient(90deg, rgba(45, 212, 191, ${alpha * 0.5}) 0%, transparent 100%)`,
    borderLeft: `2px solid ${borderColor}`,
  };
}

function sortResults(
  results: IncidenceRateResult[],
  field: SortField,
  dir: SortDir,
): IncidenceRateResult[] {
  const sorted = [...results].sort((a, b) => {
    let cmp = 0;
    switch (field) {
      case "outcome":
        cmp = a.outcome_cohort_name.localeCompare(b.outcome_cohort_name);
        break;
      case "persons_at_risk":
        cmp = num(a.persons_at_risk) - num(b.persons_at_risk);
        break;
      case "persons_with_outcome":
        cmp = num(a.persons_with_outcome) - num(b.persons_with_outcome);
        break;
      case "person_years":
        cmp = num(a.person_years) - num(b.person_years);
        break;
      case "incidence_rate":
        cmp = num(a.incidence_rate) - num(b.incidence_rate);
        break;
      case "ci":
        cmp =
          num(a.rate_95_ci_upper) -
          num(a.rate_95_ci_lower) -
          (num(b.rate_95_ci_upper) - num(b.rate_95_ci_lower));
        break;
    }
    return dir === "asc" ? cmp : -cmp;
  });
  return sorted;
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
        {results.map((r) => {
          const precision = ciPrecision(r.incidence_rate, r.rate_95_ci_lower, r.rate_95_ci_upper);
          const dotColor =
            precision === "narrow"
              ? "var(--primary)"
              : precision === "wide"
                ? "#C9A227"
                : "var(--primary)";

          return (
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
                    background:
                      precision === "narrow"
                        ? "color-mix(in srgb, var(--primary) 25%, transparent)"
                        : precision === "wide"
                          ? "color-mix(in srgb, #C9A227 20%, transparent)"
                          : "color-mix(in srgb, var(--primary) 20%, transparent)",
                  }}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
                  style={{
                    left: `${num(r.incidence_rate) * scale}%`,
                    marginLeft: "-5px",
                    background: dotColor,
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
          );
        })}
      </div>
    </div>
  );
}

function ExpandableRow({
  result,
  maxIR,
}: {
  result: IncidenceRateResult;
  maxIR: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasStrata = result.strata && result.strata.length > 0;
  const precision = ciPrecision(
    result.incidence_rate,
    result.rate_95_ci_lower,
    result.rate_95_ci_upper,
  );

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
        <td
          className="px-4 py-3 text-right"
          style={irCellStyle(num(result.incidence_rate), maxIR, precision)}
        >
          <span className="font-['IBM_Plex_Mono',monospace] text-sm font-medium text-[#2DD4BF]">
            {fmt(result.incidence_rate, 2)}
          </span>
          {precision !== "medium" && (
            <span
              data-testid="ci-precision-indicator"
              className={cn(
                "ml-1.5 inline-block h-1.5 w-1.5 rounded-full",
                precision === "narrow" ? "bg-[#2DD4BF]" : "bg-[#C9A227]",
              )}
              title={precision === "narrow" ? "Narrow CI (precise)" : "Wide CI (imprecise)"}
            />
          )}
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

function SortableHeader({
  label,
  field,
  currentField,
  currentDir,
  onSort,
  align = "left",
}: {
  label: string;
  field: SortField;
  currentField: SortField;
  currentDir: SortDir;
  onSort: (field: SortField) => void;
  align?: "left" | "right";
}) {
  const isActive = currentField === field;
  return (
    <th
      style={{ textAlign: align, cursor: "pointer", userSelect: "none" }}
      onClick={() => onSort(field)}
      className="group"
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown
          size={12}
          className={cn(
            "transition-opacity",
            isActive ? "opacity-100 text-[#2DD4BF]" : "opacity-30 group-hover:opacity-60",
          )}
          style={
            isActive
              ? { transform: currentDir === "desc" ? "scaleY(-1)" : undefined }
              : undefined
          }
        />
      </span>
    </th>
  );
}

export function IncidenceRateResults({
  execution,
  isLoading,
}: IncidenceRateResultsProps) {
  const [sortField, setSortField] = useState<SortField>("incidence_rate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

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
    <IncidenceRateResultsInner
      results={results}
      sortField={sortField}
      sortDir={sortDir}
      onSort={handleSort}
    />
  );
}

/**
 * Inner component that renders results content.
 * Extracted to allow useMemo on sorted results without conditional hook issues.
 */
function IncidenceRateResultsInner({
  results,
  sortField,
  sortDir,
  onSort,
}: {
  results: IncidenceRateResult[];
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
}) {
  const sortedResults = useMemo(
    () => sortResults(results, sortField, sortDir),
    [results, sortField, sortDir],
  );

  const maxIR = useMemo(
    () => Math.max(...results.map((r) => num(r.incidence_rate)), 1),
    [results],
  );

  return (
    <div className="space-y-6">
      {/* Verdict Dashboard */}
      <IncidenceRateVerdictDashboard results={results} />

      {/* Summary Table */}
      <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
        <table className="data-table">
          <thead>
            <tr>
              <SortableHeader
                label="Outcome"
                field="outcome"
                currentField={sortField}
                currentDir={sortDir}
                onSort={onSort}
              />
              <SortableHeader
                label="Persons at Risk"
                field="persons_at_risk"
                currentField={sortField}
                currentDir={sortDir}
                onSort={onSort}
                align="right"
              />
              <SortableHeader
                label="With Outcome"
                field="persons_with_outcome"
                currentField={sortField}
                currentDir={sortDir}
                onSort={onSort}
                align="right"
              />
              <SortableHeader
                label="Person-Years"
                field="person_years"
                currentField={sortField}
                currentDir={sortDir}
                onSort={onSort}
                align="right"
              />
              <SortableHeader
                label="IR / 1000 PY"
                field="incidence_rate"
                currentField={sortField}
                currentDir={sortDir}
                onSort={onSort}
                align="right"
              />
              <SortableHeader
                label="95% CI"
                field="ci"
                currentField={sortField}
                currentDir={sortDir}
                onSort={onSort}
                align="right"
              />
            </tr>
          </thead>
          <tbody>
            {sortedResults.map((r) => (
              <ExpandableRow
                key={r.outcome_cohort_id}
                result={r}
                maxIR={maxIR}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Forest Plot */}
      <ForestPlot results={sortedResults} />
    </div>
  );
}
