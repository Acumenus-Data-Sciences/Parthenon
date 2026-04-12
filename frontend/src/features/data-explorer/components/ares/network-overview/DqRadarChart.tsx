import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import type { DqRadarProfile } from "../../../types/ares";

const COLORS = ["#2DD4BF", "#C9A227", "#9B1B30", "#6366F1", "#F59E0B"];

const DIMENSION_LABELS: Record<string, string> = {
  completeness: "Completeness",
  conformance_value: "Conformance (Value)",
  conformance_relational: "Conformance (Relational)",
  plausibility_atemporal: "Plausibility (Atemporal)",
  plausibility_temporal: "Plausibility (Temporal)",
};

interface DqRadarChartProps {
  profiles: DqRadarProfile[];
  maxSources?: number;
}

export default function DqRadarChart({ profiles, maxSources = 5 }: DqRadarChartProps) {
  const displayProfiles = profiles.slice(0, maxSources);

  if (displayProfiles.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-[#555]">
        No DQ radar data available.
      </div>
    );
  }

  // Transform to recharts format: one entry per dimension, with source values as keys
  const dimensions = Object.keys(DIMENSION_LABELS);
  const radarData = dimensions.map((dim) => {
    const entry: Record<string, string | number> = {
      dimension: DIMENSION_LABELS[dim],
    };
    for (const profile of displayProfiles) {
      entry[profile.source_name] = profile.dimensions[dim as keyof typeof profile.dimensions] ?? 0;
    }
    return entry;
  });

  return (
    <div className="rounded-lg border border-[#252530] bg-[#151518] p-4">
      <h3 className="mb-3 text-sm font-medium text-text-primary">DQ Radar Profile (Kahn Dimensions)</h3>
      <p className="mb-4 text-xs text-[#555]">
        Pass rates across the five Kahn data quality dimensions. Higher values indicate better quality.
      </p>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
            <PolarGrid stroke="#333" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fill: "#888", fontSize: 11 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: "#666", fontSize: 10 }}
              tickFormatter={(v: number) => `${v}%`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a22",
                border: "1px solid #333",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#fff" }}
              formatter={((value: number) => [`${value}%`, undefined]) as never}
            />
            {displayProfiles.map((profile, idx) => (
              <Radar
                key={profile.source_id}
                name={profile.source_name}
                dataKey={profile.source_name}
                stroke={COLORS[idx % COLORS.length]}
                fill={COLORS[idx % COLORS.length]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            ))}
            <Legend
              wrapperStyle={{ fontSize: 11, color: "#888" }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
