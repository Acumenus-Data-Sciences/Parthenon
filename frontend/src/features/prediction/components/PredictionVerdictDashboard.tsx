import { useState, useMemo } from "react";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { TrafficLightBadge, ChartMetricCard, InterpretationTooltip } from "@/components/charts";
import type { TrafficLightColor } from "@/components/charts";
import { fmt, num } from "@/lib/formatters";
import type { PredictionResult } from "../types/prediction";

interface PredictionVerdictDashboardProps {
  result: PredictionResult;
}

// ---------------------------------------------------------------------------
// Classification helpers
// ---------------------------------------------------------------------------

function aucColor(auc: number): TrafficLightColor {
  if (auc >= 0.8) return "green";
  if (auc >= 0.7) return "amber";
  return "red";
}

function aucLabel(auc: number): string {
  if (auc >= 0.8) return "Good";
  if (auc >= 0.7) return "Acceptable";
  return "Poor";
}

function slopeColor(slope: number): TrafficLightColor {
  if (slope >= 0.8 && slope <= 1.2) return "green";
  if ((slope >= 0.6 && slope < 0.8) || (slope > 1.2 && slope <= 1.4)) return "amber";
  return "red";
}

function slopeLabel(slope: number): string {
  if (slope >= 0.8 && slope <= 1.2) return "Well calibrated";
  if ((slope >= 0.6 && slope < 0.8) || (slope > 1.2 && slope <= 1.4)) return "Marginal";
  return "Poorly calibrated";
}

type Verdict = "ready" | "recalibrate" | "insufficient";

function computeVerdict(auc: number, slope: number): Verdict {
  if (auc >= 0.8 && slope >= 0.8 && slope <= 1.2) return "ready";
  if (auc >= 0.7) return "recalibrate";
  return "insufficient";
}

const verdictConfig: Record<
  Verdict,
  { label: string; icon: typeof ShieldCheck; color: TrafficLightColor; description: string }
> = {
  ready: {
    label: "Ready for validation",
    icon: ShieldCheck,
    color: "green",
    description: "Model shows good discrimination (AUC >= 0.80) and well-calibrated predictions (slope 0.8-1.2). Suitable for external validation studies.",
  },
  recalibrate: {
    label: "Needs recalibration",
    icon: ShieldAlert,
    color: "amber",
    description: "Model has acceptable discrimination (AUC >= 0.70) but calibration is outside ideal range. Consider recalibration before deployment.",
  },
  insufficient: {
    label: "Insufficient discrimination",
    icon: ShieldX,
    color: "red",
    description: "Model discrimination is below acceptable threshold (AUC < 0.70). Consider alternative feature engineering or model architectures.",
  },
};

// ---------------------------------------------------------------------------
// Threshold-based operating characteristics from ROC data
// ---------------------------------------------------------------------------

interface OperatingPoint {
  threshold: number;
  sensitivity: number;
  specificity: number;
  ppv: number;
  npv: number;
}

