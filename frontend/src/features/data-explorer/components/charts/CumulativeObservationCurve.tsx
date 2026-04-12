import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  ReferenceLine,
} from "recharts";
import type { BoxPlotData } from "../../types/dataExplorer";
import { formatCompact, CHART, TOOLTIP_CLS } from "./chartUtils";

interface CumulativeObservationCurveProps {
  distribution: BoxPlotData;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { days: number; pct: number; label: string } }>;
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className={TOOLTIP_CLS}>
      <p className="text-xs text-text-muted">{d.label}</p>
      <p className="font-['IBM_Plex_Mono',monospace] text-xs text-text-primary">
        {formatCompact(d.days)} days — {d.pct}% of persons
      </p>
    </div>
  );
}

export function CumulativeObservationCurve({
  distribution,
}: CumulativeObservationCurveProps) {
  const { min, p10, p25, median, p75, p90, max } = distribution;

  // Build KM-style data: at each percentile threshold, what % of the population
  // has observation duration >= that value
  const data = [
    { days: min, pct: 100, label: "Min" },
    { days: p10, pct: 90, label: "P10" },
    { days: p25, pct: 75, label: "P25" },
    { days: median, pct: 50, label: "Median" },
    { days: p75, pct: 25, label: "P75" },
    { days: p90, pct: 10, label: "P90" },
    { days: max, pct: 0, label: "Max" },
  ];

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart
        data={data}
        margin={{ top: 8, right: 20, bottom: 0, left: 0 }}
      >
        <defs>
          <linearGradient id="cumObsFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART.accent} stopOpacity={0.3} />
            <stop offset="95%" stopColor={CHART.accent} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={CHART.grid}
          vertical={false}
        />
        <XAxis
          dataKey="days"
          type="number"
          tickFormatter={(v: number) => formatCompact(v)}
          tick={{ fill: CHART.text, fontSize: 10 }}
          axisLine={{ stroke: CHART.grid }}
          tickLine={{ stroke: CHART.grid }}
          label={{
            value: "Observation Duration (days)",
            position: "insideBottom",
            offset: -4,
            fill: CHART.textMuted,
            fontSize: 10,
          }}
        />
        <YAxis
          tickFormatter={(v: number) => `${v}%`}
          domain={[0, 100]}
          tick={{ fill: CHART.text, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={45}
        />
        <Tooltip content={<CustomTooltip />} />
        <ReferenceLine
          y={50}
          stroke={CHART.gold}
          strokeDasharray="4 4"
          strokeOpacity={0.5}
        />
        <Area
          type="stepAfter"
          dataKey="pct"
          stroke={CHART.accent}
          strokeWidth={2}
          fill="url(#cumObsFill)"
          dot={{
            r: 4,
            fill: CHART.accent,
            stroke: CHART.bg,
            strokeWidth: 2,
          }}
          activeDot={{
            r: 6,
            fill: CHART.accent,
            stroke: CHART.bg,
            strokeWidth: 2,
          }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
