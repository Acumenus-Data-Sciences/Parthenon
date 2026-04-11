import { useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { DiversityTrendPoint } from "../../../api/networkAresApi";

type DimensionKey = "composite" | "gender" | "race" | "ethnicity";

interface DiversityTrendsChartProps {
  data: DiversityTrendPoint[];
  sourceName: string;
}

const DIMENSION_CONFIG: Record<DimensionKey, { label: string; color: string; dataKey: string }> = {
  composite: { label: "Composite", color: "var(--accent)", dataKey: "composite_index" },
  gender: { label: "Gender", color: "var(--success)", dataKey: "gender_index" },
  race: { label: "Race", color: "var(--primary)", dataKey: "race_index" },
  ethnicity: { label: "Ethnicity", color: "#6366F1", dataKey: "ethnicity_index" },
};

export default function DiversityTrendsChart({ data, sourceName }: DiversityTrendsChartProps) {
  const [activeDimensions, setActiveDimensions] = useState<DimensionKey[]>(["composite"]);

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-surface-highlight bg-surface-raised py-12">
        <p className="text-sm text-[#666]">No release data available for diversity trends.</p>
      </div>
    );
  }

  const toggleDimension = (dim: DimensionKey) => {
    setActiveDimensions((prev) =>
      prev.includes(dim) ? prev.filter((d) => d !== dim) : [...prev, dim],
    );
  };

  return (
    <div className="rounded-lg border border-[#252530] bg-surface-raised p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-white">Diversity Trends: {sourceName}</h3>
          <p className="mt-0.5 text-xs text-[#555]">
            Simpson's Diversity Index per release (0 = homogeneous, 1 = maximally diverse)
          </p>
        </div>
      </div>

      {/* Dimension toggles */}
      <div className="mb-4 flex gap-2">
        {(Object.entries(DIMENSION_CONFIG) as Array<[DimensionKey, typeof DIMENSION_CONFIG.composite]>).map(
          ([key, config]) => {
            const isActive = activeDimensions.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggleDimension(key)}
                className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "border border-current bg-current/10"
                    : "border border-[#252530] text-[#888] hover:text-[#ccc]"
                }`}
                style={isActive ? { color: config.color, borderColor: config.color } : undefined}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: isActive ? config.color : "#555" }}
                />
                {config.label}
              </button>
            );
          },
        )}
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 20, bottom: 30, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#252530" />
            <XAxis
              dataKey="release_name"
              tick={{ fill: "#888", fontSize: 10 }}
              angle={-30}
              textAnchor="end"
            />
            <YAxis
              domain={[0, 1]}
              tick={{ fill: "#888", fontSize: 11 }}
              tickFormatter={(v: number) => v.toFixed(2)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a22",
                border: "1px solid #333",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "#fff" }}
            />
            <Legend verticalAlign="top" height={0} />
            {activeDimensions.map((dim) => {
              const config = DIMENSION_CONFIG[dim];
              return (
                <Line
                  key={dim}
                  type="monotone"
                  dataKey={config.dataKey}
                  name={config.label}
                  stroke={config.color}
                  strokeWidth={2}
                  dot={{ fill: config.color, r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