function computeOperatingPoint(
  rocData: { fpr: number; tpr: number }[],
  thresholdValue: number,
  outcomeRate: number,
): OperatingPoint {
  if (rocData.length === 0) {
    return { threshold: thresholdValue, sensitivity: 0, specificity: 0, ppv: 0, npv: 0 };
  }

  // ROC data is (fpr, tpr) at various thresholds.
  // We approximate: threshold index = thresholdValue mapped across sorted ROC points.
  // Since ROC data doesn't carry explicit thresholds, we use the index position.
  const sorted = [...rocData].sort((a, b) => a.fpr - b.fpr);

  // Find closest point to the threshold on the curve
  // Threshold maps to an operating point: higher threshold = lower FPR (more conservative)
  // We map threshold [0,1] to index in reverse order
  const idx = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round((1 - thresholdValue) * (sorted.length - 1))),
  );

  const point = sorted[idx];
  const sensitivity = point.tpr;
  const specificity = 1 - point.fpr;

  // PPV and NPV from Bayes' theorem
  const prevalence = outcomeRate;
  const ppvNum = sensitivity * prevalence;
  const ppvDen = ppvNum + (1 - specificity) * (1 - prevalence);
  const ppv = ppvDen > 0 ? ppvNum / ppvDen : 0;

  const npvNum = specificity * (1 - prevalence);
  const npvDen = npvNum + (1 - sensitivity) * prevalence;
  const npv = npvDen > 0 ? npvNum / npvDen : 0;

  return { threshold: thresholdValue, sensitivity, specificity, ppv, npv };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PredictionVerdictDashboard({ result }: PredictionVerdictDashboardProps) {
  const [threshold, setThreshold] = useState(0.1);

  const auc = num(result.performance.auc);
  const slope = num(result.performance.calibration_slope);
  const verdict = computeVerdict(auc, slope);
  const config = verdictConfig[verdict];
  const VerdictIcon = config.icon;

  // Net benefit at default threshold
  const netBenefitAtThreshold = useMemo(() => {
    if (!result.net_benefit || result.net_benefit.length === 0) return null;
    // Find closest threshold
    let closest = result.net_benefit[0];
    let minDist = Math.abs(closest.threshold - threshold);
    for (const nb of result.net_benefit) {
      const dist = Math.abs(nb.threshold - threshold);
      if (dist < minDist) {
        closest = nb;
        minDist = dist;
      }
    }
    return closest.model;
  }, [result.net_benefit, threshold]);

  // Operating point from ROC data
  const operatingPoint = useMemo(
    () =>
      computeOperatingPoint(
        result.roc_curve ?? [],
        threshold,
        num(result.summary.outcome_rate),
      ),
    [result.roc_curve, threshold, result.summary.outcome_rate],
  );

  return (
    <div className="space-y-4" data-testid="prediction-verdict-dashboard">
      {/* Overall Verdict Banner */}
      <div className="flex items-center gap-3 rounded-lg border border-[#232328] bg-[#151518] p-4">
        <div className="shrink-0">
          <VerdictIcon
            size={28}
            className={
              config.color === "green"
                ? "text-emerald-400"
                : config.color === "amber"
                  ? "text-amber-400"
                  : "text-red-400"
            }
          />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-[#F0EDE8]">
              Model Performance Verdict
            </h3>
            <TrafficLightBadge color={config.color} label={config.label} />
          </div>
          <p className="mt-1 text-xs text-[#8A857D]">{config.description}</p>
        </div>
      </div>

      {/* Scorecard Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ChartMetricCard
          label="Discrimination (AUC)"
          value={fmt(auc)}
          subValue={`${fmt(result.performance.auc_ci_lower)} - ${fmt(result.performance.auc_ci_upper)}`}
          badge={
            <TrafficLightBadge color={aucColor(auc)} label={aucLabel(auc)} />
          }
        />

        <ChartMetricCard
          label="Calibration Slope"
          value={fmt(slope)}
          subValue={`Intercept: ${fmt(result.performance.calibration_intercept)}`}
          badge={
            <TrafficLightBadge
              color={slopeColor(slope)}
              label={slopeLabel(slope)}
            />
          }
        />

        <ChartMetricCard
          label="Clinical Utility"
          value={
            netBenefitAtThreshold !== null
              ? fmt(netBenefitAtThreshold, 4)
              : "N/A"
          }
          subValue={
            netBenefitAtThreshold !== null
              ? `Net benefit at threshold ${fmt(threshold, 2)}`
              : "No decision curve data available"
          }
          badge={
            <InterpretationTooltip text="Net benefit measures the clinical value of using the model at a given threshold, accounting for the relative harms of false positives and false negatives." />
          }
        />
      </div>

      {/* Clinical Utility Threshold Selector */}
      {result.roc_curve && result.roc_curve.length > 0 && (
        <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
          <div className="flex items-center gap-2 mb-4">
            <h4 className="text-sm font-semibold text-[#F0EDE8]">
              Clinical Utility Threshold Selector
            </h4>
            <InterpretationTooltip text="Adjust the threshold probability to see how sensitivity, specificity, PPV, and NPV change. Lower thresholds catch more true positives but increase false positives." />
          </div>

          {/* Slider */}
          <div className="flex items-center gap-4 mb-4">
            <label className="text-xs text-[#8A857D] whitespace-nowrap" htmlFor="threshold-slider">
              Threshold: {fmt(threshold, 2)}
            </label>
            <input
              id="threshold-slider"
              type="range"
              min="0.01"
              max="0.50"
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="flex-1 h-1.5 appearance-none rounded-full bg-[#232328] accent-[#2DD4BF] cursor-pointer"
              data-testid="threshold-slider"
            />
          </div>

          {/* Operating characteristics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded border border-[#232328] bg-[#0E0E11] p-3">
              <p className="text-[10px] font-medium text-[#8A857D] uppercase tracking-wider">
                Sensitivity
              </p>
              <p
                className="mt-1 font-['IBM_Plex_Mono',monospace] text-base font-bold text-[#2DD4BF]"
                data-testid="operating-sensitivity"
              >
                {fmt(operatingPoint.sensitivity)}
              </p>
            </div>
            <div className="rounded border border-[#232328] bg-[#0E0E11] p-3">
              <p className="text-[10px] font-medium text-[#8A857D] uppercase tracking-wider">
                Specificity
              </p>
              <p
                className="mt-1 font-['IBM_Plex_Mono',monospace] text-base font-bold text-[#C9A227]"
                data-testid="operating-specificity"
              >
                {fmt(operatingPoint.specificity)}
              </p>
            </div>
            <div className="rounded border border-[#232328] bg-[#0E0E11] p-3">
              <p className="text-[10px] font-medium text-[#8A857D] uppercase tracking-wider">
                PPV
              </p>
              <p
                className="mt-1 font-['IBM_Plex_Mono',monospace] text-base font-bold text-[#F0EDE8]"
                data-testid="operating-ppv"
              >
                {fmt(operatingPoint.ppv)}
              </p>
            </div>
            <div className="rounded border border-[#232328] bg-[#0E0E11] p-3">
              <p className="text-[10px] font-medium text-[#8A857D] uppercase tracking-wider">
                NPV
              </p>
              <p
                className="mt-1 font-['IBM_Plex_Mono',monospace] text-base font-bold text-[#F0EDE8]"
                data-testid="operating-npv"
              >
                {fmt(operatingPoint.npv)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
