import type { PropensityMatchResult } from "../types/patientSimilarity";
import { PreferenceScoreDistribution } from "./PreferenceScoreDistribution";
import { LovePlot } from "./LovePlot";

interface PsmPanelProps {
  result: PropensityMatchResult;
  onExportMatched: () => void;
  onContinue: () => void;
}

export function PsmPanel({ result, onExportMatched, onContinue }: PsmPanelProps) {
  const { model_metrics, matched_pairs, balance, preference_distribution } = result;

  const smdReduction = (() => {
    if (balance.before.length === 0) return null;
    const meanBefore =
      balance.before.reduce((sum, c) => sum + Math.abs(c.smd), 0) / balance.before.length;
    const meanAfter =
      balance.after.reduce((sum, c) => sum + Math.abs(c.smd), 0) /
      (balance.after.length || 1);
    if (meanBefore === 0) return null;
    return Math.round(((meanBefore - meanAfter) / meanBefore) * 100);
  })();

  return (
    <div className="space-y-4 p-4">
      {/* Metrics row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="rounded-lg border border-border-default bg-surface-raised px-4 py-3">
          <div className="text-xs text-text-ghost">AUC</div>
          <div className="mt-1 text-xl font-semibold text-success">
            {model_metrics.auc.toFixed(3)}
          </div>
        </div>

        <div className="rounded-lg border border-border-default bg-surface-raised px-4 py-3">
          <div className="text-xs text-text-ghost">Matched Pairs</div>
          <div className="mt-1 text-xl font-semibold text-accent">
            {matched_pairs.length.toLocaleString()}
          </div>
        </div>

        <div className="rounded-lg border border-border-default bg-surface-raised px-4 py-3">
          <div className="text-xs text-text-ghost">SMD Reduction</div>
          <div className="mt-1 text-xl font-semibold text-success">
            {smdReduction !== null ? `${smdReduction}%` : '—'}
          </div>
        </div>

        <div className="rounded-lg border border-border-default bg-surface-raised px-4 py-3">
          <div className="text-xs text-text-ghost">Caliper</div>
          <div className="mt-1 text-xl font-semibold text-text-muted">
            {model_metrics.caliper.toFixed(4)}
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-4">
        <PreferenceScoreDistribution distribution={preference_distribution} />
        <LovePlot
          covariates={balance.after}
          beforeCovariates={balance.before}
        />
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between border-t border-border-default pt-4">
        <button
          type="button"
          onClick={onExportMatched}
          className="rounded-md border border-surface-highlight bg-surface-raised px-4 py-2 text-sm text-text-secondary transition-colors hover:border-text-ghost hover:text-text-primary"
        >
          Export Matched Cohort
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-md bg-success px-4 py-2 text-sm font-medium text-surface-base transition-colors hover:bg-success-dark"
        >
          Continue to Landscape →
        </button>
      </div>
    </div>
  );
}
