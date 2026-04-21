import { LovePlot } from "./LovePlot";
import { DistributionalDivergence } from "./DistributionalDivergence";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation("app");
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
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border-default bg-sidebar-bg-light p-4">
        <MetricBadge label={t("patientSimilarity.covariateBalance.totalCovariates")} value={total} color="var(--text-primary)" />
        <MetricBadge label={t("patientSimilarity.covariateBalance.balanced")} value={balanced} color="var(--success)" />
        <MetricBadge label={t("patientSimilarity.covariateBalance.imbalanced")} value={imbalanced} color="var(--primary)" />
        <MetricBadge
          label={t("patientSimilarity.covariateBalance.meanAbsSmd")}
          value={meanAbsSmd !== null ? meanAbsSmd.toFixed(3) : "—"}
          color="var(--accent)"
        />
        {psmRecommended && (
          <span className="ml-auto flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            ⚠ {t("patientSimilarity.covariateBalance.psmRecommended")}
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
              {t("patientSimilarity.covariateBalance.noCovariateData")}
            </p>
          </div>
        )}

        {/* Right: Distributional Divergence */}
        {distributionalRows.length > 0 ? (
          <DistributionalDivergence rows={distributionalRows} />
        ) : (
          <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-border-default bg-surface-raised">
            <p className="text-sm text-text-muted">
              {t("patientSimilarity.covariateBalance.noDistributionalData")}
            </p>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <p className="text-xs text-text-muted">
          {psmRecommended
            ? t("patientSimilarity.covariateBalance.thresholdWarning", {
                count: imbalanced,
              })
            : total > 0
              ? t("patientSimilarity.covariateBalance.balancedReady")
              : t("patientSimilarity.covariateBalance.runComparison")}
        </p>
        <div className="flex shrink-0 gap-2">
          {psmRecommended && (
            <button
              type="button"
              onClick={onRunPsm}
              className="rounded-md bg-primary/10 px-4 py-2 text-sm font-medium text-critical transition-colors hover:bg-primary/20"
            >
              {t("patientSimilarity.covariateBalance.runPsm")}
            </button>
          )}
          <button
            type="button"
            onClick={onContinue}
            className="rounded-md bg-success/10 px-4 py-2 text-sm font-medium text-success transition-colors hover:bg-success/20"
          >
            {t("patientSimilarity.covariateBalance.continueToLandscape")}
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
