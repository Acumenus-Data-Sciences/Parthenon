import { useCrossSourceCost } from "../../../hooks/useCostData";

interface CrossSourceCostChartProps {
  domain?: string;
  costTypeId?: number;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export default function CrossSourceCostChart({
  domain = "all",
  costTypeId,
}: CrossSourceCostChartProps) {
  const { data, isLoading } = useCrossSourceCost(domain, costTypeId);

  if (isLoading) {
    return <div className="p-4 text-[#555]">Loading cross-source comparison...</div>;
  }

  if (!data || data.sources.length === 0) {
    return <div className="p-4 text-center text-[#555]">No sources available for comparison.</div>;
  }

  const sourcesWithData = data.sources.filter((s) => s.has_cost_data && s.distribution);

  if (sourcesWithData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#323238] bg-[#151518] py-12">
        <div className="mb-2 text-3xl text-[#333]">$</div>
        <p className="text-sm text-[#666]">No sources have cost data for comparison.</p>
      </div>
    );
  }

  // Compute global max for scaling
  const globalMax = Math.max(
    ...sourcesWithData.map((s) => s.distribution?.max ?? 0),
  );

  return (
    <div className="space-y-3">
      <p className="text-xs text-[#555]">
        Box-and-whisker per source. Box = IQR (P25-P75), whiskers = P10-P90, gold line = median.
      </p>
      {sourcesWithData.map((source) => {
        const dist = source.distribution;
        if (!dist) return null;

        const scale = (v: number) => `${(v / globalMax) * 100}%`;

        return (
          <div
            key={source.source_id}
            className="rounded-lg border border-[#252530] bg-[#151518] p-3"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-white">{source.source_name}</span>
              <span className="text-xs text-[#666]">
                Range: {formatCurrency(dist.min)} - {formatCurrency(dist.max)}
              </span>
            </div>

            {/* Box plot visualization */}
            <div className="relative h-10 w-full">
              <div className="absolute inset-0 flex items-center">
                {/* Whisker line (P10 to P90) */}
                <div
                  className="absolute h-0.5 bg-[#555]"
                  style={{
                    left: scale(dist.p10),
                    width: `calc(${scale(dist.p90)} - ${scale(dist.p10)})`,
                  }}
                />
                {/* Left whisker cap */}
                <div
                  className="absolute h-3 w-0.5 bg-[#555]"
                  style={{ left: scale(dist.p10) }}
                />
                {/* Right whisker cap */}
                <div
                  className="absolute h-3 w-0.5 bg-[#555]"
                  style={{ left: scale(dist.p90) }}
                />
                {/* IQR box */}
                <div
                  className="absolute h-6 rounded border border-[#2DD4BF] bg-[#2DD4BF]/20"
                  style={{
                    left: scale(dist.p25),
                    width: `calc(${scale(dist.p75)} - ${scale(dist.p25)})`,
                  }}
                />
                {/* Median line */}
                <div
                  className="absolute h-6 w-0.5 bg-[#C9A227]"
                  style={{ left: scale(dist.median) }}
                />
              </div>
            </div>

            {/* Legend */}
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-[#666]">
              <span>P10: {formatCurrency(dist.p10)}</span>
              <span>P25: {formatCurrency(dist.p25)}</span>
              <span className="text-[#C9A227]">Median: {formatCurrency(dist.median)}</span>
              <span>P75: {formatCurrency(dist.p75)}</span>
              <span>P90: {formatCurrency(dist.p90)}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
