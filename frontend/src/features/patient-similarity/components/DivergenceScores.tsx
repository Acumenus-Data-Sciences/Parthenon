import { cn } from "@/lib/utils";
import type { CohortDivergence } from "../types/patientSimilarity";

interface DivergenceScoresProps {
  divergence: Record<string, CohortDivergence>;
  overallDivergence: number;
}

function getColor(score: number): string {
  if (score < 0.3) return "var(--success)";
  if (score < 0.6) return "var(--accent)";
  return "var(--critical)";
}

function getBgColor(score: number): string {
  if (score < 0.3) return "bg-success/10";
  if (score < 0.6) return "bg-accent/10";
  return "bg-critical/10";
}

const DIMENSION_LABELS: Record<string, string> = {
  demographics: "Demographics",
  conditions: "Conditions",
  measurements: "Measurements",
  drugs: "Drugs",
  procedures: "Procedures",
  genomics: "Genomics",
};

export function DivergenceScores({
  divergence,
  overallDivergence,
}: DivergenceScoresProps) {
  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-text-primary">
          Divergence Scores
        </h3>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-text-ghost uppercase tracking-wider">
            Overall:
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
            <span className="text-xs text-text-muted w-24 shrink-0">
              {DIMENSION_LABELS[key] ?? key}
            </span>
            <div className="flex-1 h-2 rounded-full bg-surface-elevated overflow-hidden">
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
