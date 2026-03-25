import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ErrorBar,
  ResponsiveContainer,
} from "recharts";
import type { ConceptComparison } from "../../../types/ares";

interface ComparisonChartProps {
  data: ConceptComparison[];
  metric: "count" | "rate_per_1000";
}

export default function ComparisonChart({ data, metric }: ComparisonChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-[#555]">
        No comparison data available.
      </div>
    );
  }

  const chartData = data.map((d) => {
    const value = metric === "count" ? d.count : d.rate_per_1000;
    // Error bar uses [errorLow, errorHigh] tuple relative to the value
    const error: [number, number] =
      metric === "rate_per_1000" && d.ci_lower !== undefined && d.ci_upper !== undefined
        ? [value - d.ci_lower, d.ci_upper - value]
        : [0, 0];
    return { source: d.source_name, value, error };
  });

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 5, right: 20, bottom: 30, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#252530" />
          <XAxis
            dataKey="source"
            tick={{ fill: "#888", fontSize: 11 }}
            axisLine={{ stroke: "#333" }}
            angle={-30}
            textAnchor="end"
          />
          <YAxis
            tick={{ fill: "#888", fontSize: 11 }}
            axisLine={{ stroke: "#333" }}
            tickFormatter={(v: number) =>
              metric === "rate_per_1000" ? `${v}/1k` : v.toLocaleString()
            }
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
              metric === "rate_per_1000"
                ? `${Number(value).toFixed(2)} per 1,000`
                : Number(value).toLocaleString(),
              metric === "rate_per_1000" ? "Rate" : "Count",
            ]) as any}
            /* eslint-enable @typescript-eslint/no-explicit-any */
          />
          <Bar dataKey="value" fill="#C9A227" radius={[4, 4, 0, 0]}>
            {metric === "rate_per_1000" && (
              <ErrorBar dataKey="error" width={4} stroke="#888" strokeWidth={1} />
            )}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
