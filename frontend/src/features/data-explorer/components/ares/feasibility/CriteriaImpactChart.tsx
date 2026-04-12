import type { CriteriaImpact } from "../../../types/ares";

interface CriteriaImpactChartProps {
  impacts: CriteriaImpact[];
  baselinePassed: number;
  totalSources: number;
}

export default function CriteriaImpactChart({ impacts, baselinePassed, totalSources }: CriteriaImpactChartProps) {
  if (impacts.length === 0) {
    return <p className="py-4 text-center text-xs text-[#555]">No criteria impact data available.</p>;
  }

  const maxImpact = Math.max(...impacts.map((i) => i.impact), 1);

  return (
    <div className="rounded-lg border border-[#252530] bg-[#151518] p-4">
      <h4 className="mb-1 text-sm font-medium text-white">Criteria Impact Analysis</h4>
      <p className="mb-3 text-[11px] text-[#666]">
        Shows how many additional sources would pass if each criterion were removed. Baseline: {baselinePassed}/{totalSources} passing.
      </p>

      <div className="space-y-2">
        {impacts.map((impact) => {
          const barWidth = maxImpact > 0 ? (impact.impact / maxImpact) * 100 : 0;
          const color = impact.impact >= 3 ? "#9B1B30" : impact.impact >= 1 ? "#C9A227" : "#2DD4BF";

          return (
            <div key={impact.criterion} className="flex items-center gap-3">
              <span className="w-36 shrink-0 text-right text-xs text-[#ccc]">{impact.criterion}</span>
              <div className="relative h-5 flex-1 rounded bg-[#1a1a22]">
                <div
                  className="absolute left-0 top-0 h-5 rounded"
                  style={{ width: `${Math.max(barWidth, 2)}%`, backgroundColor: `${color}40` }}
                />
                <span className="absolute left-2 top-0 flex h-5 items-center text-[10px] font-bold" style={{ color }}>
                  +{impact.impact} sources
                </span>
              </div>
              <span className="w-16 shrink-0 text-right text-[10px] text-[#888]">
                {impact.sources_passing}/{impact.sources_total}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-3 border-t border-[#252530] pt-2">
        <p className="text-[10px] text-[#666]">
          The most impactful criterion is the one whose removal would recover the most sources.
          Consider relaxing high-impact criteria if too few sources qualify.
        </p>
      </div>
    </div>
  );
}
