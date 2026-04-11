import { useMemo } from "react";
import { cn } from "@/lib/utils";
import { fmt } from "@/lib/formatters";
import type { CovariateBalanceEntry } from "@/features/estimation/types/estimation";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type BalanceVerdict = "well-balanced" | "marginal" | "significant";

interface BalanceMetrics {
  totalCovariates: number;
  pctBelow01: number;
  pctAbove02: number;
  meanAbsSmd: number;
  verdict: BalanceVerdict;
}

interface CharacterizationVerdictDashboardProps {
  balanceEntries: CovariateBalanceEntry[];
  targetLabel?: string;
  comparatorLabel?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function computeBalanceMetrics(
  entries: CovariateBalanceEntry[],
  field: "smd_before" | "smd_after",
): BalanceMetrics {
  if (entries.length === 0) {
    return {
      totalCovariates: 0,
      pctBelow01: 0,
      pctAbove02: 0,
      meanAbsSmd: 0,
      verdict: "significant",
    };
  }

  const absSmdValues = entries.map((e) => Math.abs(e[field]));
  const below01 = absSmdValues.filter((v) => v < 0.1).length;
  const above02 = absSmdValues.filter((v) => v > 0.2).length;
  const meanAbs =
    absSmdValues.reduce((sum, v) => sum + v, 0) / absSmdValues.length;

  const pctBelow = (below01 / entries.length) * 100;

  let verdict: BalanceVerdict;
  if (pctBelow >= 90) {
    verdict = "well-balanced";
  } else if (pctBelow >= 75) {
    verdict = "marginal";
  } else {
    verdict = "significant";
  }

  return {
    totalCovariates: entries.length,
    pctBelow01: pctBelow,
    pctAbove02: (above02 / entries.length) * 100,
    meanAbsSmd: meanAbs,
    verdict,
  };
}

const VERDICT_CONFIG: Record<
  BalanceVerdict,
  { label: string; color: string; bgColor: string; borderColor: string }
> = {
  "well-balanced": {
    label: "Well balanced",
    color: "var(--success)",
    bgColor: "rgba(45,212,191,0.08)",
    borderColor: "rgba(45,212,191,0.25)",
  },
  marginal: {
    label: "Marginal imbalance",
    color: "var(--accent)",
    bgColor: "rgba(201,162,39,0.08)",
    borderColor: "rgba(201,162,39,0.25)",
  },
  significant: {
    label: "Significant imbalance",
    color: "var(--critical)",
    bgColor: "rgba(232,90,107,0.08)",
    borderColor: "rgba(232,90,107,0.25)",
  },
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function MetricStrip({
  metrics,
  label,
}: {
  metrics: BalanceMetrics;
  label?: string;
}) {
  const config = VERDICT_CONFIG[metrics.verdict];

  return (
    <div className="space-y-2">
      {label && (
        <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
          {label}
        </p>
      )}
      <div
        className="rounded-lg border px-4 py-3"
        style={{
          backgroundColor: config.bgColor,
          borderColor: config.borderColor,
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: config.color }}
          />
          <span
            className="text-sm font-semibold"
            style={{ color: config.color }}
            data-testid="verdict-label"
          >
            {config.label}
          </span>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div>
            <p className="text-[10px] text-text-muted">Total covariates</p>
            <p className="font-['IBM_Plex_Mono',monospace] text-sm font-semibold text-text-primary">
              {metrics.totalCovariates}
            </p>
          </div>
          <div>
            <p className="text-[10px] text-text-muted">|SMD| &lt; 0.1</p>
            <p className="font-['IBM_Plex_Mono',monospace] text-sm font-semibold text-success">
              {fmt(metrics.pctBelow01, 1)}%
            </p>
          </div>
          <div>
            <p className="text-[10px] text-text-muted">|SMD| &gt; 0.2</p>
            <p className="font-['IBM_Plex_Mono',monospace] text-sm font-semibold text-critical">
              {fmt(metrics.pctAbove02, 1)}%
            </p>
          </div>
          <div>
            <p className="text-[10px] text-text-muted">Mean |SMD|</p>
            <p className="font-['IBM_Plex_Mono',monospace] text-sm font-semibold text-text-secondary">
              {fmt(metrics.meanAbsSmd)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ImbalancedCovariateBar({
  entry,
  maxAbsSmd,
  targetLabel,
  comparatorLabel,
}: {
  entry: CovariateBalanceEntry;
  maxAbsSmd: number;
  targetLabel: string;
  comparatorLabel: string;
}) {
  const smd = entry.smd_after;
  const absSmd = Math.abs(smd);
  const barWidth = maxAbsSmd > 0 ? (absSmd / maxAbsSmd) * 100 : 0;

  // Positive SMD = higher in target (bar goes left), negative = higher in comparator (bar goes right)
  // Using smd_before's sign for direction since characterization SMD is computed as (target - comparator)
  const isHigherInTarget = smd >= 0;

  // Color intensity based on magnitude
  const intensity = Math.min(absSmd / 0.3, 1);
  const color = isHigherInTarget
    ? `rgba(45,212,191,${0.4 + intensity * 0.6})`
    : `rgba(232,90,107,${0.4 + intensity * 0.6})`;

  const targetPrev = entry.mean_target_after;
  const compPrev = entry.mean_comp_after;

  return (
    <div className="flex items-center gap-2 py-1.5" data-testid="imbalanced-bar">
      {/* Covariate name */}
      <div className="w-48 shrink-0 text-right pr-2">
        <p
          className="text-xs text-text-primary truncate"
          title={entry.covariate_name}
        >
          {entry.covariate_name}
        </p>
        <p className="text-[10px] text-text-ghost">
          {targetLabel}: {fmt(targetPrev, 1)}% | {comparatorLabel}:{" "}
          {fmt(compPrev, 1)}%
        </p>
      </div>

      {/* Diverging bar */}
      <div className="flex-1 flex items-center">
        {/* Left side (higher in target) */}
        <div className="flex-1 flex justify-end">
          {isHigherInTarget && (
            <div
              className="h-5 rounded-l"
              style={{
                width: `${barWidth}%`,
                backgroundColor: color,
                minWidth: absSmd > 0 ? "4px" : "0",
              }}
            />
          )}
        </div>
        {/* Center line */}
        <div className="w-px h-7 bg-text-ghost shrink-0" />
        {/* Right side (higher in comparator) */}
        <div className="flex-1">
          {!isHigherInTarget && (
            <div
              className="h-5 rounded-r"
              style={{
                width: `${barWidth}%`,
                backgroundColor: color,
                minWidth: absSmd > 0 ? "4px" : "0",
              }}
            />
          )}
        </div>
      </div>

      {/* SMD value */}
      <div className="w-16 shrink-0 text-right">
        <span
          className={cn(
            "font-['IBM_Plex_Mono',monospace] text-xs font-medium",
            absSmd > 0.2
              ? "text-critical"
              : absSmd > 0.1
                ? "text-[#F59E0B]"
                : "text-text-secondary",
          )}
        >
          {fmt(absSmd)}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function CharacterizationVerdictDashboard({
  balanceEntries,
  targetLabel = "Target",
  comparatorLabel = "Comparator",
}: CharacterizationVerdictDashboardProps) {
  const hasBefore = useMemo(
    () =>
      balanceEntries.some(
        (e) => e.smd_before !== e.smd_after,
      ),
    [balanceEntries],
  );

  const afterMetrics = useMemo(
    () => computeBalanceMetrics(balanceEntries, "smd_after"),
    [balanceEntries],
  );

  const beforeMetrics = useMemo(
    () => (hasBefore ? computeBalanceMetrics(balanceEntries, "smd_before") : null),
    [balanceEntries, hasBefore],
  );

  const topImbalanced = useMemo(() => {
    const sorted = [...balanceEntries].sort(
      (a, b) => Math.abs(b.smd_after) - Math.abs(a.smd_after),
    );
    return sorted.slice(0, 10).filter((e) => Math.abs(e.smd_after) > 0);
  }, [balanceEntries]);

  const maxAbsSmd = useMemo(
    () =>
      topImbalanced.length > 0
        ? Math.max(...topImbalanced.map((e) => Math.abs(e.smd_after)))
        : 1,
    [topImbalanced],
  );

  if (balanceEntries.length === 0) return null;

  return (
    <div
      className="space-y-4"
      data-testid="characterization-verdict-dashboard"
    >
      {/* Balance Summary Card */}
      <div className="rounded-lg border border-border-default bg-surface-raised p-4">
        <h3 className="text-sm font-semibold text-text-primary mb-4">
          Cohort Balance Summary
        </h3>

        {beforeMetrics ? (
          <div className="grid grid-cols-2 gap-4">
            <MetricStrip metrics={beforeMetrics} label="Before matching" />
            <MetricStrip metrics={afterMetrics} label="After matching" />
          </div>
        ) : (
          <MetricStrip metrics={afterMetrics} />
        )}
      </div>

      {/* Top Imbalanced Covariates */}
      {topImbalanced.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-4">
          <h3 className="text-sm font-semibold text-text-primary mb-1">
            Top Imbalanced Covariates
          </h3>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[10px] text-text-ghost">
              Diverging bars show direction of imbalance
            </p>
            <div className="flex items-center gap-3 text-[10px] text-text-ghost">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-4 rounded bg-success/60" />
                Higher in {targetLabel}
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-4 rounded bg-critical/60" />
                Higher in {comparatorLabel}
              </span>
            </div>
          </div>

          <div className="divide-y divide-surface-overlay">
            {topImbalanced.map((entry) => (
              <ImbalancedCovariateBar
                key={entry.covariate_name}
                entry={entry}
                maxAbsSmd={maxAbsSmd}
                targetLabel={targetLabel}
                comparatorLabel={comparatorLabel}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
