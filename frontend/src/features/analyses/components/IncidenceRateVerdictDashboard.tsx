import { useMemo } from "react";
import { ChartMetricCard } from "@/components/charts";
import { fmt, num, computeRateDifference, computeRateRatio } from "@/lib/formatters";
import type { IncidenceRateResult, IncidenceRateStratum } from "../types/analysis";

interface IncidenceRateVerdictDashboardProps {
  results: IncidenceRateResult[];
}

type IRDVerdict = "higher" | "lower" | "not_significant";

interface StratumComparison {
  stratumLabel: string;
  rate1: number;
  rate2: number;
  ird: number;
  ciLower: number;
  ciUpper: number;
  directionReversed: boolean;
}

const VERDICT_CONFIG: Record<
  IRDVerdict,
  { label: string; icon: string; colorClasses: string }
> = {
  higher: {
    label: "Significantly higher rate",
    icon: "\u2191",
    colorClasses: "bg-[#E85A6B]/15 text-[#E85A6B] border-[#E85A6B]/30",
  },
  lower: {
    label: "Significantly lower rate",
    icon: "\u2193",
    colorClasses: "bg-[#2DD4BF]/15 text-[#2DD4BF] border-[#2DD4BF]/30",
  },
  not_significant: {
    label: "No significant difference",
    icon: "\u2194",
    colorClasses: "bg-[#8A857D]/15 text-[#8A857D] border-[#8A857D]/30",
  },
};

function getIRDVerdict(ciLower: number, ciUpper: number, ird: number): IRDVerdict {
  // If CI spans 0, not significant
  if (ciLower <= 0 && ciUpper >= 0) return "not_significant";
  return ird > 0 ? "higher" : "lower";
}

function irdColor(verdict: IRDVerdict): string {
  if (verdict === "higher") return "text-[#E85A6B]";
  if (verdict === "lower") return "text-[#2DD4BF]";
  return "text-[#8A857D]";
}

/**
 * Build stratified comparisons between two results by matching strata.
 */
function buildStrataComparisons(
  strata1: IncidenceRateStratum[],
  strata2: IncidenceRateStratum[],
  overallIrdSign: number,
): StratumComparison[] {
  const map2 = new Map<string, IncidenceRateStratum>();
  for (const s of strata2) {
    map2.set(`${s.stratum_name}:${s.stratum_value}`, s);
  }

  const comparisons: StratumComparison[] = [];
  for (const s1 of strata1) {
    const key = `${s1.stratum_name}:${s1.stratum_value}`;
    const s2 = map2.get(key);
    if (!s2) continue;

    const r1 = num(s1.incidence_rate);
    const r2 = num(s2.incidence_rate);
    const py1 = num(s1.person_years);
    const py2 = num(s2.person_years);
    const diff = computeRateDifference(r1, r2, py1, py2);

    comparisons.push({
      stratumLabel: `${s1.stratum_name}: ${s1.stratum_value}`,
      rate1: r1,
      rate2: r2,
      ird: diff.ird,
      ciLower: diff.ciLower,
      ciUpper: diff.ciUpper,
      directionReversed:
        overallIrdSign !== 0 && Math.sign(diff.ird) !== overallIrdSign,
    });
  }

  // Sort by absolute IRD magnitude descending
  return comparisons.sort((a, b) => Math.abs(b.ird) - Math.abs(a.ird));
}

/**
 * Verdict dashboard for incidence rate analyses.
 * When 2+ results exist, shows comparative IR, rate difference (IRD),
 * rate ratio (IRR), significance verdict, and stratified comparisons.
 * When only 1 result, shows summary metrics.
 */
