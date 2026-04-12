interface CostDistribution {
  domain: string;
  min: number;
  p10: number;
  p25: number;
  median: number;
  p75: number;
  p90: number;
  max: number;
  mean: number;
  count: number;
}

interface CostBoxPlotProps {
  distributions: CostDistribution[];
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatDomain(domain: string): string {
  return domain.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CostBoxPlot({ distributions }: CostBoxPlotProps) {
  if (distributions.length === 0) return null;

  return (
    <div className="space-y-3">
      {distributions.map((dist) => (
        <div key={dist.domain} className="rounded-lg border border-border-subtle bg-surface-raised p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-white">{formatDomain(dist.domain)}</span>
            <span className="text-xs text-text-ghost">{dist.count.toLocaleString()} records</span>
          </div>

          {/* Box plot visualization */}
          <div className="relative h-10 w-full">
            {(() => {
              const scale = (v: number) => `${(v / dist.max) * 100}%`;
              return (
                <div className="absolute inset-0 flex items-center">
                  {/* Whisker line */}
                  <div
                    className="absolute h-0.5 bg-surface-highlight"
                    style={{ left: scale(dist.p10), width: `calc(${scale(dist.p90)} - ${scale(dist.p10)})` }}
                  />
                  {/* IQR box */}
                  <div
                    className="absolute h-6 rounded border border-success bg-success/20"
                    style={{
                      left: scale(dist.p25),
                      width: `calc(${scale(dist.p75)} - ${scale(dist.p25)})`,
                    }}
                  />
                  {/* Median line */}
                  <div
                    className="absolute h-6 w-0.5 bg-accent"
                    style={{ left: scale(dist.median) }}
                  />
                  {/* Mean dot */}
                  <div
                    className="absolute h-2 w-2 -translate-x-1/2 rounded-full bg-critical"
                    style={{ left: scale(dist.mean) }}
                  />
                </div>
              );
            })()}
          </div>

          {/* Legend */}
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-text-ghost">
            <span>P10: {formatCurrency(dist.p10)}</span>
            <span>P25: {formatCurrency(dist.p25)}</span>
            <span className="text-accent">Median: {formatCurrency(dist.median)}</span>
            <span>P75: {formatCurrency(dist.p75)}</span>
            <span>P90: {formatCurrency(dist.p90)}</span>
            <span className="text-critical">Mean: {formatCurrency(dist.mean)}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
