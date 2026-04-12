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
      return "var(--success)";
    case "Similar":
      return "#2DD4BF80";
    case "Moderate":
      return "var(--accent)";
    case "Divergent":
      return "var(--primary)";
    default:
      return "var(--text-muted)";
  }
}

function getInterpretationBg(interpretation: string): string {
  switch (interpretation) {
    case "Very similar":
      return "bg-success/10";
    case "Similar":
      return "bg-success/5";
    case "Moderate":
      return "bg-accent/10";
    case "Divergent":
      return "bg-primary/10";
    default:
      return "bg-text-muted/10";
  }
}

function getMetricBadgeStyle(metric: string): string {
  return metric === "wasserstein"
    ? "bg-accent/15 text-accent"
    : "bg-success/15 text-success";
}

export function DistributionalDivergence({
  rows,
}: DistributionalDivergenceProps) {
  return (
    <div className="rounded-lg border border-border-default bg-surface-raised p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">
        Distributional Divergence
      </h3>
      <p className="mb-3 text-xs text-text-muted">
        Jensen-Shannon Divergence (JSD) for categorical and Wasserstein distance
        for continuous dimensions.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border-default">
              <th className="pb-2 pr-4 text-text-ghost font-medium">
                Dimension
              </th>
              <th className="pb-2 pr-4 text-text-ghost font-medium">Metric</th>
              <th className="pb-2 pr-4 text-text-ghost font-medium text-right">
                Value
              </th>
              <th className="pb-2 text-text-ghost font-medium">
                Interpretation
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.dimension}
                className="border-b border-border-default/50 last:border-0"
              >
                <td className="py-2 pr-4 text-text-primary">
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
                <td className="py-2 pr-4 text-right tabular-nums text-text-primary">
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
