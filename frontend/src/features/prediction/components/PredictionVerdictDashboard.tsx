import { useState, useMemo } from "react";
import { ShieldCheck, ShieldAlert, ShieldX } from "lucide-react";
import { TrafficLightBadge, ChartMetricCard, InterpretationTooltip } from "@/components/charts";
import type { TrafficLightColor } from "@/components/charts";
import { fmt, num } from "@/lib/formatters";
import { useTranslation } from "react-i18next";
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

function aucLabelKey(auc: number): string {
  if (auc >= 0.8) return "analyses.auto.good_1347e3";
  if (auc >= 0.7) return "analyses.auto.acceptable_26cee7";
  return "analyses.auto.poor_0d3dfb";
}

function slopeColor(slope: number): TrafficLightColor {
  if (slope >= 0.8 && slope <= 1.2) return "green";
  if ((slope >= 0.6 && slope < 0.8) || (slope > 1.2 && slope <= 1.4)) return "amber";
  return "red";
}

function slopeLabelKey(slope: number): string {
  if (slope >= 0.8 && slope <= 1.2) {
    return "analyses.auto.wellCalibrated_ee0d1c";
  }
  if ((slope >= 0.6 && slope < 0.8) || (slope > 1.2 && slope <= 1.4)) {
    return "analyses.auto.marginal_8d2068";
  }
  return "analyses.auto.poorlyCalibrated_68c323";
}

type Verdict = "ready" | "recalibrate" | "insufficient";

function computeVerdict(auc: number, slope: number): Verdict {
  if (auc >= 0.8 && slope >= 0.8 && slope <= 1.2) return "ready";
  if (auc >= 0.7) return "recalibrate";
  return "insufficient";
}

const verdictConfig: Record<
  Verdict,
  {
    labelKey: string;
    icon: typeof ShieldCheck;
    color: TrafficLightColor;
    descriptionKey: string;
  }
> = {
  ready: {
    labelKey: "analyses.auto.readyForValidation_8b18ee",
    icon: ShieldCheck,
    color: "green",
    descriptionKey: "analyses.auto.readyForValidationDescription_b6c1f3",
  },
  recalibrate: {
    labelKey: "analyses.auto.needsRecalibration_c5baf6",
    icon: ShieldAlert,
    color: "amber",
    descriptionKey: "analyses.auto.needsRecalibrationDescription_8d668d",
  },
  insufficient: {
    labelKey: "analyses.auto.insufficientDiscrimination_36f62c",
    icon: ShieldX,
    color: "red",
    descriptionKey: "analyses.auto.insufficientDiscriminationDescription_6dca77",
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
  const { t } = useTranslation("app");
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
      <div className="flex items-center gap-3 rounded-lg border border-border-default bg-surface-raised p-4">
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
            <h3 className="text-sm font-semibold text-text-primary">
              {t("analyses.auto.modelPerformanceVerdict_8b4084")}
            </h3>
            <TrafficLightBadge
              color={config.color}
              label={t(config.labelKey)}
            />
          </div>
          <p className="mt-1 text-xs text-text-muted">
            {t(config.descriptionKey)}
          </p>
        </div>
      </div>

      {/* Scorecard Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <ChartMetricCard
          label={t("analyses.auto.discriminationAuc_4ffc21")}
          value={fmt(auc)}
          subValue={`${fmt(result.performance.auc_ci_lower)} - ${fmt(result.performance.auc_ci_upper)}`}
          badge={
            <TrafficLightBadge
              color={aucColor(auc)}
              label={t(aucLabelKey(auc))}
            />
          }
        />

        <ChartMetricCard
          label={t("analyses.auto.calibrationSlope_5d893f")}
          value={fmt(slope)}
          subValue={t("analyses.auto.interceptValue_12e39b", {
            value: fmt(result.performance.calibration_intercept),
          })}
          badge={
            <TrafficLightBadge
              color={slopeColor(slope)}
              label={t(slopeLabelKey(slope))}
            />
          }
        />

        <ChartMetricCard
          label={t("analyses.auto.clinicalUtility_b97f3a")}
          value={
            netBenefitAtThreshold !== null
              ? fmt(netBenefitAtThreshold, 4)
              : t("analyses.auto.nA_382b0f")
          }
          subValue={
            netBenefitAtThreshold !== null
              ? t("analyses.auto.netBenefitAtThreshold_c18602", {
                  value: fmt(threshold, 2),
                })
              : t("analyses.auto.noDecisionCurveDataAvailable_854dc0")
          }
          badge={
            <InterpretationTooltip metric="Net Benefit" plain="Measures the clinical value of using the model at a given threshold." technical="Net benefit accounts for the relative harms of false positives and false negatives at the chosen decision threshold." />
          }
        />
      </div>

      {/* Clinical Utility Threshold Selector */}
      {result.roc_curve && result.roc_curve.length > 0 && (
        <div className="rounded-lg border border-border-default bg-surface-raised p-4">
          <div className="flex items-center gap-2 mb-4">
            <h4 className="text-sm font-semibold text-text-primary">
              {t("analyses.auto.clinicalUtilityThresholdSelector_e1a37d")}
            </h4>
            <InterpretationTooltip metric="Threshold" plain="Adjust the threshold probability to see how sensitivity, specificity, PPV, and NPV change." technical="Lower thresholds catch more true positives but increase false positives." />
          </div>

          {/* Slider */}
          <div className="flex items-center gap-4 mb-4">
            <label className="text-xs text-text-muted whitespace-nowrap" htmlFor="threshold-slider">
              {t("analyses.auto.thresholdValue_7518f7", {
                value: fmt(threshold, 2),
              })}
            </label>
            <input
              id="threshold-slider"
              type="range"
              min="0.01"
              max="0.50"
              step="0.01"
              value={threshold}
              onChange={(e) => setThreshold(parseFloat(e.target.value))}
              className="flex-1 h-1.5 appearance-none rounded-full bg-surface-elevated accent-success cursor-pointer"
              data-testid="threshold-slider"
            />
          </div>

          {/* Operating characteristics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded border border-border-default bg-surface-base p-3">
              <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                {t("analyses.auto.sensitivity_1485b9")}
              </p>
              <p
                className="mt-1 font-['IBM_Plex_Mono',monospace] text-base font-bold text-success"
                data-testid="operating-sensitivity"
              >
                {fmt(operatingPoint.sensitivity)}
              </p>
            </div>
            <div className="rounded border border-border-default bg-surface-base p-3">
              <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                {t("analyses.auto.specificity_7272f0")}
              </p>
              <p
                className="mt-1 font-['IBM_Plex_Mono',monospace] text-base font-bold text-accent"
                data-testid="operating-specificity"
              >
                {fmt(operatingPoint.specificity)}
              </p>
            </div>
            <div className="rounded border border-border-default bg-surface-base p-3">
              <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                PPV
              </p>
              <p
                className="mt-1 font-['IBM_Plex_Mono',monospace] text-base font-bold text-text-primary"
                data-testid="operating-ppv"
              >
                {fmt(operatingPoint.ppv)}
              </p>
            </div>
            <div className="rounded border border-border-default bg-surface-base p-3">
              <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
                NPV
              </p>
              <p
                className="mt-1 font-['IBM_Plex_Mono',monospace] text-base font-bold text-text-primary"
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
