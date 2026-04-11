import { useState, useMemo } from "react";
import { useDiversity, useAgePyramid, useDapCheck, usePooledDemographics, useDiversityTrends } from "../../../hooks/useNetworkData";
import type { DiversitySource } from "../../../types/ares";
import AgePyramid from "./AgePyramid";
import DapGapMatrix from "./DapGapMatrix";
import BenchmarkOverlay from "./BenchmarkOverlay";
import GeographicDiversityView from "./GeographicDiversityView";
import DiversityTrendsChart from "./DiversityTrendsChart";

type DiversityTab = "overview" | "pyramid" | "dap" | "pooled" | "geographic" | "trends";

const RATING_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  very_high: { bg: "bg-success/10", text: "text-success", border: "border-success/30" },
  high: { bg: "bg-accent/10", text: "text-accent", border: "border-accent/30" },
  moderate: { bg: "bg-amber-500/10", text: "text-amber-400", border: "border-amber-500/30" },
  low: { bg: "bg-primary/10", text: "text-primary", border: "border-primary/30" },
};

function RatingCard({ source }: { source: DiversitySource }) {
  const colors = RATING_COLORS[source.diversity_rating] ?? RATING_COLORS.low;
  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} p-3`}>
      <p className={`text-xl font-semibold ${colors.text}`}>{source.simpson_index.toFixed(2)}</p>
      <p className="mt-0.5 truncate text-xs text-text-muted" title={source.source_name}>
        {source.source_name}
      </p>
      <p className={`mt-0.5 text-[10px] font-medium uppercase ${colors.text}`}>
        {source.diversity_rating.replace("_", " ")}
      </p>
    </div>
  );
}

const DEMO_COLORS = [
  "var(--success)", "var(--accent)", "var(--primary)", "#6366F1", "#EC4899",
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

// US Census 2020 approximate benchmarks for DAP gap analysis
const DEFAULT_DAP_TARGETS: Record<string, number> = {
  Male: 49.2,
  Female: 50.8,
  White: 57.8,
  "Black or African American": 12.4,
  "Asian": 5.9,
  "Hispanic or Latino": 18.7,
};

export default function DiversityView() {
  const [activeTab, setActiveTab] = useState<DiversityTab>("overview");
  const [pyramidSourceId, setPyramidSourceId] = useState<number | null>(null);
  const [pooledSourceIds, setPooledSourceIds] = useState<number[]>([]);
  const [trendsSourceId, setTrendsSourceId] = useState<number | null>(null);

  const { data: diversity, isLoading } = useDiversity();
  const { data: pyramidData } = useAgePyramid(pyramidSourceId);
  const { data: dapData } = useDapCheck(activeTab === "dap" ? DEFAULT_DAP_TARGETS : null);
  const { data: pooledData } = usePooledDemographics(pooledSourceIds);
  const { data: trendsData } = useDiversityTrends(trendsSourceId);

  const pyramidSource = useMemo(
    () => diversity?.find((s) => s.source_id === pyramidSourceId),
    [diversity, pyramidSourceId],
  );

  if (isLoading) {
    return <div className="p-4 text-[#555]">Loading diversity data...</div>;
  }

  if (!diversity || diversity.length === 0) {
    return <div className="p-4 text-center text-[#555]">No sources available for diversity analysis.</div>;
  }

  const tabs: Array<{ key: DiversityTab; label: string }> = [
    { key: "overview", label: "Overview" },
    { key: "pyramid", label: "Age Pyramid" },
    { key: "dap", label: "DAP Gap" },
    { key: "pooled", label: "Pooled" },
    { key: "geographic", label: "Geographic" },
    { key: "trends", label: "Trends" },
  ];

  return (
    <div className="p-4">
      <h2 className="mb-4 text-lg font-medium text-white">Diversity Report</h2>
      <p className="mb-4 text-xs text-[#666]">
        Demographic proportions across data sources. Sources sorted by population size.
      </p>

      {/* Tab bar */}
      <div className="mb-4 flex gap-1 rounded-lg border border-[#252530] bg-surface-base p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-[#252530] text-accent"
                : "text-[#888] hover:text-[#ccc]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Rating cards (always visible) */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        {diversity.map((source: DiversitySource) => (
          <RatingCard key={source.source_id} source={source} />
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="space-y-4">
          {diversity.map((source: DiversitySource) => (
            <div key={source.source_id} className="rounded-lg border border-[#252530] bg-surface-raised p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">{source.source_name}</h3>
                <span className="text-xs text-[#888]">{source.person_count.toLocaleString()} persons</span>
              </div>
              <DemographicBars label="Gender" data={source.gender} />
              <DemographicBars label="Race" data={source.race} />
              <DemographicBars label="Ethnicity" data={source.ethnicity} />
              {/* Benchmark overlay for race */}
              {Object.keys(source.race).length > 0 && (
                <BenchmarkOverlay
                  label="US Census 2020"
                  benchmarks={{ White: 57.8, "Black or African American": 12.4, Asian: 5.9 }}
                  actual={source.race}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {activeTab === "pyramid" && (
        <div className="space-y-4">
          <select
            value={pyramidSourceId ?? ""}
            onChange={(e) => setPyramidSourceId(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border border-[#252530] bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          >
            <option value="">Select a source</option>
            {diversity.map((s) => (
              <option key={s.source_id} value={s.source_id}>{s.source_name}</option>
            ))}
          </select>
          {pyramidData && pyramidSource && (
            <AgePyramid
              data={pyramidData.map((d) => ({ group: d.age_group, male: d.male, female: d.female }))}
              sourceName={pyramidSource.source_name}
            />
          )}
        </div>
      )}

      {activeTab === "dap" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-[#252530] bg-surface-raised p-4">
            <h3 className="mb-2 text-sm font-medium text-white">FDA DAP Enrollment Gap Analysis</h3>
            <p className="mb-3 text-xs text-[#666]">
              Compares source demographics against US Census 2020 benchmarks to identify enrollment gaps.
            </p>
            {dapData && <DapGapMatrix data={dapData} />}
          </div>
        </div>
      )}

      {activeTab === "pooled" && (
        <div className="space-y-4">
          <div className="rounded-lg border border-[#252530] bg-surface-raised p-4">
            <h3 className="mb-2 text-sm font-medium text-white">Pooled Demographics</h3>
            <p className="mb-3 text-xs text-[#666]">
              Select multiple sources to see weighted-merged demographic profiles.
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              {diversity.map((s) => {
                const isSelected = pooledSourceIds.includes(s.source_id);
                return (
                  <button
                    key={s.source_id}
                    type="button"
                    onClick={() =>
                      setPooledSourceIds((prev) =>
                        isSelected
                          ? prev.filter((id) => id !== s.source_id)
                          : [...prev, s.source_id],
                      )
                    }
                    className={`rounded-full px-3 py-1 text-xs transition-colors ${
                      isSelected
                        ? "bg-accent/20 text-accent border border-accent/50"
                        : "bg-[#252530] text-[#888] border border-[#252530] hover:border-accent/30"
                    }`}
                  >
                    {s.source_name}
                  </button>
                );
              })}
            </div>
            {pooledData && (
              <div>
                <p className="mb-2 text-xs text-[#888]">
                  Total: {pooledData.total_persons.toLocaleString()} persons across {pooledSourceIds.length} sources
                </p>
                <DemographicBars label="Gender" data={pooledData.gender} />
                <DemographicBars label="Race" data={pooledData.race} />
                <DemographicBars label="Ethnicity" data={pooledData.ethnicity} />
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "geographic" && <GeographicDiversityView />}

      {activeTab === "trends" && (
        <div className="space-y-4">
          <select
            value={trendsSourceId ?? ""}
            onChange={(e) => setTrendsSourceId(e.target.value ? Number(e.target.value) : null)}
            className="rounded-lg border border-[#252530] bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
          >
            <option value="">Select a source</option>
            {diversity.map((s) => (
              <option key={s.source_id} value={s.source_id}>{s.source_name}</option>
            ))}
          </select>
          {trendsData && trendsSourceId && (
            <DiversityTrendsChart
              data={trendsData.releases}
              sourceName={diversity.find((s) => s.source_id === trendsSourceId)?.source_name ?? ""}
            />
          )}
          {trendsSourceId && trendsData && trendsData.releases.length === 0 && (
            <div className="rounded-lg border border-dashed border-surface-highlight bg-surface-raised py-12 text-center">
              <p className="text-sm text-[#666]">No releases found for this source. Create releases to track diversity trends.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
