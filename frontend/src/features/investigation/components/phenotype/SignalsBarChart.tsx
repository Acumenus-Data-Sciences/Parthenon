import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface SignalsBarChartProps {
  signals: Array<{ label: string; count: number }>;
  maxSignals?: number;
  onSignalClick?: (label: string) => void;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function truncate(s: string, max = 40): string {
  return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { label: string; count: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="max-w-xs rounded-lg border border-border-default bg-surface-base px-3 py-2 shadow-lg">
      <p className="text-sm font-medium text-text-primary">{item.label}</p>
      <p className="mt-0.5 font-mono text-xs text-success">
        {item.count.toLocaleString()} occurrences
      </p>
    </div>
  );
}

export function SignalsBarChart({
  signals,
  maxSignals = 20,
  onSignalClick,
}: SignalsBarChartProps) {
  if (!signals.length) return null;

  const sorted = [...signals]
    .sort((a, b) => b.count - a.count)
    .slice(0, maxSignals);

  const chartData = sorted.map((s) => ({
    ...s,
    displayLabel: truncate(s.label),
  }));

  const barHeight = 28;
  const chartHeight = Math.max(chartData.length * barHeight + 40, 120);

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 0, right: 48, bottom: 0, left: 0 }}
        barCategoryGap="20%"
      >
        <XAxis
          type="number"
          tickFormatter={formatCompact}
          tick={{ fill: "#d4d4d8", fontSize: 10 }}
          axisLine={{ stroke: "#52525b" }}
          tickLine={{ stroke: "#52525b" }}
        />
        <YAxis
          type="category"
          dataKey="displayLabel"
          width={200}
          tick={{ fill: "#d4d4d8", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: "rgba(45,212,191,0.06)" }}
        />
        <Bar
          dataKey="count"
          fill="var(--success)"
          radius={[0, 4, 4, 0]}
          maxBarSize={20}
          onClick={(_data, _idx, e) => {
            if (!onSignalClick) return;
            const entry = (e as unknown as { payload: { label: string } })
              ?.payload;
            if (entry) onSignalClick(entry.label);
          }}
          style={{ cursor: onSignalClick ? "pointer" : "default" }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
