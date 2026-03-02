import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { DemographicDistribution } from "../../types/dataExplorer";

interface GenderPieChartProps {
  data: DemographicDistribution[];
}

const GENDER_COLORS: Record<string, string> = {
  MALE: "#60A5FA",
  Male: "#60A5FA",
  male: "#60A5FA",
  FEMALE: "#E85A6B",
  Female: "#E85A6B",
  female: "#E85A6B",
};
const DEFAULT_COLOR = "#8A857D";

/** Format large numbers compactly */
function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function getColor(name: string): string {
  return GENDER_COLORS[name] ?? DEFAULT_COLOR;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: DemographicDistribution & { pct: number } }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-[#323238] bg-[#1A1A1E] px-3 py-2 shadow-lg">
      <p className="text-sm font-medium text-[#F0EDE8]">
        {item.concept_name}
      </p>
      <p className="mt-0.5 font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
        {item.count.toLocaleString()} ({item.pct.toFixed(1)}%)
      </p>
    </div>
  );
}

export function GenderPieChart({ data }: GenderPieChartProps) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-[#232328] bg-[#151518] py-16">
        <p className="text-sm text-[#8A857D]">No gender data available</p>
      </div>
    );
  }

  const total = data.reduce((s, d) => s + d.count, 0);
  const enriched = data.map((d) => ({
    ...d,
    pct: total > 0 ? (d.count / total) * 100 : 0,
  }));

  return (
    <div className="rounded-xl border border-[#232328] bg-[#151518] p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#8A857D]">
        Gender Distribution
      </h3>
      <div className="relative">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={enriched}
              dataKey="count"
              nameKey="concept_name"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              strokeWidth={0}
            >
              {enriched.map((entry, idx) => (
                <Cell
                  key={`cell-${idx}`}
                  fill={getColor(entry.concept_name)}
                />
              ))}
            </Pie>
            <Tooltip
              content={<CustomTooltip />}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Center total */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-serif text-2xl font-bold text-[#F0EDE8]">
            {formatCompact(total)}
          </span>
          <span className="text-xs text-[#8A857D]">persons</span>
        </div>
      </div>
      {/* Legend */}
      <div className="mt-3 flex items-center justify-center gap-6">
        {enriched.map((entry) => (
          <div key={entry.concept_id} className="flex items-center gap-1.5">
            <div
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: getColor(entry.concept_name) }}
            />
            <span className="text-xs text-[#C5C0B8]">
              {entry.concept_name}
            </span>
            <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#8A857D]">
              {entry.pct.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
