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
import { ChartCard, CHART, TOOLTIP_CLS, formatCompact } from "@/features/data-explorer/components/charts/chartUtils";
import type { TornadoEntry } from "../types";

interface Props {
  tornadoData: TornadoEntry[];
  baseIcer?: number | null;
}

const TYPE_COLORS: Record<string, string> = {
  drug_cost: CHART.gold,
  admin_cost: "#E5A84B",
  hospitalization: CHART.crimson,
  er_visit: "#F472B6",
  qaly_weight: CHART.accent,
  utility_value: "#34D399",
  resource_use: CHART.blue,
  avoided_cost: "#A855F7",
  program_cost: "#94A3B8",
};

export default function TornadoDiagram({ tornadoData, baseIcer }: Props) {
  if (!tornadoData || tornadoData.length === 0) {
    return (
      <ChartCard title="Sensitivity Analysis" subtitle="Tornado diagram — ICER impact by parameter">
        <div className="h-64 flex items-center justify-center text-sm text-[#5A5650]">
          No sensitivity data available.
        </div>
      </ChartCard>
    );
  }

  // Filter to parameters with actual ICER impact, take top 10
  const top = tornadoData.filter((t) => t.range > 0 && (t.low_icer !== null || t.high_icer !== null)).slice(0, 10);

  if (top.length === 0) {
    return (
      <ChartCard title="Sensitivity Analysis" subtitle="Tornado diagram — ICER impact by parameter">
        <div className="h-64 flex items-center justify-center text-sm text-[#5A5650]">
          No parameters with measurable ICER impact.
        </div>
      </ChartCard>
    );
  }

  // Build chart data: each bar shows low_icer → high_icer range
  const chartData = top.map((t) => {
    const low = t.low_icer ?? 0;
    const high = t.high_icer ?? 0;
    return {
      name: truncateParam(t.parameter),
      fullName: t.parameter,
      type: t.type,
      low: Math.min(low, high),
      high: Math.max(low, high),
      lowIcer: t.low_icer,
      highIcer: t.high_icer,
      range: t.range,
      baseValue: t.base_value,
      lowValue: t.low_value,
      highValue: t.high_value,
    };
  });

  // Reverse so widest bar is at top
  chartData.reverse();

  return (
    <ChartCard
      title="Sensitivity Analysis"
      subtitle="Tornado diagram — ICER impact by parameter variation"
    >
      <div className="w-full" style={{ aspectRatio: "560 / 400" }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} layout="vertical" margin={{ top: 24, right: 24, bottom: 8, left: 120 }}>
          <CartesianGrid horizontal={false} stroke={CHART.grid} strokeDasharray="3 3" />
          <XAxis
            type="number"
            tick={{ fill: CHART.textDim, fontSize: 10 }}
            tickFormatter={(v: number) => `$${formatCompact(v)}`}
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
            <ReferenceLine x={baseIcer} stroke={CHART.gold} strokeDasharray="4 4" strokeWidth={1.5} label={{
              value: `Base ICER: $${formatCompact(baseIcer)}`,
              fill: CHART.gold,
              fontSize: 10,
              position: "top",
            }} />
          )}
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.[0]) return null;
              const d = payload[0].payload;
              return (
                <div className={TOOLTIP_CLS}>
                  <p className="text-xs font-semibold text-[#F0EDE8] mb-1">{d.fullName}</p>
                  <p className="text-[10px] text-[#8A857D] mb-1.5">{d.type.replace(/_/g, " ")}</p>
                  <div className="space-y-0.5 text-xs">
                    <p className="text-[#C5C0B8]">
                      Base: <span className="font-mono text-[#F59E0B]">{d.baseValue.toLocaleString()}</span>
                    </p>
                    <p className="text-[#C5C0B8]">
                      Range: {d.lowValue.toLocaleString()} → {d.highValue.toLocaleString()}
                    </p>
                    <p className="text-[#C5C0B8]">
                      Low ICER: <span className="font-mono text-[#2DD4BF]">${d.lowIcer?.toLocaleString() ?? "—"}</span>
                    </p>
                    <p className="text-[#C5C0B8]">
                      High ICER: <span className="font-mono text-[#E85A6B]">${d.highIcer?.toLocaleString() ?? "—"}</span>
                    </p>
                    <p className="text-[#C5C0B8]">
                      ICER Range: <span className="font-mono font-semibold text-[#F0EDE8]">±${formatCompact(d.range / 2)}</span>
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

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-2 px-1">
        {[...new Set(top.map((t) => t.type))].map((type) => (
          <div key={type} className="flex items-center gap-1.5 text-[10px]">
            <span
              className="w-2 h-2 rounded-sm flex-shrink-0"
              style={{ backgroundColor: TYPE_COLORS[type] ?? CHART.blue }}
            />
            <span className="text-[#8A857D] capitalize">{type.replace(/_/g, " ")}</span>
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
