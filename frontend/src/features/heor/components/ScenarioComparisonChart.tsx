import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ChartCard, CHART, TOOLTIP_CLS, formatCompact } from "@/features/data-explorer/components/charts/chartUtils";
import type { HeorResult } from "../types";

interface Props {
  results: HeorResult[];
}

export default function ScenarioComparisonChart({ results }: Props) {
  if (!results || results.length === 0) {
    return (
      <ChartCard title="Scenario Comparison" subtitle="Total cost and QALYs by scenario">
        <div className="h-64 flex items-center justify-center text-sm text-text-ghost">
          No results to compare.
        </div>
      </ChartCard>
    );
  }

  const chartData = results.map((r) => ({
    name: truncateName(r.scenario?.name ?? `Scenario ${r.scenario_id}`),
    fullName: r.scenario?.name ?? `Scenario ${r.scenario_id}`,
    totalCost: r.total_cost ?? 0,
    totalQalys: r.total_qalys ?? 0,
    icer: r.icer,
    nmb: r.net_monetary_benefit,
    roi: r.roi_percent,
    isBaseCase: r.scenario?.is_base_case ?? false,
  }));

  return (
    <ChartCard
      title="Scenario Comparison"
      subtitle={`${results.length} scenarios — total cost (bars) vs QALYs (bars)`}
    >
      <div className="grid grid-cols-2 gap-4">
        {/* Cost comparison */}
        <div>
          <p className="text-[10px] text-text-ghost uppercase tracking-wider font-medium mb-2 px-1">
            Total Cost by Scenario
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: CHART.textDim, fontSize: 9 }}
                stroke={CHART.grid}
                axisLine={{ stroke: CHART.grid }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fill: CHART.textDim, fontSize: 9 }}
                tickFormatter={(v: number) => `$${formatCompact(v)}`}
                stroke={CHART.grid}
                axisLine={{ stroke: CHART.grid }}
                width={60}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload;
                  return (
                    <div className={TOOLTIP_CLS}>
                      <p className="text-xs font-semibold text-text-primary mb-1">
                        {d.fullName}
                        {d.isBaseCase && (
                          <span className="ml-1.5 text-[10px] text-success">(Base Case)</span>
                        )}
                      </p>
                      <div className="space-y-0.5 text-xs text-text-secondary">
                        <p>
                          Total Cost:{" "}
                          <span className="font-mono text-warning">${d.totalCost.toLocaleString()}</span>
                        </p>
                        {d.icer !== null && (
                          <p>
                            ICER: <span className="font-mono text-info">${d.icer.toLocaleString()}/QALY</span>
                          </p>
                        )}
                        {d.roi !== null && (
                          <p>
                            ROI: <span className="font-mono text-success">{d.roi.toFixed(1)}%</span>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="totalCost" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.isBaseCase ? CHART.textMuted : CHART.gold}
                    fillOpacity={entry.isBaseCase ? 0.5 : 0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* QALY comparison */}
        <div>
          <p className="text-[10px] text-text-ghost uppercase tracking-wider font-medium mb-2 px-1">
            Total QALYs by Scenario
          </p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
              <XAxis
                dataKey="name"
                tick={{ fill: CHART.textDim, fontSize: 9 }}
                stroke={CHART.grid}
                axisLine={{ stroke: CHART.grid }}
                interval={0}
                angle={-20}
                textAnchor="end"
                height={50}
              />
              <YAxis
                tick={{ fill: CHART.textDim, fontSize: 9 }}
                tickFormatter={(v: number) => v.toFixed(1)}
                stroke={CHART.grid}
                axisLine={{ stroke: CHART.grid }}
                width={45}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload;
                  return (
                    <div className={TOOLTIP_CLS}>
                      <p className="text-xs font-semibold text-text-primary mb-1">
                        {d.fullName}
                        {d.isBaseCase && (
                          <span className="ml-1.5 text-[10px] text-success">(Base Case)</span>
                        )}
                      </p>
                      <div className="space-y-0.5 text-xs text-text-secondary">
                        <p>
                          Total QALYs:{" "}
                          <span className="font-mono text-success">{d.totalQalys.toFixed(3)}</span>
                        </p>
                        {d.nmb !== null && (
                          <p>
                            NMB:{" "}
                            <span className={`font-mono ${d.nmb >= 0 ? "text-success" : "text-critical"}`}>
                              ${d.nmb.toLocaleString()}
                            </span>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                }}
              />
              <Bar dataKey="totalQalys" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {chartData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={entry.isBaseCase ? CHART.textMuted : CHART.accent}
                    fillOpacity={entry.isBaseCase ? 0.5 : 0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary row */}
      <div className="mt-3 flex flex-wrap gap-3 px-1">
        {chartData.map((d, i) => (
          <div
            key={i}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${
              d.isBaseCase
                ? "border-surface-highlight bg-surface-overlay"
                : "border-border-default bg-surface-base"
            }`}
          >
            <span className="font-medium text-text-secondary">{d.fullName}</span>
            {d.isBaseCase && (
              <span className="text-[10px] text-success bg-success/10 px-1.5 py-0.5 rounded">
                Base
              </span>
            )}
            <span className="font-mono text-warning">${formatCompact(d.totalCost)}</span>
            <span className="text-text-ghost">|</span>
            <span className="font-mono text-success">{d.totalQalys.toFixed(2)} QALYs</span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

function truncateName(name: string): string {
  if (name.length <= 16) return name;
  return name.slice(0, 14) + "…";
}
