import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { fetchSources } from "@/features/data-sources/api/sourcesApi";
import {
  useCostSummary,
  useCostTrends,
  useCostDistribution,
  useCareSettingBreakdown,
  useCostTypes,
} from "../../../hooks/useCostData";
import CostBoxPlot from "./CostBoxPlot";
import CareSettingBreakdown from "./CareSettingBreakdown";
import CostTypeFilter from "./CostTypeFilter";

type CostTab = "overview" | "distribution" | "care-setting" | "trends";

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#323238] bg-[#151518] py-16">
      <div className="mb-3 text-4xl text-[#333]">$</div>
      <h3 className="mb-2 text-sm font-medium text-white">No Cost Data Available</h3>
      <p className="max-w-md text-center text-xs text-[#666]">
        Cost data requires claims-based datasets (e.g., MarketScan, Optum, PharMetrics).
        EHR-derived datasets like SynPUF, MIMIC-IV, and most academic medical center data
        typically do not populate the OMOP cost table.
      </p>
    </div>
  );
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

export default function CostView() {
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<CostTab>("overview");
  const [selectedCostTypeId, setSelectedCostTypeId] = useState<number | null>(null);

  const { data: sources } = useQuery({ queryKey: ["sources"], queryFn: fetchSources });
  const { data: summary, isLoading: summaryLoading } = useCostSummary(selectedSourceId);
  const { data: trends, isLoading: trendsLoading } = useCostTrends(selectedSourceId);
  const { data: distributionData } = useCostDistribution(
    selectedSourceId,
    undefined,
    selectedCostTypeId ?? undefined,
  );
  const { data: careSettingData } = useCareSettingBreakdown(selectedSourceId);
  const { data: costTypes } = useCostTypes(selectedSourceId);

  const isLoading = summaryLoading || trendsLoading;

  return (
    <div className="p-4">
      {/* Source selector */}
      <div className="mb-4 flex items-center gap-4">
        <label className="text-sm text-[#888]">Source:</label>
        <select
          value={selectedSourceId ?? ""}
          onChange={(e) => {
            setSelectedSourceId(Number(e.target.value) || null);
            setSelectedCostTypeId(null);
            setActiveTab("overview");
          }}
          className="rounded border border-[#333] bg-[#1a1a22] px-3 py-1.5 text-sm text-white"
        >
          <option value="">Select source...</option>
          {sources?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.source_name}
            </option>
          ))}
        </select>

        {/* Tab navigation */}
        {selectedSourceId && summary?.has_cost_data && (
          <div className="ml-auto flex items-center gap-1 rounded-lg border border-[#252530] bg-[#0E0E11] p-0.5">
            {(["overview", "distribution", "care-setting", "trends"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`rounded-md px-3 py-1 text-xs transition-colors ${
                  activeTab === tab
                    ? "bg-[#252530] text-white"
                    : "text-[#666] hover:text-white"
                }`}
              >
                {tab === "overview" ? "Overview" : tab === "distribution" ? "Distribution" : tab === "care-setting" ? "Care Setting" : "Trends"}
              </button>
            ))}
          </div>
        )}
      </div>

      {!selectedSourceId && (
        <p className="py-10 text-center text-[#555]">Select a source to view cost data.</p>
      )}

      {selectedSourceId && isLoading && <p className="text-[#555]">Loading cost data...</p>}

      {selectedSourceId && !isLoading && summary && !summary.has_cost_data && <EmptyState />}

      {selectedSourceId && !isLoading && summary && summary.has_cost_data && (
        <>
          {/* Cost type filter (shown on distribution and overview tabs) */}
          {(activeTab === "overview" || activeTab === "distribution") && costTypes && (
            <CostTypeFilter
              costTypes={costTypes}
              selectedTypeId={selectedCostTypeId}
              onSelect={setSelectedCostTypeId}
            />
          )}

          {/* PPPY + Total Cost summary cards */}
          {summary.total_cost !== undefined && (
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <div className="rounded-lg border border-[#252530] bg-[#151518] p-3 text-center">
                <p className="text-xl font-semibold text-[#2DD4BF]">{formatCurrency(summary.total_cost)}</p>
                <p className="text-[10px] text-[#666]">Total Cost</p>
              </div>
              <div className="rounded-lg border border-[#252530] bg-[#151518] p-3 text-center">
                <p className="text-xl font-semibold text-[#C9A227]">{formatCurrency(summary.pppy ?? 0)}</p>
                <p className="text-[10px] text-[#666]">Per-Patient-Per-Year</p>
              </div>
              <div className="rounded-lg border border-[#252530] bg-[#151518] p-3 text-center">
                <p className="text-xl font-semibold text-white">{(summary.person_count ?? 0).toLocaleString()}</p>
                <p className="text-[10px] text-[#666]">Persons</p>
              </div>
              <div className="rounded-lg border border-[#252530] bg-[#151518] p-3 text-center">
                <p className="text-xl font-semibold text-white">{(summary.avg_observation_years ?? 0).toFixed(1)} yr</p>
                <p className="text-[10px] text-[#666]">Avg Observation</p>
              </div>
            </div>
          )}

          {/* Overview tab */}
          {activeTab === "overview" && (
            <>
              {/* Cost by domain bar chart */}
              <div className="mb-6 rounded-lg border border-[#252530] bg-[#151518] p-4">
                <h3 className="mb-3 text-sm font-medium text-white">Cost by Domain</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={summary.domains.map((d) => ({
                        ...d,
                        label: formatDomain(d.domain),
                      }))}
                      margin={{ top: 5, right: 20, bottom: 40, left: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#252530" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "#888", fontSize: 11 }}
                        angle={-30}
                        textAnchor="end"
                      />
                      <YAxis
                        tick={{ fill: "#888", fontSize: 11 }}
                        tickFormatter={(v: number) => formatCurrency(v)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "#1a1a22",
                          border: "1px solid #333",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "#fff" }}
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        formatter={((value: number | string) => [formatCurrency(Number(value)), "Total Cost"]) as any}
                      />
                      <Bar dataKey="total_cost" fill="#2DD4BF" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Summary stats */}
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {summary.domains.map((d) => (
                    <div key={d.domain} className="rounded border border-[#252530] bg-[#0E0E11] p-3">
                      <p className="text-[10px] uppercase tracking-wider text-[#666]">
                        {formatDomain(d.domain)}
                      </p>
                      <p className="text-sm font-semibold text-white">{formatCurrency(d.total_cost)}</p>
                      <p className="text-[10px] text-[#555]">
                        {d.record_count.toLocaleString()} records | avg {formatCurrency(d.avg_cost)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Distribution tab — box plots */}
          {activeTab === "distribution" && distributionData && (
            <div className="rounded-lg border border-[#252530] bg-[#151518] p-4">
              <h3 className="mb-3 text-sm font-medium text-white">Cost Distribution by Domain</h3>
              <p className="mb-4 text-xs text-[#555]">
                Box-and-whisker plots showing cost spread. Box = IQR (P25-P75), whiskers = P10-P90,
                gold line = median, red dot = mean.
              </p>
              {distributionData.has_cost_data ? (
                <CostBoxPlot distributions={distributionData.distributions} />
              ) : (
                <p className="py-8 text-center text-sm text-[#555]">No distribution data available.</p>
              )}
            </div>
          )}

          {/* Care setting tab */}
          {activeTab === "care-setting" && careSettingData && (
            <div className="rounded-lg border border-[#252530] bg-[#151518] p-4">
              <h3 className="mb-3 text-sm font-medium text-white">Cost by Care Setting</h3>
              <CareSettingBreakdown settings={careSettingData.settings} />
            </div>
          )}

          {/* Trends tab */}
          {activeTab === "trends" && trends && trends.has_cost_data && trends.months.length > 0 && (
            <div className="rounded-lg border border-[#252530] bg-[#151518] p-4">
              <h3 className="mb-3 text-sm font-medium text-white">Monthly Cost Trends</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trends.months}
                    margin={{ top: 5, right: 20, bottom: 30, left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#252530" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: "#888", fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                    />
                    <YAxis
                      tick={{ fill: "#888", fontSize: 11 }}
                      tickFormatter={(v: number) => formatCurrency(v)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#1a1a22",
                        border: "1px solid #333",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "#fff" }}
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      formatter={((value: number | string) => [formatCurrency(Number(value)), "Total Cost"]) as any}
                    />
                    <Line
                      type="monotone"
                      dataKey="total_cost"
                      stroke="#C9A227"
                      strokeWidth={2}
                      dot={{ fill: "#C9A227", r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
