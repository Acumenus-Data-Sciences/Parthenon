import { useState, useMemo } from "react";
import {
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ArrowUpDown,
  Users,
  Clock,
  Activity,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  AnalysisExecution,
  IncidenceRateResult,
  DirectCalcResponse,
  DirectCalcRateRow,
} from "../types/analysis";
import { fmt, num } from "@/lib/formatters";
import { IncidenceRateVerdictDashboard } from "./IncidenceRateVerdictDashboard";
import { useTranslation } from "react-i18next";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface IncidenceRateResultsProps {
  execution?: AnalysisExecution | null;
  isLoading?: boolean;
  /** When set, renders direct-calc results instead of queue-based execution */
  directResults?: DirectCalcResponse | null;
}

// ---------------------------------------------------------------------------
// Sorting
// ---------------------------------------------------------------------------

type SortField =
  | "outcome"
  | "persons_at_risk"
  | "persons_with_outcome"
  | "person_years"
  | "incidence_rate"
  | "ci";

type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseResults(
  execution: AnalysisExecution | null | undefined,
): IncidenceRateResult[] {
  if (!execution?.result_json) return [];
  const json = execution.result_json;
  if (Array.isArray(json)) return normalizeIncidenceRateResults(json);
  if (typeof json === "object" && "results" in json) {
    return normalizeIncidenceRateResults((json as { results: IncidenceRateResult[] }).results);
  }
  return [];
}

function normalizeIncidenceRateResults(
  results: IncidenceRateResult[] | null | undefined,
): IncidenceRateResult[] {
  if (!Array.isArray(results)) return [];

  return results.map((row, index) => ({
    ...row,
    outcome_cohort_id: row?.outcome_cohort_id ?? index,
    outcome_cohort_name:
      row?.outcome_cohort_name ?? `Outcome #${row?.outcome_cohort_id ?? index}`,
    persons_at_risk: row?.persons_at_risk ?? 0,
    persons_with_outcome: row?.persons_with_outcome ?? 0,
    person_years: row?.person_years ?? 0,
    incidence_rate: row?.incidence_rate ?? 0,
    rate_95_ci_lower: row?.rate_95_ci_lower ?? 0,
    rate_95_ci_upper: row?.rate_95_ci_upper ?? 0,
    strata: Array.isArray(row?.strata)
      ? row.strata.map((stratum) => ({
          ...stratum,
          stratum_name: stratum?.stratum_name ?? "Unknown stratum",
          stratum_value: stratum?.stratum_value ?? "Unknown value",
          persons_at_risk: stratum?.persons_at_risk ?? 0,
          persons_with_outcome: stratum?.persons_with_outcome ?? 0,
          person_years: stratum?.person_years ?? 0,
          incidence_rate: stratum?.incidence_rate ?? 0,
          rate_95_ci_lower: stratum?.rate_95_ci_lower ?? 0,
          rate_95_ci_upper: stratum?.rate_95_ci_upper ?? 0,
        }))
      : [],
  }));
}

function normalizeDirectCalcResponse(
  directResults: DirectCalcResponse,
): DirectCalcResponse {
  return {
    ...directResults,
    incidence_rates: Array.isArray(directResults?.incidence_rates)
      ? directResults.incidence_rates.map((row) => ({
          ...row,
          target_cohort_name:
            row?.target_cohort_name ?? `Target #${row?.target_cohort_id ?? "?"}`,
          outcome_cohort_name:
            row?.outcome_cohort_name ?? `Outcome #${row?.outcome_cohort_id ?? "?"}`,
          tar_label: row?.tar_label ?? `TAR #${row?.tar_id ?? "?"}`,
          strata: Array.isArray(row?.strata) ? row.strata : [],
        }))
      : [],
    summary: {
      total_persons: directResults?.summary?.total_persons ?? 0,
      total_person_years: directResults?.summary?.total_person_years ?? 0,
      total_outcomes: directResults?.summary?.total_outcomes ?? 0,
      sources_used: Array.isArray(directResults?.summary?.sources_used)
        ? directResults.summary.sources_used
        : [],
    },
    metadata: {
      executed_at: directResults?.metadata?.executed_at ?? "",
      duration_seconds: directResults?.metadata?.duration_seconds ?? 0,
      r_version: directResults?.metadata?.r_version,
    },
  };
}

