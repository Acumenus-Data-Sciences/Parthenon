import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import type {
  DemographicDistribution,
  AgeDistribution,
} from "../../types/dataExplorer";

interface DemographicsPyramidProps {
  gender: DemographicDistribution[];
  age: AgeDistribution[];
  height?: number;
}

/** Format large numbers compactly */
function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(abs / 1_000).toFixed(1)}K`;
  return abs.toLocaleString();
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload: { age_decile: string; male: number; female: number };
  }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-[#323238] bg-[#1A1A1E] px-3 py-2 shadow-lg">
      <p className="text-sm font-medium text-[#F0EDE8]">
        Age {item.age_decile}
      </p>
      <div className="mt-1 space-y-0.5">
        <p className="font-['IBM_Plex_Mono',monospace] text-xs text-[#60A5FA]">
          Male: {Math.abs(item.male).toLocaleString()}
        </p>
        <p className="font-['IBM_Plex_Mono',monospace] text-xs text-[#E85A6B]">
          Female: {item.female.toLocaleString()}
        </p>
      </div>
    </div>
  );
}

export function DemographicsPyramid({
  age,
  height = 320,
}: DemographicsPyramidProps) {
  if (!age.length) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-[#232328] bg-[#151518] py-16">
        <p className="text-sm text-[#8A857D]">No age distribution data</p>
      </div>
    );
  }

  // Build pyramid data: male counts negative (left), female positive (right)
  // Backend provides real male/female counts per age decile from analysis 10
  const pyramidData = age
    .map((a) => ({
      age_decile: a.age_decile,
      male: -(a.male ?? 0),
      female: a.female ?? 0,
      total: (a.male ?? 0) + (a.female ?? 0),
    }))
    .filter((d) => d.total > 0);

  if (pyramidData.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-[#232328] bg-[#151518] py-16">
        <p className="text-sm text-[#8A857D]">No age distribution data</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#232328] bg-[#151518] p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-[#8A857D]">
        Age Distribution
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={pyramidData}
          layout="vertical"
          margin={{ top: 0, right: 30, bottom: 0, left: 0 }}
          stackOffset="sign"
          barCategoryGap="15%"
        >
          <XAxis
            type="number"
            tickFormatter={formatCompact}
            tick={{ fill: "#F0EDE8", fontSize: 11 }}
            axisLine={{ stroke: "#323238" }}
            tickLine={{ stroke: "#323238" }}
          />
          <YAxis
            type="category"
            dataKey="age_decile"
            width={60}
            tick={{ fill: "#C5C0B8", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
          />
          <ReferenceLine x={0} stroke="#323238" strokeWidth={1} />
          <Bar dataKey="male" stackId="stack" maxBarSize={22} radius={[4, 0, 0, 4]}>
            {pyramidData.map((_, idx) => (
              <Cell key={`male-${idx}`} fill="#60A5FA" />
            ))}
          </Bar>
          <Bar dataKey="female" stackId="stack" maxBarSize={22} radius={[0, 4, 4, 0]}>
            {pyramidData.map((_, idx) => (
              <Cell key={`female-${idx}`} fill="#E85A6B" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex items-center justify-center gap-6">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-[#60A5FA]" />
          <span className="text-xs text-[#C5C0B8]">Male</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-[#E85A6B]" />
          <span className="text-xs text-[#C5C0B8]">Female</span>
        </div>
      </div>
    </div>
  );
}
