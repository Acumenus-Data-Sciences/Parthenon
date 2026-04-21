import { useTranslation } from "react-i18next";
import { PreferenceScoreDistribution } from "./PreferenceScoreDistribution";
import { LovePlot } from "./LovePlot";
import type { PropensityMatchResult } from "../types/patientSimilarity";

interface PropensityMatchResultsProps {
  result: PropensityMatchResult;
}

function aucColor(auc: number): string {
  if (auc >= 0.7) return "var(--color-primary)"; // teal
  if (auc >= 0.5) return "var(--color-primary)"; // gold
  return "var(--color-critical)"; // red
}

function meanAbsSmd(rows: { smd: number }[]): number {
  if (rows.length === 0) return 0;
  const sum = rows.reduce((acc, r) => acc + Math.abs(r.smd), 0);
  return sum / rows.length;
}

export function PropensityMatchResults({ result }: PropensityMatchResultsProps) {
  const { t } = useTranslation("app");
  const { model_metrics, matched_pairs, balance, preference_distribution, unmatched } = result;

  const beforeMeanSmd = meanAbsSmd(balance.before);
  const afterMeanSmd = meanAbsSmd(balance.after);
  const totalTarget = model_metrics.n_target;
  const totalComparator = model_metrics.n_comparator;
  const matchedCount = matched_pairs.length;
  const unmatchedTargetCount = unmatched.target_ids.length;
  const unmatchedComparatorCount = unmatched.comparator_ids.length;

  return (
    <div className="space-y-4">
      {/* Model Metrics Card */}
      <div className="rounded-lg border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] p-4">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)] mb-3">
          {t("patientSimilarity.charts.propensityScoreMatchingResults")}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <MetricCell
            label="AUC"
            value={model_metrics.auc.toFixed(3)}
            color={aucColor(model_metrics.auc)}
          />
          <MetricCell
            label="Covariates"
            value={String(model_metrics.n_covariates)}
          />
          <MetricCell
            label="Target N"
            value={String(totalTarget)}
          />
          <MetricCell
            label="Comparator N"
            value={String(totalComparator)}
          />
          <MetricCell
            label="Matched Pairs"
            value={`${matchedCount} / ${totalTarget}`}
            sublabel={`${unmatchedTargetCount} unmatched T, ${unmatchedComparatorCount} unmatched C`}
          />
          <MetricCell
            label="Caliper"
            value={model_metrics.caliper.toFixed(4)}
          />
        </div>

        {/* SMD Summary */}
        <div className="mt-3 flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-text-muted)]">
              {t("patientSimilarity.charts.meanSmdBefore")}
            </span>
            <span className={beforeMeanSmd > 0.1 ? "text-[var(--color-critical)] font-medium" : "text-[var(--color-text-primary)]"}>
              {beforeMeanSmd.toFixed(4)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[var(--color-text-muted)]">
              {t("patientSimilarity.charts.meanSmdAfter")}
            </span>
            <span className={afterMeanSmd > 0.1 ? "text-[var(--color-primary)] font-medium" : "text-[var(--color-primary)] font-medium"}>
              {afterMeanSmd.toFixed(4)}
            </span>
          </div>
          {beforeMeanSmd > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[var(--color-text-muted)]">
                {t("patientSimilarity.charts.reduction")}
              </span>
              <span className="text-[var(--color-primary)]">
                {((1 - afterMeanSmd / beforeMeanSmd) * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PreferenceScoreDistribution distribution={preference_distribution} />
        <LovePlot
          covariates={balance.after}
          beforeCovariates={balance.before}
          maxDisplay={30}
        />
      </div>
    </div>
  );
}

// ── Metric Cell ────────────────────────────────────────────────

function MetricCell({
  label,
  value,
  sublabel,
  color,
}: {
  label: string;
  value: string;
  sublabel?: string;
  color?: string;
}) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)] mb-1">
        {label}
      </div>
      <div
        className="text-lg font-semibold"
        style={{ color: color ?? "var(--color-text-primary)" }}
      >
        {value}
      </div>
      {sublabel && (
        <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5">{sublabel}</div>
      )}
    </div>
  );
}
