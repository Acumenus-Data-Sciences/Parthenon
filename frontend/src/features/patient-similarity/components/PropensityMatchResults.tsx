import { PreferenceScoreDistribution } from "./PreferenceScoreDistribution";
import { LovePlot } from "./LovePlot";
import type { PropensityMatchResult } from "../types/patientSimilarity";

interface PropensityMatchResultsProps {
  result: PropensityMatchResult;
}

function aucColor(auc: number): string {
  if (auc >= 0.7) return "#2DD4BF"; // teal
  if (auc >= 0.5) return "#C9A227"; // gold
  return "#E85A6B"; // red
}

function meanAbsSmd(rows: { smd: number }[]): number {
  if (rows.length === 0) return 0;
  const sum = rows.reduce((acc, r) => acc + Math.abs(r.smd), 0);
  return sum / rows.length;
}

export function PropensityMatchResults({ result }: PropensityMatchResultsProps) {
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
      <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
        <h3 className="text-sm font-semibold text-[#F0EDE8] mb-3">
          Propensity Score Matching Results
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
            <span className="text-[#5A5650]">Mean |SMD| Before:</span>
            <span className={beforeMeanSmd > 0.1 ? "text-[#E85A6B] font-medium" : "text-[#C5C0B8]"}>
              {beforeMeanSmd.toFixed(4)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[#5A5650]">Mean |SMD| After:</span>
            <span className={afterMeanSmd > 0.1 ? "text-[#C9A227] font-medium" : "text-[#2DD4BF] font-medium"}>
              {afterMeanSmd.toFixed(4)}
            </span>
          </div>
          {beforeMeanSmd > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-[#5A5650]">Reduction:</span>
              <span className="text-[#2DD4BF]">
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
      <div className="text-[10px] uppercase tracking-wider text-[#5A5650] mb-1">
        {label}
      </div>
      <div
        className="text-lg font-semibold"
        style={{ color: color ?? "#F0EDE8" }}
      >
        {value}
      </div>
      {sublabel && (
        <div className="text-[10px] text-[#5A5650] mt-0.5">{sublabel}</div>
      )}
    </div>
  );
}
