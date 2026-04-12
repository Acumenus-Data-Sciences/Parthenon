import { useCostDrivers } from "../../../hooks/useCostData";

interface CostDriversViewProps {
  sourceId: number | null;
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function formatDomain(domain: string): string {
  return domain
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

const BAR_COLORS = [
  "var(--success)", "var(--accent)", "var(--primary)", "var(--domain-observation)", "var(--domain-procedure)",
  "var(--warning)", "var(--success)", "var(--domain-observation)", "#EF4444", "var(--info)",
];

export default function CostDriversView({ sourceId }: CostDriversViewProps) {
  const { data, isLoading } = useCostDrivers(sourceId);

  if (!sourceId) {
    return <div className="py-8 text-center text-text-ghost">Select a source to view cost drivers.</div>;
  }

  if (isLoading) {
    return <div className="p-4 text-text-ghost">Loading cost drivers...</div>;
  }

  if (!data || !data.has_cost_data || data.drivers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-highlight bg-surface-raised py-12">
        <p className="text-sm text-text-ghost">No cost driver data available for this source.</p>
      </div>
    );
  }

  const maxCost = Math.max(...data.drivers.map((d) => d.total_cost));

  return (
    <div className="space-y-2">
      <p className="mb-3 text-xs text-text-ghost">
        Top 10 concepts by total cost. Click a bar for concept detail.
      </p>
      {data.drivers.map((driver, idx) => {
        const barWidth = maxCost > 0 ? (driver.total_cost / maxCost) * 100 : 0;
        const color = BAR_COLORS[idx % BAR_COLORS.length];

        return (
          <div
            key={driver.concept_id}
            className="group cursor-pointer rounded-lg border border-border-subtle bg-surface-raised p-3 transition-colors hover:border-accent/30"
          >
            <div className="mb-1 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-text-primary">{driver.concept_name}</span>
                <span className="rounded bg-surface-accent px-1.5 py-0.5 text-[10px] text-text-muted">
                  {formatDomain(driver.domain)}
                </span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="font-semibold text-success">{formatCurrency(driver.total_cost)}</span>
                <span className="text-accent">{driver.pct_of_total}%</span>
              </div>
            </div>

            {/* Horizontal bar */}
            <div className="mb-1.5 h-4 w-full overflow-hidden rounded bg-surface-base">
              <div
                className="flex h-full items-center rounded transition-all duration-300"
                style={{
                  width: `${Math.max(barWidth, 1)}%`,
                  backgroundColor: color,
                  opacity: 0.7,
                }}
              >
                {barWidth > 15 && (
                  <span className="px-2 text-[10px] font-medium text-black">
                    {driver.pct_of_total}%
                  </span>
                )}
              </div>
            </div>

            {/* Stats row */}
            <div className="flex gap-4 text-[10px] text-text-ghost">
              <span>{driver.record_count.toLocaleString()} records</span>
              <span>{driver.patient_count.toLocaleString()} patients</span>
              <span>
                Avg: {formatCurrency(driver.record_count > 0 ? driver.total_cost / driver.record_count : 0)}/record
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
