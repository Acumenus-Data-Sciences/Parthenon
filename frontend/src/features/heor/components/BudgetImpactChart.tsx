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
import { ChartCard, CHART, TOOLTIP_CLS, formatCompact } from "@/features/data-explorer/components/charts/chartUtils";
import type { HeorResult } from "../types";

interface Props {
  results: HeorResult[];
}

const SCENARIO_COLORS = [CHART.accent, CHART.gold, CHART.crimson, CHART.blue, "#A855F7", "#34D399"];

export default function BudgetImpactChart({ results }: Props) {
  // Filter results that have budget impact data
  const withBudget = results.filter(
    (r) => r.budget_impact_year1 !== null && r.budget_impact_year3 !== null && r.budget_impact_year5 !== null,
  );

  if (withBudget.length === 0) {
    return (
      <ChartCard title="Budget Impact Trajectory" subtitle="Projected budget impact over time">
        <div className="h-64 flex items-center justify-center text-sm text-text-ghost">
          No budget impact data available.
        </div>
      </ChartCard>
    );
  }

  // Build year-by-year data points for each scenario
  // Interpolate Year 2 and Year 4 linearly between known points
  const years = [
    { year: "Year 1", key: "budget_impact_year1" as const },
    { year: "Year 2", key: null },
    { year: "Year 3", key: "budget_impact_year3" as const },
    { year: "Year 4", key: null },
    { year: "Year 5", key: "budget_impact_year5" as const },
  ];

  const scenarioNames = withBudget.map(
    (r) => r.scenario?.name ?? `Scenario ${r.scenario_id}`,
  );

  const chartData = years.map((y, yi) => {
    const point: Record<string, string | number> = { year: y.year };

    withBudget.forEach((r, si) => {
      const name = scenarioNames[si];
      if (y.key) {
        point[name] = r[y.key] ?? 0;
      } else {
        // Linear interpolation
        if (yi === 1) {
          // Year 2 = midpoint of Year 1 and Year 3
          const y1 = r.budget_impact_year1 ?? 0;
          const y3 = r.budget_impact_year3 ?? 0;
          point[name] = Math.round((y1 + y3) / 2);
        } else if (yi === 3) {
          // Year 4 = midpoint of Year 3 and Year 5
          const y3 = r.budget_impact_year3 ?? 0;
          const y5 = r.budget_impact_year5 ?? 0;
          point[name] = Math.round((y3 + y5) / 2);
        }
      }
    });

    return point;
  });

  return (
    <ChartCard
      title="Budget Impact Trajectory"
      subtitle={`${withBudget.length} scenario${withBudget.length > 1 ? "s" : ""} — projected 5-year budget impact`}
    >
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={chartData} margin={{ top: 12, right: 24, bottom: 8, left: 16 }}>
          <defs>
            {scenarioNames.map((name, i) => (
              <linearGradient key={name} id={`biGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SCENARIO_COLORS[i % SCENARIO_COLORS.length]} stopOpacity={0.3} />
                <stop offset="100%" stopColor={SCENARIO_COLORS[i % SCENARIO_COLORS.length]} stopOpacity={0.02} />
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
            tickFormatter={(v: number) => `$${formatCompact(v)}`}
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
                    {payload.map((entry, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
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
          {scenarioNames.map((name, i) => (
            <Area
              key={name}
              type="monotone"
              dataKey={name}
              stroke={SCENARIO_COLORS[i % SCENARIO_COLORS.length]}
              strokeWidth={2}
              fill={`url(#biGrad-${i})`}
              dot={{ r: 4, fill: SCENARIO_COLORS[i % SCENARIO_COLORS.length], stroke: CHART.bg, strokeWidth: 2 }}
              activeDot={{ r: 6, stroke: CHART.bg, strokeWidth: 2 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
