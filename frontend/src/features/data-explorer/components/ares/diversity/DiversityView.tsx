import { useDiversity } from "../../../hooks/useNetworkData";
import type { DiversitySource } from "../../../types/ares";

const RATING_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  very_high: { bg: "bg-[#2DD4BF]/10", text: "text-[#2DD4BF]", border: "border-[#2DD4BF]/30" },
  high: { bg: "bg-[#C9A227]/10", text: "text-[#C9A227]", border: "border-[#C9A227]/30" },
  moderate: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" },
  low: { bg: "bg-[#9B1B30]/10", text: "text-[#9B1B30]", border: "border-[#9B1B30]/30" },
};

function RatingCard({ source }: { source: DiversitySource }) {
  const colors = RATING_COLORS[source.diversity_rating] ?? RATING_COLORS.low;
  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} p-3`}>
      <p className={`text-xl font-semibold ${colors.text}`}>{source.simpson_index.toFixed(2)}</p>
      <p className="mt-0.5 truncate text-xs text-[#8A857D]" title={source.source_name}>
        {source.source_name}
      </p>
      <p className={`mt-0.5 text-[10px] font-medium uppercase ${colors.text}`}>
        {source.diversity_rating.replace("_", " ")}
      </p>
    </div>
  );
}

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

      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {diversity.map((source: DiversitySource) => (
          <RatingCard key={source.source_id} source={source} />
        ))}
      </div>

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