/** Convert DirectCalcRateRow[] to IncidenceRateResult[] for existing components */
function directRowsToResults(rows: DirectCalcRateRow[]): IncidenceRateResult[] {
  return rows.map((row) => ({
    outcome_cohort_id: row.outcome_cohort_id,
    outcome_cohort_name: row.outcome_cohort_name,
    persons_at_risk: row.persons_at_risk,
    persons_with_outcome: row.persons_with_outcome,
    person_years: row.person_years,
    incidence_rate: row.incidence_rate,
    rate_95_ci_lower: row.rate_95_ci_lower,
    rate_95_ci_upper: row.rate_95_ci_upper,
    strata: (row.strata ?? []).map((s) => ({
      stratum_name: s.stratum_name,
      stratum_value: s.stratum_value,
      persons_at_risk: s.persons_at_risk,
      persons_with_outcome: s.persons_with_outcome,
      person_years: s.person_years,
      incidence_rate: s.incidence_rate,
      rate_95_ci_lower: s.rate_95_ci_lower,
      rate_95_ci_upper: s.rate_95_ci_upper,
    })),
  }));
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
  const alpha = 0.05 + intensity * 0.15;

  let borderColor: string;
  if (precision === "narrow") {
    borderColor = `rgba(45, 212, 191, ${alpha + 0.1})`;
  } else if (precision === "wide") {
    borderColor = `rgba(201, 162, 39, ${alpha + 0.1})`;
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
  return [...results].sort((a, b) => {
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
}

// ---------------------------------------------------------------------------
// Summary Cards
// ---------------------------------------------------------------------------

function SummaryCards({
  results,
  totalPersons,
  totalPersonYears,
  totalOutcomes,
  isDirectCalc,
}: {
  results: IncidenceRateResult[];
  totalPersons?: number;
  totalPersonYears?: number;
  totalOutcomes?: number;
  isDirectCalc?: boolean;
}) {
  const { t } = useTranslation("app");
  const computedPersons = totalPersons ?? Math.max(...results.map((r) => num(r.persons_at_risk)), 0);
  const computedPY = totalPersonYears ?? results.reduce((sum, r) => sum + num(r.person_years), 0);
  const computedOutcomes = totalOutcomes ?? results.reduce((s, r) => s + num(r.persons_with_outcome), 0);
  const avgIR =
    results.length > 0
      ? results.reduce((s, r) => s + num(r.incidence_rate), 0) / results.length
      : 0;

  const cards = [
    {
      label: t("analyses.auto.personsAtRisk_70f6a6"),
      value: computedPersons.toLocaleString(),
      icon: Users,
      color: "var(--success)",
    },
    {
      label: t("analyses.auto.personYears_8c8539"),
      value:
        computedPY >= 1000
          ? `${(computedPY / 1000).toLocaleString(undefined, { maximumFractionDigits: 1 })}K`
          : computedPY.toLocaleString(undefined, { maximumFractionDigits: 1 }),
      icon: Clock,
      color: "var(--accent)",
    },
    {
      label: t("analyses.auto.totalOutcomeEvents_e93680"),
      value: computedOutcomes.toLocaleString(),
      icon: Activity,
      color: "var(--primary)",
    },
    {
      label: t("analyses.auto.avgIR1000PY_7113cb"),
      value: fmt(avgIR, 2),
      icon: Zap,
      color: isDirectCalc ? "var(--success)" : "var(--text-muted)",
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-lg border border-border-default bg-surface-raised px-4 py-3"
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
              {card.label}
            </span>
            <card.icon size={13} style={{ color: card.color }} />
          </div>
          <p
            className="text-xl font-semibold font-['IBM_Plex_Mono',monospace]"
            style={{ color: card.color }}
          >
            {card.value}
          </p>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CIBar — inline CI visualization bar
// ---------------------------------------------------------------------------

function CIBar({
  ir,
  ciLower,
  ciUpper,
  maxRate,
}: {
  ir: number;
  ciLower: number;
  ciUpper: number;
  maxRate: number;
}) {
  const scale = maxRate > 0 ? 100 / maxRate : 1;
  const leftPct = num(ciLower) * scale;
  const widthPct = Math.max((num(ciUpper) - num(ciLower)) * scale, 0.5);
  const dotPct = num(ir) * scale;

  return (
    <div className="relative w-24 h-4 shrink-0" aria-label={`CI bar: ${fmt(ciLower, 1)}–${fmt(ciUpper, 1)}`}>
      <div className="absolute inset-y-0 left-0 right-0 flex items-center">
        <div className="w-full h-px" style={{ background: "var(--border-subtle)" }} />
      </div>
      <div
        className="absolute top-1/2 -translate-y-1/2 h-1.5 rounded"
        style={{
          left: `${leftPct}%`,
          width: `${widthPct}%`,
          background: "color-mix(in srgb, #2DD4BF 25%, transparent)",
        }}
      />
      <div
        className="absolute top-1/2 -translate-y-1/2 w-2 h-2 rounded-full"
        style={{
          left: `${dotPct}%`,
          marginLeft: "-4px",
          background: "var(--success)",
          border: "1px solid var(--surface-base)",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stratified breakdown panels
// ---------------------------------------------------------------------------

function StratifiedBreakdown({
  results,
}: {
  results: IncidenceRateResult[];
}) {
  // Collect all unique stratum names across all results
  const stratumNames = useMemo(() => {
    const names = new Set<string>();
    results.forEach((r) => {
      r.strata?.forEach((s) => names.add(s.stratum_name));
    });
    return [...names];
  }, [results]);

  if (stratumNames.length === 0) return null;

  return (
    <div className="space-y-4">
      {stratumNames.map((name) => (
        <StratumPanel key={name} stratumName={name} results={results} />
      ))}
    </div>
  );
}

function StratumPanel({
  stratumName,
  results,
}: {
  stratumName: string;
  results: IncidenceRateResult[];
}) {
  const { t } = useTranslation("app");
  // For each outcome × stratum value, collect the stratum row
  const rows = useMemo(() => {
    return results.flatMap((r) => {
      const matching = (r.strata ?? []).filter((s) => s.stratum_name === stratumName);
      return matching.map((s) => ({ outcome: r.outcome_cohort_name, stratum: s }));
    });
  }, [results, stratumName]);

  if (rows.length === 0) return null;

  const maxIR = Math.max(...rows.map((r) => num(r.stratum.incidence_rate)), 1);

  const normalizedStratumName = (stratumName ?? "").toLowerCase();
  const isGender = normalizedStratumName.includes("gender");
  const isAge = normalizedStratumName.includes("age");

  return (
    <div className="panel" style={{ padding: 0, overflow: "hidden" }}>
      <div className="px-4 py-3 border-b border-border-default">
        <h4 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          {isGender ? "Gender Breakdown" : isAge ? "Age Group Breakdown" : `${stratumName} Breakdown`}
        </h4>
      </div>

      {/* Bar chart visualization */}
      <div className="px-4 py-3 space-y-2">
        {rows.map((row, i) => {
          const barWidth = maxIR > 0 ? (num(row.stratum.incidence_rate) / maxIR) * 100 : 0;
          const barColor = isGender
            ? (row.stratum.stratum_value ?? "").toLowerCase().includes("female")
              ? "var(--primary)"
              : "var(--success)"
            : "var(--accent)";

          return (
            <div key={i} className="space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="text-xs truncate"
                    style={{ color: "var(--text-muted)", minWidth: "6rem" }}
                  >
                    {row.stratum.stratum_value}
                  </span>
                  {results.length > 1 && (
                    <span
                      className="text-xs truncate"
                      style={{ color: "var(--text-ghost)" }}
                    >
                      ({row.outcome})
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className="text-xs font-mono"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {fmt(row.stratum.incidence_rate, 2)}/1000PY
                  </span>
                  {row.stratum.rate_95_ci_lower != null &&
                    row.stratum.rate_95_ci_upper != null && (
                      <span
                        className="text-xs font-mono"
                        style={{ color: "var(--text-ghost)" }}
                      >
                        [{fmt(row.stratum.rate_95_ci_lower, 2)},
                        {fmt(row.stratum.rate_95_ci_upper, 2)}]
                      </span>
                    )}
                </div>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-overlay)" }}>
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${barWidth}%`, background: barColor }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail table */}
      <table className="data-table text-xs">
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>
              {stratumName}
            </th>
            {results.length > 1 && <th style={{ textAlign: "left" }}>{t("analyses.auto.outcome_cf73bd")}</th>}
            <th style={{ textAlign: "right" }}>{t("analyses.auto.personsAtRisk_70f6a6")}</th>
            <th style={{ textAlign: "right" }}>{t("analyses.auto.personYears_8c8539")}</th>
            <th style={{ textAlign: "right" }}>{t("analyses.auto.withOutcome_907788")}</th>
            <th style={{ textAlign: "right" }}>{t("analyses.auto.iR1000PY_5f552c")}</th>
            <th style={{ textAlign: "right" }}>{t("analyses.auto.95CI_4009a0")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-border-subtle">
              <td className="px-4 py-2 text-text-secondary">{row.stratum.stratum_value}</td>
              {results.length > 1 && (
                <td className="px-4 py-2 text-text-muted truncate max-w-[10rem]">
                  {row.outcome}
                </td>
              )}
              <td className="px-4 py-2 text-right font-mono text-text-secondary">
                {num(row.stratum.persons_at_risk).toLocaleString()}
              </td>
              <td className="px-4 py-2 text-right font-mono text-text-secondary">
                {num(row.stratum.person_years).toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })}
              </td>
              <td className="px-4 py-2 text-right font-mono text-text-secondary">
                {num(row.stratum.persons_with_outcome).toLocaleString()}
              </td>
              <td className="px-4 py-2 text-right font-mono font-medium" style={{ color: "var(--success)" }}>
                {fmt(row.stratum.incidence_rate, 2)}
              </td>
              <td className="px-4 py-2 text-right font-mono text-text-muted">
                {row.stratum.rate_95_ci_lower != null &&
                row.stratum.rate_95_ci_upper != null
                  ? `(${fmt(row.stratum.rate_95_ci_lower, 2)} – ${fmt(row.stratum.rate_95_ci_upper, 2)})`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Forest Plot
// ---------------------------------------------------------------------------

function ForestPlot({ results }: { results: IncidenceRateResult[] }) {
  const { t } = useTranslation("app");
  if (results.length === 0) return null;

  const maxRate = Math.max(
    ...results.map((r) => num(r.rate_95_ci_upper) || num(r.incidence_rate) * 1.5),
  );
  const scale = maxRate > 0 ? 100 / maxRate : 1;

  return (
    <div className="panel space-y-3">
      <h4 className="panel-title" style={{ fontSize: "var(--text-base)" }}>
        {t("analyses.auto.forestPlotIRPer1000PY_dec35e")}
      </h4>
      <div className="space-y-2">
        {results.map((r) => {
          const precision = ciPrecision(r.incidence_rate, r.rate_95_ci_lower, r.rate_95_ci_upper);
          const dotColor =
            precision === "narrow"
              ? "var(--primary)"
              : precision === "wide"
                ? "var(--accent)"
                : "var(--primary)";

          return (
            <div key={r.outcome_cohort_id} className="flex items-center gap-3">
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
                <span
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "var(--text-xs)",
                    color: "var(--text-secondary)",
                  }}
                >
                  {fmt(r.incidence_rate, 1)}
                  <span style={{ color: "var(--text-ghost)" }}>
                    {" "}
                    ({fmt(r.rate_95_ci_lower, 1)}-{fmt(r.rate_95_ci_upper, 1)})
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

// ---------------------------------------------------------------------------
// Sortable header
// ---------------------------------------------------------------------------

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
            isActive
              ? "opacity-100 text-success"
              : "opacity-30 group-hover:opacity-60",
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

// ---------------------------------------------------------------------------
// Expandable row (with CI visualization)
// ---------------------------------------------------------------------------

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
          "border-t border-border-subtle transition-colors",
          hasStrata && "cursor-pointer hover:bg-surface-overlay",
        )}
        onClick={() => hasStrata && setExpanded(!expanded)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-1.5">
            {hasStrata &&
              (expanded ? (
                <ChevronDown size={12} className="text-text-muted" />
              ) : (
                <ChevronRight size={12} className="text-text-muted" />
              ))}
            <span className="text-sm text-text-primary">{result.outcome_cohort_name}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-sm text-text-secondary">
          {num(result.persons_at_risk).toLocaleString()}
        </td>
        <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-sm text-text-secondary">
          {num(result.persons_with_outcome).toLocaleString()}
        </td>
        <td className="px-4 py-3 text-right font-['IBM_Plex_Mono',monospace] text-sm text-text-secondary">
          {num(result.person_years).toLocaleString(undefined, { maximumFractionDigits: 1 })}
        </td>
        <td
          className="px-4 py-3 text-right"
          style={irCellStyle(num(result.incidence_rate), maxIR, precision)}
        >
          <span className="font-['IBM_Plex_Mono',monospace] text-sm font-medium text-success">
            {fmt(result.incidence_rate, 2)}
          </span>
          {precision !== "medium" && (
            <span
              data-testid="ci-precision-indicator"
              className={cn(
                "ml-1.5 inline-block h-1.5 w-1.5 rounded-full",
                precision === "narrow" ? "bg-success" : "bg-accent",
              )}
              title={precision === "narrow" ? "Narrow CI (precise)" : "Wide CI (imprecise)"}
            />
          )}
        </td>
        {/* Inline CI bar + numeric */}
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-2">
            <CIBar
              ir={num(result.incidence_rate)}
              ciLower={num(result.rate_95_ci_lower)}
              ciUpper={num(result.rate_95_ci_upper)}
              maxRate={maxIR}
            />
            <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-muted whitespace-nowrap">
              ({fmt(result.rate_95_ci_lower, 2)} – {fmt(result.rate_95_ci_upper, 2)})
            </span>
          </div>
        </td>
      </tr>
      {expanded &&
        result.strata?.map((s) => (
          <tr
            key={`${result.outcome_cohort_id}-${s.stratum_name}-${s.stratum_value}`}
            className="border-t border-border-subtle bg-surface-base"
          >
            <td className="px-4 py-2 pl-10">
              <span className="text-xs text-text-muted">
                {s.stratum_name}: {s.stratum_value}
              </span>
            </td>
            <td className="px-4 py-2 text-right font-['IBM_Plex_Mono',monospace] text-xs text-text-muted">
              {num(s.persons_at_risk).toLocaleString()}
            </td>
            <td className="px-4 py-2 text-right font-['IBM_Plex_Mono',monospace] text-xs text-text-muted">
              {num(s.persons_with_outcome).toLocaleString()}
            </td>
            <td className="px-4 py-2 text-right font-['IBM_Plex_Mono',monospace] text-xs text-text-muted">
              {num(s.person_years).toLocaleString(undefined, { maximumFractionDigits: 1 })}
            </td>
            <td className="px-4 py-2 text-right font-['IBM_Plex_Mono',monospace] text-xs text-text-secondary">
              {fmt(s.incidence_rate, 2)}
            </td>
            <td className="px-4 py-2 text-right font-['IBM_Plex_Mono',monospace] text-xs text-text-muted">
              {s.rate_95_ci_lower != null && s.rate_95_ci_upper != null
                ? `(${fmt(s.rate_95_ci_lower, 2)} – ${fmt(s.rate_95_ci_upper, 2)})`
                : "—"}
            </td>
          </tr>
        ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Direct-calc multi-TAR selector
// ---------------------------------------------------------------------------

function TarSelector({
  rows,
  selectedTarId,
  onSelect,
}: {
  rows: DirectCalcRateRow[];
  selectedTarId: number | null;
  onSelect: (id: number) => void;
}) {
  const { t } = useTranslation("app");
  const tarOptions = useMemo(() => {
    const seen = new Map<number, string>();
    rows.forEach((r) => seen.set(r.tar_id, r.tar_label));
    return [...seen.entries()].map(([id, label]) => ({ id, label }));
  }, [rows]);

  if (tarOptions.length <= 1) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs" style={{ color: "var(--text-muted)" }}>
        {t("analyses.auto.timeAtRisk_57746f")}
      </span>
      {tarOptions.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onSelect(opt.id)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium border transition-colors",
            selectedTarId === opt.id
              ? "border-success/50 bg-success/10 text-success"
              : "border-border-default bg-surface-raised text-text-muted hover:text-text-secondary",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner renderer (shared between queue-based and direct calc)
// ---------------------------------------------------------------------------

function IncidenceRateResultsInner({
  results,
  sortField,
  sortDir,
  onSort,
  summaryTotalPersons,
  summaryTotalPY,
  summaryTotalOutcomes,
  isDirectCalc,
  metadataLine,
}: {
  results: IncidenceRateResult[];
  sortField: SortField;
  sortDir: SortDir;
  onSort: (field: SortField) => void;
  summaryTotalPersons?: number;
  summaryTotalPY?: number;
  summaryTotalOutcomes?: number;
  isDirectCalc?: boolean;
  metadataLine?: string;
}) {
  const { t } = useTranslation("app");
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
      {/* Badge for direct calc */}
      {isDirectCalc && (
        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center gap-1.5 rounded-md border border-success/30 bg-success/5 px-2.5 py-1 text-xs font-medium"
            style={{ color: "var(--success)" }}
          >
            <Zap size={11} />
            {t("analyses.auto.oHDSICohortIncidenceDirectResult_68933a")}
          </span>
          {metadataLine && (
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>
              {metadataLine}
            </span>
          )}
        </div>
      )}

      {/* Verdict Dashboard */}
      <IncidenceRateVerdictDashboard results={results} />

      {/* Summary Cards */}
      <SummaryCards
        results={results}
        totalPersons={summaryTotalPersons}
        totalPersonYears={summaryTotalPY}
        totalOutcomes={summaryTotalOutcomes}
        isDirectCalc={isDirectCalc}
      />

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
              <ExpandableRow key={r.outcome_cohort_id} result={r} maxIR={maxIR} />
            ))}
          </tbody>
        </table>
      </div>

      {/* Forest Plot */}
      <ForestPlot results={sortedResults} />

      {/* Stratified breakdowns */}
      <StratifiedBreakdown results={results} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Direct calc results panel
// ---------------------------------------------------------------------------

function DirectCalcResultsPanel({
  directResults,
  sortField,
  sortDir,
  onSort,
}: {
  directResults: DirectCalcResponse;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
}) {
  const allRows = directResults.incidence_rates;

  const tarIds = useMemo(() => {
    const seen = new Map<number, string>();
    allRows.forEach((r) => seen.set(r.tar_id, r.tar_label));
    return [...seen.entries()].map(([id]) => id);
  }, [allRows]);

  const [selectedTarId, setSelectedTarId] = useState<number>(tarIds[0] ?? 0);

  const filteredRows = useMemo(
    () => allRows.filter((r) => r.tar_id === selectedTarId),
    [allRows, selectedTarId],
  );

  const results = useMemo(() => directRowsToResults(filteredRows), [filteredRows]);

  const metadataLine = useMemo(() => {
    const { metadata, summary } = directResults;
    const parts: string[] = [];
    if (metadata?.executed_at) {
      parts.push(`Executed ${new Date(metadata.executed_at).toLocaleString()}`);
    }
    if (metadata?.duration_seconds != null) {
      parts.push(`${metadata.duration_seconds.toFixed(1)}s`);
    }
    if (metadata?.r_version) {
      parts.push(`R ${metadata.r_version}`);
    }
    if (summary?.sources_used?.length) {
      parts.push(`Source: ${summary.sources_used.join(", ")}`);
    }
    return parts.join(" · ");
  }, [directResults]);

  return (
    <div className="space-y-4">
      <TarSelector
        rows={allRows}
        selectedTarId={selectedTarId}
        onSelect={setSelectedTarId}
      />
      <IncidenceRateResultsInner
        results={results}
        sortField={sortField}
        sortDir={sortDir}
        onSort={onSort}
        summaryTotalPersons={directResults.summary?.total_persons}
        summaryTotalPY={directResults.summary?.total_person_years}
        summaryTotalOutcomes={directResults.summary?.total_outcomes}
        isDirectCalc
        metadataLine={metadataLine}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

export function IncidenceRateResults({
  execution,
  isLoading,
  directResults,
}: IncidenceRateResultsProps) {
  const { t } = useTranslation("app");
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
        <Loader2 size={24} className="animate-spin text-text-muted" />
      </div>
    );
  }

  // Direct calc results take priority
  if (directResults) {
    const normalizedDirectResults = normalizeDirectCalcResponse(directResults);
    if (normalizedDirectResults.incidence_rates.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
          <AlertCircle size={24} className="text-text-ghost mb-3" />
          <p className="text-sm text-text-muted">
            {t("analyses.auto.cohortIncidenceCompletedButReturnedNoResults_c0a47d")}
          </p>
        </div>
      );
    }
    return (
      <DirectCalcResultsPanel
        directResults={normalizedDirectResults}
        sortField={sortField}
        sortDir={sortDir}
        onSort={handleSort}
      />
    );
  }

  if (!execution || execution.status !== "completed") {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
        <AlertCircle size={24} className="text-text-ghost mb-3" />
        <h3 className="text-sm font-semibold text-text-primary">{t("analyses.auto.noResultsAvailable_e29de7")}</h3>
        <p className="mt-1 text-xs text-text-muted">
          {execution
            ? `Execution status: ${execution.status}`
            : "Execute the analysis to generate results."}
        </p>
        {execution?.fail_message && (
          <p className="mt-2 text-xs text-critical max-w-md text-center">
            {execution.fail_message}
          </p>
        )}
      </div>
    );
  }

  const results = parseResults(execution);

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-16">
        <AlertCircle size={24} className="text-text-ghost mb-3" />
        <p className="text-sm text-text-muted">
          {t("analyses.auto.executionCompletedButNoResultsWereReturned_bc0318")}
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
