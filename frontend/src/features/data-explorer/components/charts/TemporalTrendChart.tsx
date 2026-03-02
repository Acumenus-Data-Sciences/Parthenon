import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface TemporalTrendChartProps {
  data: { year_month: string; count: number }[];
  title?: string;
  secondarySeries?: { year_month: string; count: number }[];
  secondaryLabel?: string;
}

/** Format year_month "2020-01" to "Jan 2020" */
function formatMonth(ym: string): string {
  const [year, month] = ym.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

/** Format large numbers compactly */
function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
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
    <div className="rounded-lg border border-[#323238] bg-[#1A1A1E] px-3 py-2 shadow-lg">
      <p className="text-xs text-[#8A857D]">{label ? formatMonth(label) : ""}</p>
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
      <div className="flex items-center justify-center rounded-xl border border-[#232328] bg-[#151518] py-16">
        <p className="text-sm text-[#8A857D]">No temporal data available</p>
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
    <div className="rounded-xl border border-[#232328] bg-[#151518] p-6">
      {title && (
        <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#8A857D]">
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
            stroke="#323238"
            vertical={false}
          />
          <XAxis
            dataKey="year_month"
            tickFormatter={formatMonth}
            interval={tickInterval}
            tick={{ fill: "#F0EDE8", fontSize: 10 }}
            axisLine={{ stroke: "#323238" }}
            tickLine={{ stroke: "#323238" }}
          />
          <YAxis
            tickFormatter={formatCompact}
            tick={{ fill: "#F0EDE8", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={60}
          />
          <Tooltip content={<CustomTooltip />} />
          <Line
            type="monotone"
            dataKey="count"
            name="Events"
            stroke="#2DD4BF"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, fill: "#2DD4BF", stroke: "#151518", strokeWidth: 2 }}
          />
          {secondarySeries && (
            <Line
              type="monotone"
              dataKey="secondary"
              name={secondaryLabel ?? "Secondary"}
              stroke="#C9A227"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#C9A227", stroke: "#151518", strokeWidth: 2 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
