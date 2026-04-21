import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useTranslation } from "react-i18next";
import {
  ChartCard,
  CHART,
  TOOLTIP_CLS,
  formatCompact,
} from "@/features/data-explorer/components/charts/chartUtils";
import type { HeorResult } from "../types";

interface Props {
  results: HeorResult[];
}

const SCENARIO_COLORS = [CHART.accent, CHART.gold, CHART.crimson, CHART.blue, "#A855F7", "var(--success)"];

export default function BudgetImpactChart({ results }: Props) {
  const { t } = useTranslation("app");

  const withBudget = results.filter(
    (result) =>
      result.budget_impact_year1 !== null &&
      result.budget_impact_year3 !== null &&
      result.budget_impact_year5 !== null,
  );

  if (withBudget.length === 0) {
    return (
      <ChartCard
        title={t("heor.charts.budgetImpact.title")}
        subtitle={t("heor.charts.budgetImpact.emptySubtitle")}
      >
        <div className="h-64 flex items-center justify-center text-sm text-text-ghost">
          {t("heor.charts.budgetImpact.noData")}
        </div>
      </ChartCard>
    );
  }

  const years = [
    { year: t("heor.common.values.year1"), key: "budget_impact_year1" as const },
    { year: t("heor.common.values.year2"), key: null },
    { year: t("heor.common.values.year3"), key: "budget_impact_year3" as const },
    { year: t("heor.common.values.year4"), key: null },
    { year: t("heor.common.values.year5"), key: "budget_impact_year5" as const },
  ];

  const scenarioNames = withBudget.map(
    (result) =>
      result.scenario?.name ??
      t("heor.analysis.scenarioFallback", { id: result.scenario_id }),
  );

  const chartData = years.map((entry, yearIndex) => {
    const point: Record<string, string | number> = { year: entry.year };

    withBudget.forEach((result, scenarioIndex) => {
      const name = scenarioNames[scenarioIndex];
      if (entry.key) {
        point[name] = result[entry.key] ?? 0;
      } else if (yearIndex === 1) {
        const y1 = result.budget_impact_year1 ?? 0;
        const y3 = result.budget_impact_year3 ?? 0;
        point[name] = Math.round((y1 + y3) / 2);
      } else if (yearIndex === 3) {
        const y3 = result.budget_impact_year3 ?? 0;
        const y5 = result.budget_impact_year5 ?? 0;
        point[name] = Math.round((y3 + y5) / 2);
      }
    });

    return point;
  });

  return (
    <ChartCard
      title={t("heor.charts.budgetImpact.title")}
      subtitle={t("heor.charts.budgetImpact.subtitle", {
        scenarioCount: t("heor.common.count.scenario", { count: withBudget.length }),
      })}
    >
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={chartData} margin={{ top: 12, right: 24, bottom: 8, left: 16 }}>
          <defs>
            {scenarioNames.map((name, index) => (
              <linearGradient key={name} id={`biGrad-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SCENARIO_COLORS[index % SCENARIO_COLORS.length]} stopOpacity={0.3} />
                <stop offset="100%" stopColor={SCENARIO_COLORS[index % SCENARIO_COLORS.length]} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART.grid} vertical={false} />
          <XAxis
            dataKey="year"
            tick={{ fill: CHART.textSec, fontSize: 11 }}
            stroke={CHART.grid}
            axisLine={{ stroke: CHART.grid }}
          />
          <YAxis
            tick={{ fill: CHART.textDim, fontSize: 10 }}
            tickFormatter={(value: number) => `$${formatCompact(value)}`}
            stroke={CHART.grid}
            axisLine={{ stroke: CHART.grid }}
            width={70}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              return (
                <div className={TOOLTIP_CLS}>
                  <p className="text-xs font-semibold text-text-primary mb-1.5">{label}</p>
                  <div className="space-y-1">
                    {payload.map((entry, index) => (
                      <div key={index} className="flex items-center gap-2 text-xs">
                        <span
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: entry.color }}
                        />
                        <span className="text-text-muted flex-1">{entry.name}</span>
                        <span className="font-mono font-semibold text-text-primary">
                          ${(entry.value as number).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value: string) => (
              <span className="text-xs text-text-muted">{value}</span>
            )}
          />
          {scenarioNames.map((name, index) => (
            <Area
              key={name}
              type="monotone"
              dataKey={name}
              stroke={SCENARIO_COLORS[index % SCENARIO_COLORS.length]}
              strokeWidth={2}
              fill={`url(#biGrad-${index})`}
              dot={{
                r: 4,
                fill: SCENARIO_COLORS[index % SCENARIO_COLORS.length],
                stroke: CHART.bg,
                strokeWidth: 2,
              }}
              activeDot={{ r: 6, stroke: CHART.bg, strokeWidth: 2 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