export function IncidenceRateVerdictDashboard({
  results,
}: IncidenceRateVerdictDashboardProps) {
  if (results.length === 0) return null;

  const isComparative = results.length >= 2;
  const r1 = results[0];
  const r2 = isComparative ? results[1] : null;

  const comparison = useMemo(() => {
    if (!r2) return null;

    const rate1 = num(r1.incidence_rate);
    const rate2 = num(r2.incidence_rate);
    const py1 = num(r1.person_years);
    const py2 = num(r2.person_years);

    const diff = computeRateDifference(rate1, rate2, py1, py2);
    const ratio = computeRateRatio(rate1, rate2, py1, py2);
    const verdict = getIRDVerdict(diff.ciLower, diff.ciUpper, diff.ird);

    // Build stratified comparisons
    const hasStrata = (r1.strata?.length ?? 0) > 0 && (r2.strata?.length ?? 0) > 0;
    const strataComparisons = hasStrata
      ? buildStrataComparisons(
          r1.strata ?? [],
          r2.strata ?? [],
          Math.sign(diff.ird),
        )
      : [];

    return { diff, ratio, verdict, strataComparisons };
  }, [r1, r2]);

  // Single-result mode: just show summary metrics
  if (!isComparative || !comparison) {
    return (
      <div
        data-testid="ir-verdict-dashboard"
        className="rounded-lg border border-[#232328] bg-[#0E0E11] p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-baseline gap-2">
            <span
              data-testid="verdict-ir-value"
              className="font-['IBM_Plex_Mono',monospace] text-4xl font-bold text-[#2DD4BF]"
            >
              {fmt(r1.incidence_rate, 2)}
            </span>
            <span className="text-sm text-[#8A857D]">per 1,000 PY</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ChartMetricCard
            label="Persons at Risk"
            value={num(r1.persons_at_risk).toLocaleString()}
            color="teal"
          />
          <ChartMetricCard
            label="Events"
            value={num(r1.persons_with_outcome).toLocaleString()}
            color="gold"
          />
          <ChartMetricCard
            label="Person-Years"
            value={num(r1.person_years).toLocaleString(undefined, { maximumFractionDigits: 1 })}
            color="default"
          />
          <ChartMetricCard
            label="95% CI"
            value={`${fmt(r1.rate_95_ci_lower, 2)} - ${fmt(r1.rate_95_ci_upper, 2)}`}
            color="default"
          />
        </div>
      </div>
    );
  }

  const { diff, ratio, verdict, strataComparisons } = comparison;
  const verdictConfig = VERDICT_CONFIG[verdict];

  return (
    <div
      data-testid="ir-verdict-dashboard"
      className="rounded-lg border border-[#232328] bg-[#0E0E11] p-6 space-y-5"
    >
      {/* Comparative IR Cards */}
      <div className="flex flex-wrap items-start gap-6">
        {/* Cohort 1 */}
        <div className="flex-1 min-w-[200px]">
          <span className="text-xs font-medium uppercase tracking-wider text-[#8A857D]">
            {r1.outcome_cohort_name}
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              data-testid="verdict-ir-value-1"
              className="font-['IBM_Plex_Mono',monospace] text-3xl font-bold text-[#2DD4BF]"
            >
              {fmt(r1.incidence_rate, 2)}
            </span>
            <span className="text-xs text-[#8A857D]">per 1,000 PY</span>
          </div>
          <span className="text-xs text-[#5A5650]">
            {num(r1.persons_with_outcome).toLocaleString()} events | {num(r1.person_years).toLocaleString(undefined, { maximumFractionDigits: 1 })} PY
          </span>
        </div>

        {/* vs separator */}
        <div className="flex items-center self-center">
          <span className="text-sm font-medium text-[#5A5650]">vs</span>
        </div>

        {/* Cohort 2 */}
        <div className="flex-1 min-w-[200px]">
          <span className="text-xs font-medium uppercase tracking-wider text-[#8A857D]">
            {r2.outcome_cohort_name}
          </span>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              data-testid="verdict-ir-value-2"
              className="font-['IBM_Plex_Mono',monospace] text-3xl font-bold text-[#C9A227]"
            >
              {fmt(r2.incidence_rate, 2)}
            </span>
            <span className="text-xs text-[#8A857D]">per 1,000 PY</span>
          </div>
          <span className="text-xs text-[#5A5650]">
            {num(r2.persons_with_outcome).toLocaleString()} events | {num(r2.person_years).toLocaleString(undefined, { maximumFractionDigits: 1 })} PY
          </span>
        </div>
      </div>

      {/* Rate Difference + Rate Ratio row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* IRD */}
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-[#8A857D]">
            Rate Difference (IRD)
          </span>
          <div className={`mt-1 font-['IBM_Plex_Mono',monospace] text-2xl font-bold ${irdColor(verdict)}`}>
            <span data-testid="ird-value">
              {diff.ird >= 0 ? "+" : ""}{fmt(diff.ird, 2)}
            </span>
          </div>
          <span className="text-xs text-[#5A5650]">
            95% CI: {fmt(diff.ciLower, 2)} to {fmt(diff.ciUpper, 2)}
          </span>
          <p className="mt-1 text-xs text-[#8A857D]">
            {verdict === "not_significant"
              ? "No significant difference in incidence rates"
              : `${Math.abs(num(diff.ird)).toFixed(1)} additional events per 1,000 person-years`}
          </p>
        </div>

        {/* IRR */}
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <span className="text-xs font-medium uppercase tracking-wider text-[#8A857D]">
            Rate Ratio (IRR)
          </span>
          {ratio ? (
            <>
              <div className={`mt-1 font-['IBM_Plex_Mono',monospace] text-2xl font-bold ${irdColor(verdict)}`}>
                <span data-testid="irr-value">{fmt(ratio.irr, 2)}</span>
              </div>
              <span className="text-xs text-[#5A5650]">
                95% CI: {fmt(ratio.ciLower, 2)} to {fmt(ratio.ciUpper, 2)}
              </span>
            </>
          ) : (
            <div className="mt-1 text-2xl font-bold text-[#8A857D]">N/A</div>
          )}
        </div>
      </div>

      {/* Significance verdict badge */}
      <div className="flex items-center gap-3">
        <span
          data-testid="ir-verdict-badge"
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${verdictConfig.colorClasses}`}
        >
          <span aria-hidden="true">{verdictConfig.icon}</span>
          {verdictConfig.label}
        </span>
      </div>

      {/* Stratified Comparison Panel */}
      {strataComparisons.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-[#F0EDE8]">
            Stratified Comparisons
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {strataComparisons.map((sc) => (
              <StratumCard
                key={sc.stratumLabel}
                comparison={sc}
                cohort1Name={r1.outcome_cohort_name}
                cohort2Name={r2.outcome_cohort_name}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// -- Stratum Card -------------------------------------------------------------

function StratumCard({
  comparison,
  cohort1Name,
  cohort2Name,
}: {
  comparison: StratumComparison;
  cohort1Name: string;
  cohort2Name: string;
}) {
  const maxRate = Math.max(comparison.rate1, comparison.rate2, 1);

  return (
    <div
      data-testid="stratum-card"
      className={`rounded-lg border p-3 ${
        comparison.directionReversed
          ? "border-[#C9A227]/50 bg-[#C9A227]/5"
          : "border-[#232328] bg-[#151518]"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-[#F0EDE8] truncate">
          {comparison.stratumLabel}
        </span>
        {comparison.directionReversed && (
          <span
            data-testid="direction-reversed-flag"
            className="text-[10px] font-medium text-[#C9A227] uppercase tracking-wider"
          >
            Reversed
          </span>
        )}
      </div>

      {/* Mini bar pair */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <div
            className="h-3 rounded-sm bg-[#2DD4BF]"
            style={{ width: `${(comparison.rate1 / maxRate) * 100}%`, minWidth: 2 }}
          />
          <span className="text-[10px] font-['IBM_Plex_Mono',monospace] text-[#8A857D] shrink-0">
            {fmt(comparison.rate1, 1)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="h-3 rounded-sm bg-[#C9A227]"
            style={{ width: `${(comparison.rate2 / maxRate) * 100}%`, minWidth: 2 }}
          />
          <span className="text-[10px] font-['IBM_Plex_Mono',monospace] text-[#8A857D] shrink-0">
            {fmt(comparison.rate2, 1)}
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-[10px] text-[#5A5650]">
        <span className="truncate" title={cohort1Name}>
          {cohort1Name.slice(0, 15)}
        </span>
        <span className="font-['IBM_Plex_Mono',monospace]">
          IRD: {comparison.ird >= 0 ? "+" : ""}{fmt(comparison.ird, 1)}
        </span>
        <span className="truncate" title={cohort2Name}>
          {cohort2Name.slice(0, 15)}
        </span>
      </div>
    </div>
  );
}
