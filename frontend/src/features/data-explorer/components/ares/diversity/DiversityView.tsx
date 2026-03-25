import { useDiversity } from "../../../hooks/useNetworkData";
import type { DiversitySource } from "../../../types/ares";

const DEMO_COLORS = [
  "#2DD4BF", "#C9A227", "#9B1B30", "#6366F1", "#EC4899",
  "#F59E0B", "#10B981", "#8B5CF6", "#EF4444", "#3B82F6",
];

function DemographicBars({ label, data }: { label: string; data: Record<string, number> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return (
      <div className="mb-2">
        <p className="mb-1 text-[11px] uppercase text-[#666]">{label}</p>
        <p className="text-xs text-[#555]">No data</p>
      </div>
    );
  }

  return (
    <div className="mb-3">
      <p className="mb-1 text-[11px] uppercase text-[#666]">{label}</p>
      <div className="flex h-5 w-full overflow-hidden rounded">
        {entries.map(([name, pct], i) => (
          <div
            key={name}
            className="flex items-center justify-center text-[9px] font-medium text-black"
            style={{
              width: `${Math.max(pct, 2)}%`,
              backgroundColor: DEMO_COLORS[i % DEMO_COLORS.length],
            }}
            title={`${name}: ${pct}%`}
          >
            {pct >= 8 ? `${pct}%` : ""}
          </div>
        ))}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
        {entries.map(([name, pct], i) => (
          <span key={name} className="text-[10px] text-[#888]">
            <span
              className="mr-1 inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: DEMO_COLORS[i % DEMO_COLORS.length] }}
            />
            {name}: {pct}%
          </span>
        ))}
      </div>
    </div>
  );
}

export default function DiversityView() {
  const { data: diversity, isLoading } = useDiversity();

  if (isLoading) {
    return <div className="p-4 text-[#555]">Loading diversity data...</div>;
  }

  if (!diversity || diversity.length === 0) {
    return <div className="p-4 text-center text-[#555]">No sources available for diversity analysis.</div>;
  }

  return (
    <div className="p-4">
      <h2 className="mb-4 text-lg font-medium text-white">Diversity Report</h2>
      <p className="mb-4 text-xs text-[#666]">
        Demographic proportions across data sources. Sources sorted by population size.
      </p>

      <div className="space-y-4">
        {diversity.map((source: DiversitySource) => (
          <div key={source.source_id} className="rounded-lg border border-[#252530] bg-[#151518] p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-medium text-white">{source.source_name}</h3>
              <span className="text-xs text-[#888]">{source.person_count.toLocaleString()} persons</span>
            </div>
            <DemographicBars label="Gender" data={source.gender} />
            <DemographicBars label="Race" data={source.race} />
            <DemographicBars label="Ethnicity" data={source.ethnicity} />
          </div>
        ))}
      </div>
    </div>
  );
}
