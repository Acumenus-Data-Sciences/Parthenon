import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

export interface DomainCount {
  name: string;
  count: number;
  color: string;
}

interface SchemaDensityHeatmapProps {
  domains: DomainCount[];
}

const DOMAIN_COLORS: Record<string, string> = {
  Condition: "#9B1B30",
  Drug: "#2DD4BF",
  Measurement: "#C9A227",
  Procedure: "#60a5fa",
  Observation: "#a78bfa",
  Device: "#71717a",
};

export function buildDomainCounts(
  entries: Array<{ concept: { domain_id: string } }>,
): DomainCount[] {
  const counts: Record<string, number> = {};
  for (const entry of entries) {
    const d = entry.concept.domain_id || "Unknown";
    counts[d] = (counts[d] ?? 0) + 1;
  }
  return Object.entries(counts)
    .map(([name, count]) => ({
      name,
      count,
      color: DOMAIN_COLORS[name] ?? "#52525b",
    }))
    .sort((a, b) => b.count - a.count);
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs shadow-lg">
      <span className="text-zinc-300 font-medium">{label}</span>
      <span className="ml-2 text-zinc-400">
        {payload[0].value} concept{payload[0].value !== 1 ? "s" : ""}
      </span>
    </div>
  );
}

export function SchemaDensityHeatmap({ domains }: SchemaDensityHeatmapProps) {
  if (domains.length === 0) {
    return (
      <div className="flex items-center justify-center rounded border border-zinc-700/40 bg-zinc-800/20 px-4 py-5">
        <p className="text-xs text-zinc-600">
          Add concepts to see domain coverage
        </p>
      </div>
    );
  }

  // Dynamic height: at least 80px, 36px per bar
  const chartHeight = Math.max(80, domains.length * 36);

  return (
    <div className="rounded border border-zinc-700/40 bg-zinc-800/20 px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
          Domain Coverage
        </span>
        <span className="text-[10px] text-zinc-600">
          {domains.reduce((s, d) => s + d.count, 0)} total
        </span>
      </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={domains}
          layout="vertical"
          margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
        >
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "#71717a" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={88}
            tick={{ fontSize: 10, fill: "#a1a1aa" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar dataKey="count" radius={[0, 3, 3, 0]} maxBarSize={20}>
            {domains.map((entry) => (
              <Cell key={entry.name} fill={entry.color} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
