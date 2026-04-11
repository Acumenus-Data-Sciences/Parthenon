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
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-default bg-[#131316] p-4">
        <MetricBadge label="Total Covariates" value={total} color="var(--text-primary)" />
        <MetricBadge label="Balanced" value={balanced} color="var(--success)" />
        <MetricBadge label="Imbalanced" value={imbalanced} color="var(--primary)" />
        <MetricBadge
          label="Mean |SMD|"
          value={meanAbsSmd !== null ? meanAbsSmd.toFixed(3) : "—"}
          color="var(--accent)"
        />
        {psmRecommended && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
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
          <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-border-default bg-surface-raised">
            <p className="text-sm text-text-muted">
              No covariate balance data available.
            </p>
          </div>
        )}

        {/* Right: Distributional Divergence */}
        {distributionalRows.length > 0 ? (
          <DistributionalDivergence rows={distributionalRows} />
        ) : (
          <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-border-default bg-surface-raised">
            <p className="text-sm text-text-muted">
              No distributional divergence data available.
            </p>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">
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
              className="rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-critical transition-colors hover:bg-primary/20"
            >
              Run Propensity Score Matching →
            </button>
          )}
          <button
            type="button"
            onClick={onContinue}
            className="rounded-md bg-success/10 px-4 py-2 text-sm font-medium text-success transition-colors hover:bg-success/20"
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
      <span className="text-[10px] uppercase tracking-wider text-text-ghost">
        {label}
      </span>
    </div>
  );
}
