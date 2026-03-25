import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { DqTrendPoint } from "../../../types/ares";

interface DqTrendChartProps {
  data: DqTrendPoint[];
  onReleaseClick?: (releaseId: number) => void;
}

export default function DqTrendChart({ data, onReleaseClick }: DqTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-[#555]">
        No DQ history data available. Run DQD on at least two releases to see trends.
      </div>
    );
  }

  const chartData = data.map((d) => ({
    ...d,
    label: d.release_name,
  }));

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          onClick={(e) => {
            const event = e as Record<string, unknown>;
            const activePayload = event?.activePayload as Array<{ payload: Record<string, unknown> }> | undefined;
            if (activePayload?.[0]?.payload && onReleaseClick) {
              onReleaseClick(activePayload[0].payload.release_id as number);
            }
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#252530" />
          <XAxis
            dataKey="label"
            tick={{ fill: "#888", fontSize: 11 }}
            axisLine={{ stroke: "#333" }}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: "#888", fontSize: 11 }}
            axisLine={{ stroke: "#333" }}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a1a22",
              border: "1px solid #333",
              borderRadius: "8px",
              color: "#ccc",
              fontSize: 12,
            }}
            formatter={(value: number | string) => [`${Number(value).toFixed(1)}%`, "Pass Rate"]}
          />
          <ReferenceLine y={80} stroke="#C9A227" strokeDasharray="5 5" />
          <Line
            type="monotone"
            dataKey="pass_rate"
            stroke="#2DD4BF"
            strokeWidth={2}
            dot={{ fill: "#2DD4BF", r: 5, cursor: "pointer" }}
            activeDot={{ r: 7, fill: "#2DD4BF" }}
          />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-1 text-center text-[10px] text-[#555]">
        Click a release point to view delta details. Dashed line = 80% quality threshold.
      </p>
    </div>
  );
}
