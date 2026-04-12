import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { ArrivalForecast } from "../../../types/ares";

interface ArrivalForecastChartProps {
  forecast: ArrivalForecast;
  targetCount?: number;
}

export default function ArrivalForecastChart({
  forecast,
  targetCount,
}: ArrivalForecastChartProps) {
  if (forecast.historical.length === 0 && forecast.projected.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-text-ghost">
        Insufficient historical data for forecast (minimum 6 months required).
      </div>
    );
  }

  // Build unified chart data
  const chartData = [
    ...forecast.historical.map((h) => ({
      month: h.month,
      historical: h.patient_count,
      projected: null as number | null,
      lower: null as number | null,
      upper: null as number | null,
    })),
    ...forecast.projected.map((p) => ({
      month: p.month,
      historical: null as number | null,
      projected: p.projected_count,
      lower: p.lower_bound,
      upper: p.upper_bound,
    })),
  ];

  // Bridge: connect last historical point to first projected point
  if (forecast.historical.length > 0 && forecast.projected.length > 0) {
    const lastHistorical = forecast.historical[forecast.historical.length - 1];
    const bridgeIndex = forecast.historical.length;
    if (chartData[bridgeIndex]) {
      chartData[bridgeIndex - 1] = {
        ...chartData[bridgeIndex - 1],
        projected: lastHistorical.patient_count,
      };
    }
  }

  const effectiveTarget = targetCount ?? null;

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-white">
            Patient Arrival Forecast: {forecast.source_name}
          </h4>
          <p className="text-[11px] text-text-ghost">
            Monthly rate: {forecast.monthly_rate > 0 ? `+${forecast.monthly_rate}` : forecast.monthly_rate} patients/month
            {forecast.months_to_target !== null && forecast.months_to_target > 0 && (
              <span className="ml-2 text-accent">
                Target reached in ~{forecast.months_to_target} months
              </span>
            )}
            {forecast.months_to_target === 0 && (
              <span className="ml-2 text-success">Target already reached</span>
            )}
          </p>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={chartData}
            margin={{ top: 5, right: 20, bottom: 30, left: 20 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#252530" />
            <XAxis
              dataKey="month"
              tick={{ fill: "#888", fontSize: 10 }}
              axisLine={{ stroke: "#333" }}
              angle={-45}
              textAnchor="end"
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "#888", fontSize: 11 }}
              axisLine={{ stroke: "#333" }}
              tickFormatter={(v: number) => v.toLocaleString()}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--surface-overlay)',
                border: "1px solid #333",
                borderRadius: "8px",
                color: "#ccc",
                fontSize: 12,
              }}
              formatter={((value: number | null, name: string) => {
                if (value === null) return ["-", name];
                const label =
                  name === "historical"
                    ? "Actual"
                    : name === "projected"
                      ? "Projected"
                      : name;
                return [value.toLocaleString(), label];
              }) as never}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "#888" }}
              formatter={(value: string) => {
                if (value === "historical") return "Actual";
                if (value === "projected") return "Projected";
                if (value === "confidenceBand") return "95% CI";
                return value;
              }}
            />

            {/* Confidence band */}
            <Area
              dataKey="upper"
              stroke="none"
              fill="var(--accent)"
              fillOpacity={0.1}
              name="confidenceBand"
              connectNulls={false}
            />
            <Area
              dataKey="lower"
              stroke="none"
              fill="var(--surface-raised)"
              fillOpacity={1}
              legendType="none"
              connectNulls={false}
            />

            {/* Historical line (solid) */}
            <Line
              dataKey="historical"
              type="monotone"
              stroke="var(--success)"
              strokeWidth={2}
              dot={{ fill: "var(--success)", r: 2 }}
              connectNulls={false}
              name="historical"
            />

            {/* Projected line (dashed) */}
            <Line
              dataKey="projected"
              type="monotone"
              stroke="var(--accent)"
              strokeWidth={2}
              strokeDasharray="6 3"
              dot={false}
              connectNulls={false}
              name="projected"
            />

            {/* Target reference line */}
            {effectiveTarget !== null && effectiveTarget > 0 && (
              <ReferenceLine
                y={effectiveTarget}
                stroke="#e85d75"
                strokeDasharray="4 4"
                label={{
                  value: `Target: ${effectiveTarget.toLocaleString()}`,
                  fill: "#e85d75",
                  fontSize: 11,
                  position: "insideTopRight",
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-[10px] text-text-ghost">
        Projection based on linear regression of last 12 months. Confidence band widens with projection distance.
      </p>
    </div>
  );
}
