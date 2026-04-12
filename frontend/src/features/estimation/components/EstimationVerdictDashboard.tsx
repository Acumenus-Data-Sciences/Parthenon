import {
  SignificanceVerdictBadge,
  getVerdict,
  ChartMetricCard,
  CIBar,
} from "@/components/charts";
import { fmt, num, fmtP, computeNNT } from "@/lib/formatters";
import type { EstimationResult } from "../types/estimation";

interface EstimationVerdictDashboardProps {
  result: EstimationResult;
}

/**
 * Verdict dashboard showing the primary estimate with direction arrow,
 * calibrated vs uncalibrated p-values, NNT/NNH, significance badge, and CI bar.
 * Renders above the existing EstimationResults content.
 */
export function EstimationVerdictDashboard({
  result,
}: EstimationVerdictDashboardProps) {
  const estimates = Array.isArray(result.estimates) ? result.estimates : [];
  const summary = result.summary ?? {
    target_count: 0,
    comparator_count: 0,
    outcome_counts: {},
  };

  const primary = estimates[0];
  if (!primary) return null;

  const hr = num(primary.hazard_ratio);
  const ciLower = num(primary.ci_95_lower);
  const ciUpper = num(primary.ci_95_upper);
  const pValue = num(primary.p_value);
  const verdict = getVerdict(hr, pValue, ciLower, ciUpper);

  // NNT/NNH from KM curves at latest timepoint
  const nntResult = computeNNTFromKM(result);
  const nntLabel = nntResult.label;
  const nntValue = nntResult.value;

  // Calibrated p-value from negative controls (if available)
  const calibratedP = getCalibratedP(result);

  // Direction arrow
  const directionArrow =
    verdict === "protective" ? "\u2193" : verdict === "harmful" ? "\u2191" : "\u2194";
  const directionColor =
    verdict === "protective"
      ? "text-success"
      : verdict === "harmful"
        ? "text-critical"
        : "text-text-muted";

  // Total target events across all outcomes
  const targetEvents = estimates.reduce(
    (sum, e) => sum + num(e.target_outcomes),
    0,
  );

  return (
    <div
      data-testid="estimation-verdict-dashboard"
      className="rounded-lg border border-border-default bg-surface-base p-6 space-y-5"
    >
      {/* Top row: large HR + verdict badge */}
      <div className="flex flex-wrap items-center gap-6">
        {/* Large HR with direction arrow */}
        <div className="flex items-baseline gap-2">
          <span
            className={`text-3xl font-bold ${directionColor}`}
            aria-label={`Direction: ${verdict}`}
          >
            {directionArrow}
          </span>
          <span
            data-testid="verdict-hr-value"
            className={`font-['IBM_Plex_Mono',monospace] text-4xl font-bold ${directionColor}`}
          >
            {fmt(hr, 2)}
          </span>
          <span className="text-sm text-text-muted">HR</span>
        </div>

        {/* Significance verdict badge */}
        <SignificanceVerdictBadge
          hr={hr}
          pValue={pValue}
          ciLower={ciLower}
          ciUpper={ciUpper}
        />
      </div>

      {/* P-values row */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-text-muted">p-value:</span>
          <span className="font-['IBM_Plex_Mono',monospace] text-sm text-text-primary">
            {fmtP(pValue)}
          </span>
        </div>
        {calibratedP !== null && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-muted">
              calibrated p:
            </span>
            <span
              data-testid="calibrated-p"
              className="font-['IBM_Plex_Mono',monospace] text-sm text-accent"
            >
              {fmtP(calibratedP)}
            </span>
            {/* Visual indicator of shift direction */}
            <span className="text-xs text-text-ghost">
              ({calibratedP > pValue ? "\u2191" : "\u2193"} from uncalibrated)
            </span>
          </div>
        )}
      </div>

      {/* CI bar visualization */}
      <div>
        <span className="text-xs font-medium text-text-muted mb-1 block">
          95% Confidence Interval
        </span>
        <CIBar
          estimate={hr}
          ciLower={ciLower}
          ciUpper={ciUpper}
          nullValue={1}
          logScale
          width={400}
          height={32}
        />
        <span className="text-xs text-text-ghost mt-0.5 block font-['IBM_Plex_Mono',monospace]">
          {fmt(ciLower, 2)} - {fmt(ciUpper, 2)}
        </span>
      </div>

      {/* Metric cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <ChartMetricCard
          label="Target Cohort"
          value={num(summary.target_count).toLocaleString()}
          color="teal"
        />
        <ChartMetricCard
          label="Comparator Cohort"
          value={num(summary.comparator_count).toLocaleString()}
          color="gold"
        />
        <ChartMetricCard
          label="Target Events"
          value={targetEvents.toLocaleString()}
          color="default"
        />
        <ChartMetricCard
          label={nntLabel}
          value={nntValue}
          color={nntLabel === "NNT" ? "teal" : nntLabel === "NNH" ? "crimson" : "default"}
          subtitle={nntLabel === "NNT" || nntLabel === "NNH" ? "from KM curves" : undefined}
        />
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute NNT/NNH from Kaplan-Meier curves at the latest available timepoint.
 * Returns label ("NNT", "NNH", or "NNT/NNH") and formatted value.
 */
function computeNNTFromKM(result: EstimationResult): {
  label: string;
  value: string;
} {
  if (
    !result.kaplan_meier?.target?.length ||
    !result.kaplan_meier?.comparator?.length
  ) {
    return { label: "NNT/NNH", value: "N/A" };
  }

  const targetSorted = [...(result.kaplan_meier?.target ?? [])].sort(
    (a, b) => b.time - a.time,
  );
  const compSorted = [...(result.kaplan_meier?.comparator ?? [])].sort(
    (a, b) => b.time - a.time,
  );

  if (targetSorted.length === 0 || compSorted.length === 0) {
    return { label: "NNT/NNH", value: "N/A" };
  }

  const targetSurv = num(targetSorted[0].survival);
  const compSurv = num(compSorted[0].survival);

  const nnt = computeNNT(targetSurv, compSurv);

  if (!Number.isFinite(nnt)) {
    return { label: "NNT/NNH", value: "\u221E" };
  }

  if (nnt > 0) {
    return { label: "NNT", value: Math.round(Math.abs(nnt)).toString() };
  }
  return { label: "NNH", value: Math.round(Math.abs(nnt)).toString() };
}

/**
 * Extract a calibrated p-value estimate from negative controls.
 * Uses the mean calibrated log-RR from the primary outcome's negative control
 * analysis. Returns null if no calibrated values are available.
 */
function getCalibratedP(result: EstimationResult): number | null {
  if (!result.negative_controls?.length) return null;

  const withCalibrated = result.negative_controls.filter(
    (nc) =>
      nc.calibrated_log_rr !== undefined && nc.calibrated_se_log_rr !== undefined,
  );

  if (withCalibrated.length === 0) return null;

  // Use the mean calibrated effect as a bias estimate to derive calibrated p
  const meanCalLogRR =
    withCalibrated.reduce((s, nc) => s + num(nc.calibrated_log_rr), 0) /
    withCalibrated.length;
  const meanCalSE =
    withCalibrated.reduce((s, nc) => s + num(nc.calibrated_se_log_rr), 0) /
    withCalibrated.length;

  if (meanCalSE <= 0) return null;

  // Two-sided p-value from z-test
  const z = Math.abs(meanCalLogRR) / meanCalSE;
  const p = 2 * (1 - normalCDF(z));
  return p;
}

/** Standard normal CDF approximation (Abramowitz & Stegun 26.2.17) */
function normalCDF(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX / 2);
  return 0.5 * (1.0 + sign * y);
}
