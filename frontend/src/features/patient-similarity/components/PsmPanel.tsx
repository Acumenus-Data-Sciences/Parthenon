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
        <div className="rounded-lg border border-[#232328] bg-[#151518] px-4 py-3">
          <div className="text-xs text-[#5A5650]">AUC</div>
          <div className="mt-1 text-xl font-semibold text-[#2DD4BF]">
            {model_metrics.auc.toFixed(3)}
          </div>
        </div>

        <div className="rounded-lg border border-[#232328] bg-[#151518] px-4 py-3">
          <div className="text-xs text-[#5A5650]">Matched Pairs</div>
          <div className="mt-1 text-xl font-semibold text-[#C9A227]">
            {matched_pairs.length.toLocaleString()}
          </div>
        </div>

        <div className="rounded-lg border border-[#232328] bg-[#151518] px-4 py-3">
          <div className="text-xs text-[#5A5650]">SMD Reduction</div>
          <div className="mt-1 text-xl font-semibold text-[#2DD4BF]">
            {smdReduction !== null ? `${smdReduction}%` : '—'}
          </div>
        </div>

        <div className="rounded-lg border border-[#232328] bg-[#151518] px-4 py-3">
          <div className="text-xs text-[#5A5650]">Caliper</div>
          <div className="mt-1 text-xl font-semibold text-[#8A857D]">
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
      <div className="flex items-center justify-between border-t border-[#232328] pt-4">
        <button
          type="button"
          onClick={onExportMatched}
          className="rounded-md border border-[#323238] bg-[#151518] px-4 py-2 text-sm text-[#C5C0B8] transition-colors hover:border-[#5A5650] hover:text-[#F0EDE8]"
        >
          Export Matched Cohort
        </button>
        <button
          type="button"
          onClick={onContinue}
          className="rounded-md bg-[#2DD4BF] px-4 py-2 text-sm font-medium text-[#0E0E11] transition-colors hover:bg-[#22B8A0]"
        >
          Continue to Landscape →
        </button>
      </div>
    </div>
  );
}
