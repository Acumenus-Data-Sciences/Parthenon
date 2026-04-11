import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import { formatCompact, formatYearMonth, CHART, TOOLTIP_CLS } from "./chartUtils";

interface DualAreaChartProps {
  primary: { year_month: string; count: number }[];
  secondary: { year_month: string; count: number }[];
  primaryLabel?: string;
  secondaryLabel?: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className={TOOLTIP_CLS}>
      <p className="text-xs text-text-muted">
        {label ? formatYearMonth(label) : ""}
      </p>
      {payload.map((p, i) => (
        <p
          key={i}
          className="mt-0.5 font-['IBM_Plex_Mono',monospace] text-xs"
          style={{ color: p.color }}
        >
          {p.name}: {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

export function DualAreaChart({
  primary,
  secondary,
  primaryLabel = "Observation Start",
  secondaryLabel = "Observation End",
}: DualAreaChartProps) {
  if (!primary.length && !secondary.length) return null;

  // Merge both series into a single dataset keyed by year_month
  const map = new Map<string, { year_month: string; start: number; end: number }>();
  for (const p of primary) {
    const entry = map.get(p.year_month) ?? { year_month: p.year_month, start: 0, end: 0 };
    entry.start = p.count;
    map.set(p.year_month, entry);
  }
  for (const s of secondary) {
    const entry = map.get(s.year_month) ?? { year_month: s.year_month, start: 0, end: 0 };
    entry.end = s.count;
    map.set(s.year_month, entry);
  }

  const merged = Array.from(map.values()).sort((a, b) =>
    a.year_month.localeCompare(b.year_month),
  );

  const tickInterval = Math.max(1, Math.floor(merged.length / 12));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart
        data={merged}
        margin={{ top: 8, right: 20, bottom: 0, left: 0 }}
      >
        <defs>
          <linearGradient id="startFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART.accent} stopOpacity={0.25} />
            <stop offset="95%" stopColor={CHART.accent} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="endFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CHART.gold} stopOpacity={0.25} />
            <stop offset="95%" stopColor={CHART.gold} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={CHART.grid}
          vertical={false}
        />
        <XAxis
          dataKey="year_month"
          tickFormatter={formatYearMonth}
          interval={tickInterval}
          tick={{ fill: CHART.text, fontSize: 10 }}
          axisLine={{ stroke: CHART.grid }}
          tickLine={{ stroke: CHART.grid }}
        />
        <YAxis
          tickFormatter={formatCompact}
          tick={{ fill: CHART.text, fontSize: 11 }}
          axisLine={false}
          tickLine={false}
          width={55}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
          iconType="circle"
          iconSize={8}
        />
        <Area
          type="monotone"
          dataKey="start"
          name={primaryLabel}
          stroke={CHART.accent}
          strokeWidth={1.5}
          fill="url(#startFill)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="end"
          name={secondaryLabel}
          stroke={CHART.gold}
          strokeWidth={1.5}
          fill="url(#endFill)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
