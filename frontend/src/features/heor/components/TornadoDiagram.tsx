import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { useTranslation } from "react-i18next";
import { ChartCard, CHART, TOOLTIP_CLS, formatCompact } from "@/features/data-explorer/components/charts/chartUtils";
import type { TornadoEntry } from "../types";
import { getHeorParameterTypeLabel } from "../lib/i18n";

interface Props {
  tornadoData: TornadoEntry[];
  baseIcer?: number | null;
}

const TYPE_COLORS: Record<string, string> = {
  drug_cost: CHART.gold,
  admin_cost: "var(--warning)",
  hospitalization: CHART.crimson,
  er_visit: "var(--domain-procedure)",
  qaly_weight: CHART.accent,
  utility_value: "var(--success)",
  resource_use: CHART.blue,
  avoided_cost: "#A855F7",
  program_cost: "var(--text-muted)",
};

export default function TornadoDiagram({ tornadoData, baseIcer }: Props) {
  const { t } = useTranslation("app");

  if (!tornadoData || tornadoData.length === 0) {
    return (
      <ChartCard
        title={t("heor.charts.tornado.title")}
        subtitle={t("heor.charts.tornado.emptySubtitle")}
      >
        <div className="h-64 flex items-center justify-center text-sm text-text-ghost">
          {t("heor.charts.tornado.noData")}
        </div>
      </ChartCard>
    );
  }

  const top = tornadoData
    .filter((entry) => entry.range > 0 && (entry.low_icer !== null || entry.high_icer !== null))
    .slice(0, 10);

  if (top.length === 0) {
    return (
      <ChartCard
        title={t("heor.charts.tornado.title")}
        subtitle={t("heor.charts.tornado.emptySubtitle")}
      >
        <div className="h-64 flex items-center justify-center text-sm text-text-ghost">
          {t("heor.charts.tornado.noImpact")}
        </div>
      </ChartCard>
    );
  }

  const chartData = top.map((entry) => {
    const low = entry.low_icer ?? 0;
    const high = entry.high_icer ?? 0;
    return {
      name: truncateParam(entry.parameter),
      fullName: entry.parameter,
      type: entry.type,
      low: Math.min(low, high),
      high: Math.max(low, high),
      lowIcer: entry.low_icer,
      highIcer: entry.high_icer,
      range: entry.range,
      baseValue: entry.base_value,
      lowValue: entry.low_value,
      highValue: entry.high_value,
    };
  });

  chartData.reverse();

  return (
    <ChartCard
      title={t("heor.charts.tornado.title")}
      subtitle={t("heor.charts.tornado.subtitle")}
    >
      <div className="w-full" style={{ aspectRatio: "560 / 400" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} layout="vertical" margin={{ top: 24, right: 24, bottom: 8, left: 120 }}>
            <CartesianGrid horizontal={false} stroke={CHART.grid} strokeDasharray="3 3" />
            <XAxis
              type="number"
              tick={{ fill: CHART.textDim, fontSize: 10 }}
              tickFormatter={(value: number) => `$${formatCompact(value)}`}
              stroke={CHART.grid}
              axisLine={{ stroke: CHART.grid }}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fill: CHART.textSec, fontSize: 10 }}
              width={115}
              stroke="transparent"
            />
            {baseIcer != null && (
              <ReferenceLine
                x={baseIcer}
                stroke={CHART.gold}
                strokeDasharray="4 4"
                strokeWidth={1.5}
                label={{
                  value: t("heor.charts.tornado.baseIcer", {
                    value: formatCompact(baseIcer),
                  }),
                  fill: CHART.gold,
                  fontSize: 10,
                  position: "top",
                }}
              />
            )}
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const datum = payload[0].payload;
                return (
                  <div className={TOOLTIP_CLS}>
                    <p className="text-xs font-semibold text-text-primary mb-1">{datum.fullName}</p>
                    <p className="text-[10px] text-text-muted mb-1.5">
                      {getHeorParameterTypeLabel(t, datum.type)}
                    </p>
                    <div className="space-y-0.5 text-xs">
                      <p className="text-text-secondary">
                        {t("heor.charts.tornado.base")}{" "}
                        <span className="font-mono text-warning">{datum.baseValue.toLocaleString()}</span>
                      </p>
                      <p className="text-text-secondary">
                        {t("heor.charts.tornado.range")} {datum.lowValue.toLocaleString()} →{" "}
                        {datum.highValue.toLocaleString()}
                      </p>
                      <p className="text-text-secondary">
                        {t("heor.charts.tornado.lowIcer")}{" "}
                        <span className="font-mono text-success">
                          ${datum.lowIcer?.toLocaleString() ?? "—"}
                        </span>
                      </p>
                      <p className="text-text-secondary">
                        {t("heor.charts.tornado.highIcer")}{" "}
                        <span className="font-mono text-critical">
                          ${datum.highIcer?.toLocaleString() ?? "—"}
                        </span>
                      </p>
                      <p className="text-text-secondary">
                        {t("heor.charts.tornado.icerRange")}{" "}
                        <span className="font-mono font-semibold text-text-primary">
                          ±${formatCompact(datum.range / 2)}
                        </span>
                      </p>
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="low" stackId="range" fill="transparent" isAnimationActive={false} />
            <Bar dataKey="high" stackId="range" radius={[0, 4, 4, 0]} isAnimationActive={false}>
              {chartData.map((entry, index) => (
                <Cell key={index} fill={TYPE_COLORS[entry.type] ?? CHART.blue} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-3 mt-2 px-1">
        {[...new Set(top.map((entry) => entry.type))].map((type) => (
          <div key={type} className="flex items-center gap-1.5 text-[10px]">
            <span
              className="w-2 h-2 rounded-sm flex-shrink-0"
              style={{ backgroundColor: TYPE_COLORS[type] ?? CHART.blue }}
            />
            <span className="text-text-muted">{getHeorParameterTypeLabel(t, type)}</span>
          </div>
        ))}
      </div>
    </ChartCard>
  );
}

function truncateParam(name: string): string {
  if (name.length <= 20) return name;
  return name.slice(0, 18) + "…";
}
