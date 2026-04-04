import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from "recharts";
import type { CohortDimensionProfile } from "../types/patientSimilarity";

interface CohortComparisonRadarProps {
  sourceDimensions: Record<string, CohortDimensionProfile>;
  targetDimensions: Record<string, CohortDimensionProfile>;
  sourceName: string;
  targetName: string;
}

interface RadarDataPoint {
  dimension: string;
  source: number;
  target: number;
  fullMark: number;
}

export function CohortComparisonRadar({
  sourceDimensions,
  targetDimensions,
  sourceName,
  targetName,
}: CohortComparisonRadarProps) {
  const allKeys = [
    ...new Set([
      ...Object.keys(sourceDimensions),
      ...Object.keys(targetDimensions),
    ]),
  ];

  const data: RadarDataPoint[] = allKeys.map((key) => ({
    dimension: sourceDimensions[key]?.label ?? targetDimensions[key]?.label ?? key,
    source: Math.round((sourceDimensions[key]?.coverage ?? 0) * 100),
    target: Math.round((targetDimensions[key]?.coverage ?? 0) * 100),
    fullMark: 100,
  }));

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
      <h3 className="text-sm font-semibold text-[#F0EDE8] mb-3">
        Profile Comparison
      </h3>

      <ResponsiveContainer width="100%" height={300}>
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="#323238" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: "#8A857D", fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "#5A5650", fontSize: 9 }}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Radar
            name={sourceName}
            dataKey="source"
            stroke="#2DD4BF"
            fill="#2DD4BF"
            fillOpacity={0.15}
            strokeWidth={2}
          />
          <Radar
            name={targetName}
            dataKey="target"
            stroke="#C9A227"
            fill="#C9A227"
            fillOpacity={0.1}
            strokeWidth={2}
            strokeDasharray="4 3"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1A1A1E",
              border: "1px solid #323238",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={((value: number, name: string) => [
              `${value}%`,
              name,
            ]) as never}
          />
          <Legend
            wrapperStyle={{ fontSize: "11px", color: "#8A857D" }}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
