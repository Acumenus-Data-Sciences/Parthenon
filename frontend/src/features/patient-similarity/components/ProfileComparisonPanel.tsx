import { CohortComparisonRadar } from "./CohortComparisonRadar";
import { useTranslation } from "react-i18next";
import type { CohortComparisonResult } from "../types/patientSimilarity";

interface ProfileComparisonPanelProps {
  result: CohortComparisonResult;
  sourceName: string;
  targetName: string;
  onContinue: () => void;
}

function getDivergenceLabel(
  t: ReturnType<typeof useTranslation<"app">>["t"],
  pct: number,
): string {
  if (pct < 30) return t("patientSimilarity.profileComparison.lowDivergence");
  if (pct < 50) return t("patientSimilarity.profileComparison.moderateDivergence");
  return t("patientSimilarity.profileComparison.highDivergence");
}

function getDivergenceColor(pct: number): string {
  if (pct < 30) return "var(--color-primary)";
  if (pct < 50) return "var(--color-primary)";
  return "var(--color-critical)";
}

function getDimensionColor(score: number): string {
  if (score > 0.5) return "var(--color-critical)";
  if (score >= 0.3) return "var(--color-primary)";
  return "var(--color-primary)";
}

export function ProfileComparisonPanel({
  result,
  sourceName,
  targetName,
  onContinue,
}: ProfileComparisonPanelProps) {
  const { t } = useTranslation("app");
  const overallPct = Math.round(result.overall_divergence * 100);
  const divergenceColor = getDivergenceColor(overallPct);
  const interpretationText = getDivergenceLabel(t, overallPct);

  // Sort dimensions by score descending, skip any with missing labels
  const sortedDimensions = Object.entries(result.divergence)
    .filter(([, d]) => d.score !== null && d.score !== undefined)
    .sort(([, a], [, b]) => b.score - a.score);

  return (
    <div className="space-y-4">
      {/* Overall divergence banner */}
      <div className="rounded-lg border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--color-text-muted)]">
            {t("patientSimilarity.profileComparison.overallDivergence")}
          </span>
          <span
            className="text-3xl font-bold tabular-nums"
            style={{ color: divergenceColor }}
          >
            {overallPct}%
          </span>
        </div>
        {/* Gradient bar */}
        <div className="h-2 overflow-hidden rounded-full bg-[var(--color-surface-overlay)]">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${overallPct}%`,
              background:
                "linear-gradient(90deg, var(--color-primary) 0%, var(--color-primary) 50%, var(--color-critical) 100%)",
            }}
          />
        </div>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{interpretationText}</p>
      </div>

      {/* Two-column chart grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Left: Radar */}
        <CohortComparisonRadar
          divergence={result.divergence}
          sourceName={sourceName}
          targetName={targetName}
        />

        {/* Right: Per-dimension bars */}
        <div className="rounded-lg border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] p-4">
          <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
            {t("patientSimilarity.profileComparison.perDimensionDivergence")}
          </h3>
          {sortedDimensions.length > 0 ? (
            <div className="space-y-3">
              {sortedDimensions.map(([key, dim]) => {
                const pct = Math.round(dim.score * 100);
                const color = getDimensionColor(dim.score);
                return (
                  <div key={key}>
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-xs capitalize text-[var(--color-text-primary)]">
                        {dim.label || key}
                      </span>
                      <span
                        className="text-xs font-semibold tabular-nums"
                        style={{ color }}
                      >
                        {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-overlay)]">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{ width: `${pct}%`, backgroundColor: color }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-[var(--color-text-secondary)]">
              {t("patientSimilarity.profileComparison.noScores")}
            </p>
          )}
        </div>
      </div>

      {/* Action bar */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={onContinue}
          className="rounded-md bg-[var(--color-primary)]/10 px-4 py-2 text-sm font-medium text-[var(--color-primary)] transition-colors hover:bg-[var(--color-primary)]/20"
        >
          {t("patientSimilarity.profileComparison.viewCovariateBalance")}
        </button>
      </div>
    </div>
  );
}
