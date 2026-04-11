import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { formatYearMonth, formatCompact } from "./chartUtils";

interface TemporalTrendChartProps {
  data: { year_month: string; count: number }[];
  title?: string;
  secondarySeries?: { year_month: string; count: number }[];
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
    <div className="rounded-lg border border-surface-highlight bg-surface-overlay px-3 py-2 shadow-lg">
      <p className="text-xs text-text-muted">{label ? formatYearMonth(label) : ""}</p>
      {payload.map((p, idx) => (
        <p
          key={idx}
          className="mt-0.5 font-['IBM_Plex_Mono',monospace] text-xs"
          style={{ color: p.color }}
        >
          {p.name}: {p.value.toLocaleString()}
        </p>
      ))}
    </div>
  );
}

export function TemporalTrendChart({
  data,
  title,
  secondarySeries,
  secondaryLabel,
}: TemporalTrendChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border-default bg-surface-raised py-16">
        <p className="text-sm text-text-muted">No temporal data available</p>
      </div>
    );
  }

  // Merge secondary series if provided
  let merged = data.map((d) => ({ ...d }));
  if (secondarySeries) {
    const secMap = new Map(secondarySeries.map((s) => [s.year_month, s.count]));
    merged = merged.map((d) => ({
      ...d,
      secondary: secMap.get(d.year_month) ?? 0,
    }));
  }

  // Thin out x-axis ticks for readability
  const tickInterval = Math.max(1, Math.floor(merged.length / 12));

  return (
    <div className="rounded-xl border border-border-default bg-surface-raised p-6">
      {title && (
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
          {title}
        </h3>
      )}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={merged}
          margin={{ top: 8, right: 20, bottom: 0, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--border-default)"
            vertical={false}
          />
          <XAxis
            dataKey="year_month"
            tickFormatter={formatYearMonth}
            interval={tickInterval}
            tick={{ fill: "var(--text-primary)", fontSize: 10 }}
            axisLine={{ stroke: "var(--border-default)" }}
            tickLine={{ stroke: "var(--border-default)" }}
          />
          <YAxis
            tickFormatter={formatCompact}
            tick={{ fill: "var(--text-primary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="count"
            name="Events"
            stroke="var(--success)"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "var(--success)", stroke: "var(--surface-raised)", strokeWidth: 2 }}
          />
          {secondarySeries && (
            <Line
              type="monotone"
              dataKey="secondary"
              name={secondaryLabel ?? "Secondary"}
              stroke="var(--accent)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "var(--accent)", stroke: "var(--surface-raised)", strokeWidth: 2 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
