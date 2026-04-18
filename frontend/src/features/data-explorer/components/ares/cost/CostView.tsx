import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import { formatNumber } from "@/i18n/format";
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
import CrossSourceCostChart from "./CrossSourceCostChart";
import CostDriversView from "./CostDriversView";

type CostTab = "overview" | "distribution" | "care-setting" | "trends" | "cross-source" | "drivers";

function EmptyState() {
  const { t } = useTranslation("app");

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-highlight bg-surface-raised py-16">
      <div className="mb-3 text-4xl text-text-disabled">$</div>
      <h3 className="mb-2 text-sm font-medium text-text-primary">
        {t("dataExplorer.ares.cost.empty.title")}
      </h3>
      <p className="max-w-md text-center text-xs text-text-ghost">
        {t("dataExplorer.ares.cost.empty.message")}
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
  const { t } = useTranslation("app");
  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<CostTab>("overview");
  const [selectedCostTypeId, setSelectedCostTypeId] = useState<number | null>(null);

  const { data: sources } = useQuery({ queryKey: ["sources"], queryFn: fetchSources });
  const { data: summary, isLoading: summaryLoading } = useCostSummary(selectedSourceId, selectedCostTypeId);
  const { data: trends, isLoading: trendsLoading } = useCostTrends(selectedSourceId, selectedCostTypeId);
  const { data: distributionData } = useCostDistribution(
    selectedSourceId,
    undefined,
    selectedCostTypeId ?? undefined,
  );
  const { data: careSettingData } = useCareSettingBreakdown(selectedSourceId);
  const { data: costTypes } = useCostTypes(selectedSourceId);

  const isLoading = summaryLoading || trendsLoading;
  const tabLabel = (tab: CostTab) => t(`dataExplorer.ares.cost.tabs.${tab}`);

  return (
    <div className="p-4">
      {/* Source selector */}
      <div className="mb-4 flex items-center gap-4">
        <label className="text-sm text-text-muted">
          {t("dataExplorer.ares.cost.filters.source")}
        </label>
        <select
          value={selectedSourceId ?? ""}
          onChange={(e) => {
            setSelectedSourceId(Number(e.target.value) || null);
            setSelectedCostTypeId(null);
            setActiveTab("overview");
          }}
          className="rounded border border-border-default bg-surface-overlay px-3 py-1.5 text-sm text-text-primary"
        >
          <option value="">
            {t("dataExplorer.ares.cost.filters.selectSource")}
          </option>
          {sources?.map((s) => (
            <option key={s.id} value={s.id}>
              {s.source_name}
            </option>
          ))}
        </select>

        {/* Tab navigation */}
        {selectedSourceId && summary?.has_cost_data && (
          <div className="ml-auto flex flex-wrap items-center gap-1 rounded-lg border border-border-subtle bg-surface-base p-0.5">
            {(["overview", "distribution", "care-setting", "trends", "drivers", "cross-source"] as const).map((tab) => {
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-md px-3 py-1 text-xs transition-colors ${
                    activeTab === tab
                      ? "bg-surface-accent text-text-primary"
                      : "text-text-ghost hover:text-text-primary"
                  }`}
                >
                  {tabLabel(tab)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {!selectedSourceId && (
        <p className="py-10 text-center text-text-ghost">
          {t("dataExplorer.ares.cost.messages.selectSource")}
        </p>
      )}

      {selectedSourceId && isLoading && (
        <p className="text-text-ghost">
          {t("dataExplorer.ares.cost.messages.loading")}
        </p>
      )}

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
              <div className="rounded-lg border border-border-subtle bg-surface-raised p-3 text-center">
                <p className="text-xl font-semibold text-success">{formatCurrency(summary.total_cost)}</p>
                <p className="text-[10px] text-text-ghost">
                  {t("dataExplorer.ares.cost.metrics.totalCost")}
                </p>
              </div>
              <div className="rounded-lg border border-border-subtle bg-surface-raised p-3 text-center">
                <p className="text-xl font-semibold text-accent">{formatCurrency(summary.pppy ?? 0)}</p>
                <p className="text-[10px] text-text-ghost">
                  {t("dataExplorer.ares.cost.metrics.perPatientPerYear")}
                </p>
              </div>
              <div className="rounded-lg border border-border-subtle bg-surface-raised p-3 text-center">
                <p className="text-xl font-semibold text-text-primary">
                  {formatNumber(summary.person_count ?? 0)}
                </p>
                <p className="text-[10px] text-text-ghost">
                  {t("dataExplorer.ares.cost.metrics.persons")}
                </p>
              </div>
              <div className="rounded-lg border border-border-subtle bg-surface-raised p-3 text-center">
                <p className="text-xl font-semibold text-text-primary">
                  {t("dataExplorer.ares.cost.metrics.observationYears", {
                    value: formatNumber(summary.avg_observation_years ?? 0, {
                      maximumFractionDigits: 1,
                    }),
                  })}
                </p>
                <p className="text-[10px] text-text-ghost">
                  {t("dataExplorer.ares.cost.metrics.avgObservation")}
                </p>
              </div>
            </div>
          )}

          {/* Overview tab */}
          {activeTab === "overview" && (
            <>
              {/* Cost by domain bar chart */}
              <div className="mb-6 rounded-lg border border-border-subtle bg-surface-raised p-4">
                <h3 className="mb-3 text-sm font-medium text-text-primary">
                  {t("dataExplorer.ares.cost.sections.costByDomain")}
                </h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={summary.domains.map((d) => ({
                        ...d,
                        label: formatDomain(d.domain),
                      }))}
                      margin={{ top: 5, right: 20, bottom: 40, left: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-accent)" />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                        angle={-30}
                        textAnchor="end"
                      />
                      <YAxis
                        tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                        tickFormatter={(v: number) => formatCurrency(v)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--surface-overlay)",
                          border: "1px solid #333",
                          borderRadius: "8px",
                        }}
                        labelStyle={{ color: "var(--text-primary)" }}
                        formatter={(value: number | string) => [
                          formatCurrency(Number(value)),
                          t("dataExplorer.ares.cost.metrics.totalCost"),
                        ]}
                      />
                      <Bar dataKey="total_cost" fill="var(--success)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Summary stats */}
                <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                  {summary.domains.map((d) => (
                    <div key={d.domain} className="rounded border border-border-subtle bg-surface-base p-3">
                      <p className="text-[10px] uppercase tracking-wider text-text-ghost">
                        {formatDomain(d.domain)}
                      </p>
                      <p className="text-sm font-semibold text-text-primary">{formatCurrency(d.total_cost)}</p>
                      <p className="text-[10px] text-text-ghost">
                        {t("dataExplorer.ares.cost.metrics.recordsAverage", {
                          records: formatNumber(d.record_count),
                          average: formatCurrency(d.avg_cost),
                        })}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Distribution tab — box plots */}
          {activeTab === "distribution" && distributionData && (
            <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
              <h3 className="mb-3 text-sm font-medium text-text-primary">
                {t("dataExplorer.ares.cost.sections.distributionByDomain")}
              </h3>
              <p className="mb-4 text-xs text-text-ghost">
                {t("dataExplorer.ares.cost.messages.distributionHelp")}
              </p>
              {distributionData.has_cost_data ? (
                <CostBoxPlot distributions={distributionData.distributions} />
              ) : (
                <p className="py-8 text-center text-sm text-text-ghost">
                  {t("dataExplorer.ares.cost.messages.noDistributionData")}
                </p>
              )}
            </div>
          )}

          {/* Care setting tab */}
          {activeTab === "care-setting" && careSettingData && (
            <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
              <h3 className="mb-3 text-sm font-medium text-text-primary">
                {t("dataExplorer.ares.cost.sections.costByCareSetting")}
              </h3>
              <CareSettingBreakdown settings={careSettingData.settings} />
            </div>
          )}

          {/* Trends tab */}
          {activeTab === "trends" && trends && trends.has_cost_data && trends.months.length > 0 && (
            <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
              <h3 className="mb-3 text-sm font-medium text-text-primary">
                {t("dataExplorer.ares.cost.sections.monthlyTrends")}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={trends.months}
                    margin={{ top: 5, right: 20, bottom: 30, left: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-accent)" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: "var(--text-muted)", fontSize: 10 }}
                      angle={-45}
                      textAnchor="end"
                    />
                    <YAxis
                      tick={{ fill: "var(--text-muted)", fontSize: 11 }}
                      tickFormatter={(v: number) => formatCurrency(v)}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--surface-overlay)",
                        border: "1px solid #333",
                        borderRadius: "8px",
                      }}
                      labelStyle={{ color: "var(--text-primary)" }}
                      formatter={(value: number | string) => [
                        formatCurrency(Number(value)),
                        t("dataExplorer.ares.cost.metrics.totalCost"),
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="total_cost"
                      stroke="var(--accent)"
                      strokeWidth={2}
                      dot={{ fill: "var(--accent)", r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* Cost Drivers tab */}
          {activeTab === "drivers" && (
            <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
              <h3 className="mb-3 text-sm font-medium text-text-primary">
                {t("dataExplorer.ares.cost.sections.topCostDrivers")}
              </h3>
              <CostDriversView sourceId={selectedSourceId} />
            </div>
          )}

          {/* Cross-Source tab */}
          {activeTab === "cross-source" && (
            <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
              <h3 className="mb-3 text-sm font-medium text-text-primary">
                {t("dataExplorer.ares.cost.sections.crossSourceComparison")}
              </h3>
              <CrossSourceCostChart />
            </div>
          )}
        </>
      )}
    </div>
  );
}
