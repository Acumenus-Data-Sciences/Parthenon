import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface ParetoItem {
  source_code: string;
  record_count: number;
  cumulative_percent: number;
}

interface ParetoChartProps {
  data: ParetoItem[];
  top20Coverage: number;
}

export default function ParetoChart({ data, top20Coverage }: ParetoChartProps) {
  const displayData = data.slice(0, 50); // Show top 50

  return (
    <div>
      <div className="mb-3 rounded-lg border border-[#C9A227]/30 bg-[#C9A227]/10 px-4 py-2 text-sm text-[#C9A227]">
        Top 20 codes cover {top20Coverage.toFixed(1)}% of all unmapped records
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={displayData} margin={{ top: 5, right: 30, bottom: 40, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#252530" />
            <XAxis
              dataKey="source_code"
              tick={{ fill: "#888", fontSize: 9 }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              yAxisId="count"
              tick={{ fill: "#888", fontSize: 11 }}
              tickFormatter={(v: number) => v.toLocaleString()}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              tick={{ fill: "#888", fontSize: 11 }}
              tickFormatter={(v: number) => `${v}%`}
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "#1a1a22",
                border: "1px solid #333",
                borderRadius: "8px",
                color: "#ccc",
                fontSize: 12,
              }}
            />
            <Bar
              yAxisId="count"
              dataKey="record_count"
              fill="#2DD4BF"
              radius={[2, 2, 0, 0]}
              name="Records"
            />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="cumulative_percent"
              stroke="#C9A227"
              strokeWidth={2}
              dot={false}
              name="Cumulative %"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
