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
      return "#2DD4BF";
    case "Similar":
      return "#2DD4BF80";
    case "Moderate":
      return "#C9A227";
    case "Divergent":
      return "#9B1B30";
    default:
      return "#8A857D";
  }
}

function getInterpretationBg(interpretation: string): string {
  switch (interpretation) {
    case "Very similar":
      return "bg-[#2DD4BF]/10";
    case "Similar":
      return "bg-[#2DD4BF]/5";
    case "Moderate":
      return "bg-[#C9A227]/10";
    case "Divergent":
      return "bg-[#9B1B30]/10";
    default:
      return "bg-[#8A857D]/10";
  }
}

function getMetricBadgeStyle(metric: string): string {
  return metric === "wasserstein"
    ? "bg-[#C9A227]/15 text-[#C9A227]"
    : "bg-[#2DD4BF]/15 text-[#2DD4BF]";
}

export function DistributionalDivergence({
  rows,
}: DistributionalDivergenceProps) {
  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
      <h3 className="mb-3 text-sm font-semibold text-[#F0EDE8]">
        Distributional Divergence
      </h3>
      <p className="mb-3 text-xs text-[#8A857D]">
        Jensen-Shannon Divergence (JSD) for categorical and Wasserstein distance
        for continuous dimensions.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-[#232328]">
              <th className="pb-2 pr-4 text-[#5A5650] font-medium">
                Dimension
              </th>
              <th className="pb-2 pr-4 text-[#5A5650] font-medium">Metric</th>
              <th className="pb-2 pr-4 text-[#5A5650] font-medium text-right">
                Value
              </th>
              <th className="pb-2 text-[#5A5650] font-medium">
                Interpretation
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.dimension}
                className="border-b border-[#232328]/50 last:border-0"
              >
                <td className="py-2 pr-4 text-[#F0EDE8]">
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
                <td className="py-2 pr-4 text-right tabular-nums text-[#F0EDE8]">
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
