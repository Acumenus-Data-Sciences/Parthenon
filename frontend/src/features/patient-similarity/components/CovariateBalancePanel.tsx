import { LovePlot } from "./LovePlot";
import { DistributionalDivergence } from "./DistributionalDivergence";
import type {
  CohortComparisonResult,
  CovariateBalanceRow,
  DistributionalDivergenceRow,
} from "../types/patientSimilarity";

interface CovariateBalancePanelProps {
  result: CohortComparisonResult;
  covariates?: CovariateBalanceRow[];
  distributionalRows?: DistributionalDivergenceRow[];
  onRunPsm: () => void;
  onContinue: () => void;
}

export function CovariateBalancePanel({
  covariates = [],
  distributionalRows = [],
  onRunPsm,
  onContinue,
}: CovariateBalancePanelProps) {
  const total = covariates.length;
  const imbalanced = covariates.filter((c) => Math.abs(c.smd) >= 0.1).length;
  const balanced = total - imbalanced;
  const meanAbsSmd =
    total > 0
      ? covariates.reduce((sum, c) => sum + Math.abs(c.smd), 0) / total
      : null;
  const psmRecommended = imbalanced > 0;

  return (
    <div className="space-y-4">
      {/* Summary metrics row */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[#232328] bg-[#131316] p-4">
        <MetricBadge label="Total Covariates" value={total} color="#F0EDE8" />
        <MetricBadge label="Balanced" value={balanced} color="#2DD4BF" />
        <MetricBadge label="Imbalanced" value={imbalanced} color="#9B1B30" />
        <MetricBadge
          label="Mean |SMD|"
          value={meanAbsSmd !== null ? meanAbsSmd.toFixed(3) : "—"}
          color="#C9A227"
        />
        {psmRecommended && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full border border-[#C9A227]/30 bg-[#C9A227]/10 px-3 py-1 text-xs font-medium text-[#C9A227]">
            ⚠ PSM recommended
          </span>
        )}
      </div>

      {/* Two-column visualization grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left: Love Plot */}
        {covariates.length > 0 ? (
          <LovePlot covariates={covariates} />
        ) : (
          <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-[#232328] bg-[#151518]">
            <p className="text-sm text-[#8A857D]">
              No covariate balance data available.
            </p>
          </div>
        )}

        {/* Right: Distributional Divergence */}
        {distributionalRows.length > 0 ? (
          <DistributionalDivergence rows={distributionalRows} />
        ) : (
          <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-[#232328] bg-[#151518]">
            <p className="text-sm text-[#8A857D]">
              No distributional divergence data available.
            </p>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-[#8A857D]">
          {psmRecommended
            ? `${imbalanced} covariate${imbalanced !== 1 ? "s" : ""} exceed the 0.1 SMD threshold. Propensity score matching is recommended before proceeding.`
            : total > 0
              ? "All covariates are well-balanced. You may proceed to the landscape view."
              : "Run a cohort comparison to assess covariate balance."}
        </p>
        <div className="flex shrink-0 gap-2">
          {psmRecommended && (
            <button
              type="button"
              onClick={onRunPsm}
              className="rounded-md bg-[#9B1B30]/10 px-4 py-2 text-sm font-medium text-[#E85A6B] transition-colors hover:bg-[#9B1B30]/20"
            >
              Run Propensity Score Matching →
            </button>
          )}
          <button
            type="button"
            onClick={onContinue}
            className="rounded-md bg-[#2DD4BF]/10 px-4 py-2 text-sm font-medium text-[#2DD4BF] transition-colors hover:bg-[#2DD4BF]/20"
          >
            Continue to Landscape →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Internal helper ──────────────────────────────────────────────

interface MetricBadgeProps {
  label: string;
  value: number | string;
  color: string;
}

function MetricBadge({ label, value, color }: MetricBadgeProps) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className="text-xl font-bold tabular-nums leading-none"
        style={{ color }}
      >
        {value}
      </span>
      <span className="text-[10px] uppercase tracking-wider text-[#5A5650]">
        {label}
      </span>
    </div>
  );
}
