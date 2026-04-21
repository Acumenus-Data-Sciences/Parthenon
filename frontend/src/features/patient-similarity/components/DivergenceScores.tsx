import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { getSimilarityDimensionLabel } from "../lib/i18n";
import type { CohortDivergence } from "../types/patientSimilarity";

interface DivergenceScoresProps {
  divergence: Record<string, CohortDivergence>;
  overallDivergence: number;
}

function getColor(score: number): string {
  if (score < 0.3) return "var(--color-primary)";
  if (score < 0.6) return "var(--color-primary)";
  return "var(--color-critical)";
}

function getBgColor(score: number): string {
  if (score < 0.3) return "bg-[var(--color-primary)]/10";
  if (score < 0.6) return "bg-[var(--color-primary)]/10";
  return "bg-[var(--color-critical)]/10";
}

export function DivergenceScores({
  divergence,
  overallDivergence,
}: DivergenceScoresProps) {
  const { t } = useTranslation("app");
  return (
    <div className="rounded-lg border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t("patientSimilarity.charts.divergenceScores")}
        </h3>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
            {t("patientSimilarity.charts.overall")}
          </span>
          <span
            className="text-sm font-semibold tabular-nums"
            style={{ color: getColor(overallDivergence) }}
          >
            {overallDivergence.toFixed(2)}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {Object.entries(divergence).map(([key, div]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-[var(--color-text-secondary)] w-24 shrink-0">
              {getSimilarityDimensionLabel(
                t,
                key as Parameters<typeof getSimilarityDimensionLabel>[1],
              )}
            </span>
            <div className="flex-1 h-2 rounded-full bg-[var(--color-surface-overlay)] overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all")}
                style={{
                  width: `${Math.min(div.score * 100, 100)}%`,
                  backgroundColor: getColor(div.score),
                }}
              />
            </div>
            <span
              className="text-[10px] font-medium tabular-nums w-8 text-right"
              style={{ color: getColor(div.score) }}
            >
              {div.score.toFixed(2)}
            </span>
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded",
                getBgColor(div.score),
              )}
              style={{ color: getColor(div.score) }}
            >
              {div.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
