import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { CohortDivergence } from "../types/patientSimilarity";
import {
  buildCohortComparisonRadarModel,
} from "./CohortComparisonRadar.model";

interface CohortComparisonRadarProps {
  divergence: Record<string, CohortDivergence>;
  sourceName: string;
  targetName: string;
}

export function CohortComparisonRadar({
  divergence,
  sourceName,
  targetName,
}: CohortComparisonRadarProps) {
  const { data, unavailableDimensions } = buildCohortComparisonRadarModel(divergence);

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] p-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[#F0EDE8]">
            Divergence Radar
          </h3>
          <p className="mt-1 text-xs text-[#8A857D]">
            {sourceName} vs {targetName}
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-[#5A5650]">
          0% similar • 100% divergent
        </span>
      </div>

      {data.length > 0 ? (
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
              name="Divergence"
              dataKey="divergence"
              stroke="#E85A6B"
              fill="#E85A6B"
              fillOpacity={0.18}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1A1A1E",
                border: "1px solid #323238",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={((value: number) => [
                `${value}%`,
                "Divergence",
              ]) as never}
            />
          </RadarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[300px] items-center justify-center rounded border border-dashed border-[#323238] bg-[#0E0E11]">
          <p className="max-w-sm text-center text-sm text-[#8A857D]">
            No comparable dimensions are available for these cohorts.
          </p>
        </div>
      )}

      {unavailableDimensions.length > 0 && (
        <p className="mt-3 text-xs text-[#8A857D]">
          Omitted from radar due to unavailable data:{" "}
          <span className="text-[#C5C0B8]">
            {unavailableDimensions.join(", ")}
          </span>
        </p>
      )}
    </div>
  );
}
