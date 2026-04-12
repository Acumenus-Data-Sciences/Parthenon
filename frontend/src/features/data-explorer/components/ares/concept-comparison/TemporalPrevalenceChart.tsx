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
import type { TemporalPrevalenceSource } from "../../../types/ares";

const SOURCE_COLORS = ["#2DD4BF", "#C9A227", "#e85d75", "#7c8aed", "#59c990", "#f0a8d0", "#87ceeb"];

interface TemporalPrevalenceChartProps {
  sources: TemporalPrevalenceSource[];
  title?: string;
}

export default function TemporalPrevalenceChart({ sources, title }: TemporalPrevalenceChartProps) {
  if (sources.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-[#555]">
        No temporal prevalence data available.
      </div>
    );
  }

  // Merge all sources onto a unified timeline keyed by release_name
  const timelineMap = new Map<string, Record<string, unknown>>();

  for (const source of sources) {
    for (const point of source.trend) {
      const key = point.release_name;
      const existing = timelineMap.get(key) ?? { release: key };
      existing[`source_${source.source_id}`] = point.rate_per_1000;
      timelineMap.set(key, existing);
    }
  }

  const chartData = Array.from(timelineMap.values());

  return (
    <div>
      {title && <h4 className="mb-2 text-xs font-medium text-[#888]">{title}</h4>}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#252530" />
            <XAxis
              dataKey="release"
              tick={{ fill: "#888", fontSize: 10 }}
              axisLine={{ stroke: "#333" }}
              angle={-30}
              textAnchor="end"
            />
            <YAxis
              tick={{ fill: "#888", fontSize: 11 }}
              axisLine={{ stroke: "#333" }}
              tickFormatter={(v: number) => `${v}/1k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a22",
                border: "1px solid #333",
                borderRadius: "8px",
                color: "#ccc",
                fontSize: 12,
              }}
              /* eslint-disable @typescript-eslint/no-explicit-any */
              formatter={((value: number | string) => [
                `${Number(value).toFixed(2)} per 1,000`,
                "Rate",
              ]) as any}
              /* eslint-enable @typescript-eslint/no-explicit-any */
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "#888" }} />

            {sources.map((source, i) => (
              <Line
                key={source.source_id}
                type="monotone"
                dataKey={`source_${source.source_id}`}
                name={source.source_name}
                stroke={SOURCE_COLORS[i % SOURCE_COLORS.length]}
                strokeWidth={2}
                dot={{ fill: SOURCE_COLORS[i % SOURCE_COLORS.length], r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-1 text-center text-[10px] text-[#555]">
        Prevalence rate per 1,000 across releases by source.
      </p>
    </div>
  );
}
