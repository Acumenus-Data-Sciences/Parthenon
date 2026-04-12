import { useGeographicDiversity } from "../../../hooks/useNetworkData";
import type { GeographicDiversity } from "../../../types/ares";

const STATE_BAR_COLORS = [
  "var(--success)", "var(--accent)", "var(--primary)", "#6366F1", "#EC4899",
  "#F59E0B", "#10B981", "#8B5CF6", "#EF4444", "#3B82F6",
];

function ADIRatingLabel({ median }: { median: number | null }) {
  if (median === null) return <span className="text-text-ghost">N/A</span>;

  const label =
    median <= 3 ? "Low deprivation" :
    median <= 6 ? "Moderate deprivation" :
    "High deprivation (underserved)";

  const color =
    median <= 3 ? "text-success" :
    median <= 6 ? "text-accent" :
    "text-primary";

  return <span className={color}>{label}</span>;
}

function StateDistributionBars({ data }: { data: Record<string, number> }) {
  const entries = Object.entries(data)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 15);

  if (entries.length === 0) {
    return <p className="text-xs text-text-ghost">No location data available</p>;
  }

  const maxCount = entries[0][1];

  return (
    <div className="space-y-1">
      {entries.map(([state, count], i) => (
        <div key={state} className="flex items-center gap-2">
          <span className="w-8 text-right text-[11px] font-mono text-text-muted">{state}</span>
          <div className="flex-1">
            <div
              className="h-4 rounded-sm"
              style={{
                width: `${Math.max((count / maxCount) * 100, 2)}%`,
                backgroundColor: STATE_BAR_COLORS[i % STATE_BAR_COLORS.length],
              }}
            />
          </div>
          <span className="w-16 text-right text-[11px] text-text-muted">{count.toLocaleString()}</span>
        </div>
      ))}
    </div>
  );
}

function ADIHistogram({ data }: { data: Record<string, number> }) {
  if (Object.keys(data).length === 0) {
    return <p className="text-xs text-text-ghost">ADI data not available (GIS module may not have ADI loaded)</p>;
  }

  // Fill in all deciles 1-10
  const deciles = Array.from({ length: 10 }, (_, i) => String(i + 1));
  const maxCount = Math.max(...Object.values(data), 1);

  return (
    <div className="space-y-1">
      <div className="flex items-end gap-1" style={{ height: 120 }}>
        {deciles.map((d) => {
          const count = data[d] ?? 0;
          const height = count > 0 ? Math.max((count / maxCount) * 100, 4) : 0;
          const isDisadvantaged = Number(d) >= 7;

          return (
            <div key={d} className="flex flex-1 flex-col items-center">
              <div
                className="w-full rounded-t"
                style={{
                  height: `${height}%`,
                  backgroundColor: isDisadvantaged ? "var(--primary)" : "var(--success)",
                  opacity: count > 0 ? 1 : 0.2,
                }}
                title={`Decile ${d}: ${count} ZIP codes`}
              />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1">
        {deciles.map((d) => (
          <div key={d} className="flex-1 text-center text-[10px] text-text-ghost">{d}</div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-text-ghost">
        <span>Least deprived</span>
        <span>ADI Decile</span>
        <span>Most deprived</span>
      </div>
    </div>
  );
}

export default function GeographicDiversityView() {
  const { data: geoData, isLoading } = useGeographicDiversity();

  if (isLoading) {
    return <div className="p-4 text-text-ghost">Loading geographic diversity data...</div>;
  }

  if (!geoData || geoData.length === 0) {
    return (
      <div className="p-4 text-center text-text-ghost">
        No geographic data available. Sources may not have location data in the person table.
      </div>
    );
  }

  // Network aggregate
  const totalReach = new Set(geoData.flatMap((s: GeographicDiversity) => Object.keys(s.state_distribution))).size;
  const adis = geoData.map((s: GeographicDiversity) => s.median_adi).filter((a): a is number => a !== null);
  const networkMedianAdi = adis.length > 0
    ? Math.round((adis.reduce((sum, v) => sum + v, 0) / adis.length) * 10) / 10
    : null;

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-lg border border-border-subtle bg-surface-raised p-3">
          <p className="text-2xl font-semibold text-success">{totalReach}</p>
          <p className="mt-0.5 text-xs text-text-muted">States / regions covered</p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface-raised p-3">
          <p className="text-2xl font-semibold text-accent">
            {networkMedianAdi !== null ? networkMedianAdi : "N/A"}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">
            Network Median ADI: <ADIRatingLabel median={networkMedianAdi} />
          </p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface-raised p-3">
          <p className="text-2xl font-semibold text-white">{geoData.length}</p>
          <p className="mt-0.5 text-xs text-text-muted">Sources with location data</p>
        </div>
        <div className="rounded-lg border border-border-subtle bg-surface-raised p-3">
          <p className="text-2xl font-semibold text-white">
            {geoData.filter((s: GeographicDiversity) => Object.keys(s.adi_distribution).length > 0).length}
          </p>
          <p className="mt-0.5 text-xs text-text-muted">Sources with ADI data</p>
        </div>
      </div>

      {/* Per-source breakdown */}
      {geoData.map((source: GeographicDiversity) => (
        <div key={source.source_id} className="rounded-lg border border-border-subtle bg-surface-raised p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-medium text-white">{source.source_name}</h3>
            <div className="flex items-center gap-3">
              <span className="text-xs text-text-muted">
                {source.geographic_reach} states
              </span>
              {source.median_adi !== null && (
                <span className="text-xs text-text-muted">
                  Median ADI: {source.median_adi}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <p className="mb-2 text-[11px] uppercase text-text-ghost">Top States by Patient Count</p>
              <StateDistributionBars data={source.state_distribution} />
            </div>
            <div>
              <p className="mb-2 text-[11px] uppercase text-text-ghost">ADI Decile Distribution</p>
              <ADIHistogram data={source.adi_distribution} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
