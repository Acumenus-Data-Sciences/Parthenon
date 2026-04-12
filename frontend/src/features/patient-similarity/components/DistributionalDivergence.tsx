import { cn } from "@/lib/utils";
import type { DistributionalDivergenceRow } from "../types/patientSimilarity";

interface DistributionalDivergenceProps {
  rows: DistributionalDivergenceRow[];
}

const DIMENSION_LABELS: Record<string, string> = {
  demographics: "Demographics",
  conditions: "Conditions",
  measurements: "Measurements",
  drugs: "Drugs",
  procedures: "Procedures",
  genomics: "Genomics",
};

function getInterpretationColor(interpretation: string): string {
  switch (interpretation) {
    case "Very similar":
      return "var(--color-primary)";
    case "Similar":
      return "var(--color-primary)80";
    case "Moderate":
      return "var(--color-primary)";
    case "Divergent":
      return "var(--color-critical)";
    default:
      return "var(--color-text-secondary)";
  }
}

function getInterpretationBg(interpretation: string): string {
  switch (interpretation) {
    case "Very similar":
      return "bg-[var(--color-primary)]/10";
    case "Similar":
      return "bg-[var(--color-primary)]/5";
    case "Moderate":
      return "bg-[var(--color-primary)]/10";
    case "Divergent":
      return "bg-[var(--color-critical)]/10";
    default:
      return "bg-[var(--color-text-secondary)]/10";
  }
}

function getMetricBadgeStyle(metric: string): string {
  return metric === "wasserstein"
    ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)]"
    : "bg-[var(--color-primary)]/15 text-[var(--color-primary)]";
}

export function DistributionalDivergence({
  rows,
}: DistributionalDivergenceProps) {
  return (
    <div className="rounded-lg border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] p-4">
      <h3 className="mb-3 text-sm font-semibold text-[var(--color-text-primary)]">
        Distributional Divergence
      </h3>
      <p className="mb-3 text-xs text-[var(--color-text-secondary)]">
        Jensen-Shannon Divergence (JSD) for categorical and Wasserstein distance
        for continuous dimensions.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[var(--color-surface-overlay)]">
              <th className="pb-2 pr-4 text-[var(--color-text-muted)] font-medium">
                Dimension
              </th>
              <th className="pb-2 pr-4 text-[var(--color-text-muted)] font-medium">Metric</th>
              <th className="pb-2 pr-4 text-[var(--color-text-muted)] font-medium text-right">
                Value
              </th>
              <th className="pb-2 text-[var(--color-text-muted)] font-medium">
                Interpretation
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.dimension}
                className="border-b border-[var(--color-surface-overlay)]/50 last:border-0"
              >
                <td className="py-2 pr-4 text-[var(--color-text-primary)]">
                  {DIMENSION_LABELS[row.dimension] ?? row.dimension}
                </td>
                <td className="py-2 pr-4">
                  <span
                    className={cn(
                      "inline-block rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                      getMetricBadgeStyle(row.metric),
                    )}
                  >
                    {row.metric === "wasserstein" ? "W1" : "JSD"}
                  </span>
                </td>
                <td className="py-2 pr-4 text-right tabular-nums text-[var(--color-text-primary)]">
                  {row.value.toFixed(4)}
                </td>
                <td className="py-2">
                  <span
                    className={cn(
                      "inline-block rounded px-1.5 py-0.5 text-[10px]",
                      getInterpretationBg(row.interpretation),
                    )}
                    style={{ color: getInterpretationColor(row.interpretation) }}
                  >
                    {row.interpretation}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
