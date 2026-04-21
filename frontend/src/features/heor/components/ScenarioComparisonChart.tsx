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
import { useTranslation } from "react-i18next";
import { ChartCard, CHART, TOOLTIP_CLS, formatCompact } from "@/features/data-explorer/components/charts/chartUtils";
import type { HeorResult } from "../types";

interface Props {
  results: HeorResult[];
}

export default function ScenarioComparisonChart({ results }: Props) {
  const { t } = useTranslation("app");

  if (!results || results.length === 0) {
    return (
      <ChartCard
        title={t("heor.charts.scenarioComparison.title")}
        subtitle={t("heor.charts.scenarioComparison.emptySubtitle")}
      >
        <div className="h-64 flex items-center justify-center text-sm text-text-ghost">
          {t("heor.charts.scenarioComparison.noData")}
        </div>
      </ChartCard>
    );
  }

  const chartData = results.map((result) => ({
    name: truncateName(
      result.scenario?.name ??
        t("heor.analysis.scenarioFallback", { id: result.scenario_id }),
    ),
    fullName:
      result.scenario?.name ??
      t("heor.analysis.scenarioFallback", { id: result.scenario_id }),
    totalCost: result.total_cost ?? 0,
    totalQalys: result.total_qalys ?? 0,
    icer: result.icer,
    nmb: result.net_monetary_benefit,
    roi: result.roi_percent,
    isBaseCase: result.scenario?.is_base_case ?? false,
  }));

  return (
    <ChartCard
      title={t("heor.charts.scenarioComparison.title")}
      subtitle={t("heor.charts.scenarioComparison.subtitle", {
        scenarioCount: t("heor.common.count.scenario", { count: results.length }),
      })}
    >
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-[10px] text-text-ghost uppercase tracking-wider font-medium mb-2 px-1">
            {t("heor.charts.scenarioComparison.totalCostByScenario")}
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
                tickFormatter={(value: number) => `$${formatCompact(value)}`}
                stroke={CHART.grid}
                axisLine={{ stroke: CHART.grid }}
                width={60}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const datum = payload[0].payload;
                  return (
                    <div className={TOOLTIP_CLS}>
                      <p className="text-xs font-semibold text-text-primary mb-1">
                        {datum.fullName}
                        {datum.isBaseCase && (
                          <span className="ml-1.5 text-[10px] text-success">
                            {t("heor.charts.scenarioComparison.baseCase")}
                          </span>
                        )}
                      </p>
                      <div className="space-y-0.5 text-xs text-text-secondary">
                        <p>
                          {t("heor.charts.scenarioComparison.totalCost")}{" "}
                          <span className="font-mono text-warning">
                            ${datum.totalCost.toLocaleString()}
                          </span>
                        </p>
                        {datum.icer !== null && (
                          <p>
                            {t("heor.charts.costEffectivenessPlane.icer", {
                              value: datum.icer.toLocaleString(),
                            })}
                          </p>
                        )}
                        {datum.roi !== null && (
                          <p>
                            {t("heor.common.labels.roi")}:{" "}
                            <span className="font-mono text-success">{datum.roi.toFixed(1)}%</span>
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

        <div>
          <p className="text-[10px] text-text-ghost uppercase tracking-wider font-medium mb-2 px-1">
            {t("heor.charts.scenarioComparison.totalQalysByScenario")}
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
                tickFormatter={(value: number) => value.toFixed(1)}
                stroke={CHART.grid}
                axisLine={{ stroke: CHART.grid }}
                width={45}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const datum = payload[0].payload;
                  return (
                    <div className={TOOLTIP_CLS}>
                      <p className="text-xs font-semibold text-text-primary mb-1">
                        {datum.fullName}
                        {datum.isBaseCase && (
                          <span className="ml-1.5 text-[10px] text-success">
                            {t("heor.charts.scenarioComparison.baseCase")}
                          </span>
                        )}
                      </p>
                      <div className="space-y-0.5 text-xs text-text-secondary">
                        <p>
                          {t("heor.charts.scenarioComparison.totalQalys")}{" "}
                          <span className="font-mono text-success">{datum.totalQalys.toFixed(3)}</span>
                        </p>
                        {datum.nmb !== null && (
                          <p>
                            {t("heor.charts.costEffectivenessPlane.nmb", {
                              value: datum.nmb.toLocaleString(),
                            })}
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

      <div className="mt-3 flex flex-wrap gap-3 px-1">
        {chartData.map((entry, index) => (
          <div
            key={index}
            className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs ${
              entry.isBaseCase
                ? "border-surface-highlight bg-surface-overlay"
                : "border-border-default bg-surface-base"
            }`}
          >
            <span className="font-medium text-text-secondary">{entry.fullName}</span>
            {entry.isBaseCase && (
              <span className="text-[10px] text-success bg-success/10 px-1.5 py-0.5 rounded">
                {t("heor.charts.scenarioComparison.base")}
              </span>
            )}
            <span className="font-mono text-warning">${formatCompact(entry.totalCost)}</span>
            <span className="text-text-ghost">|</span>
            <span className="font-mono text-success">
              {entry.totalQalys.toFixed(2)} {t("heor.charts.scenarioComparison.qalysShort")}
            </span>
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
