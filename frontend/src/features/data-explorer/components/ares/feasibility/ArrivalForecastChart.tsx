import { useTranslation } from "react-i18next";
import { formatNumber } from "@/i18n/format";
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
  const { t } = useTranslation("app");

  if (forecast.historical.length === 0 && forecast.projected.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-text-ghost">
        {t("dataExplorer.ares.feasibility.forecast.insufficientData")}
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
          <h4 className="text-sm font-medium text-text-primary">
            {t("dataExplorer.ares.feasibility.forecast.title", {
              source: forecast.source_name,
            })}
          </h4>
          <p className="text-[11px] text-text-ghost">
            {t("dataExplorer.ares.feasibility.forecast.monthlyRate", {
              rate: `${forecast.monthly_rate > 0 ? "+" : ""}${formatNumber(forecast.monthly_rate)}`,
            })}
            {forecast.months_to_target !== null && forecast.months_to_target > 0 && (
              <span className="ml-2 text-accent">
                {t("dataExplorer.ares.feasibility.forecast.targetReachedIn", {
                  months: formatNumber(forecast.months_to_target),
                })}
              </span>
            )}
            {forecast.months_to_target === 0 && (
              <span className="ml-2 text-success">
                {t("dataExplorer.ares.feasibility.forecast.targetAlreadyReached")}
              </span>
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
            <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-accent)" />
            <XAxis
              dataKey="month"
              tick={{ fill: "var(--text-muted)", fontSize: 10 }}
              axisLine={{ stroke: "var(--surface-highlight)" }}
              angle={-45}
              textAnchor="end"
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--surface-highlight)" }}
              tickFormatter={(v: number) => formatNumber(v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--surface-overlay)",
                border: "1px solid #333",
                borderRadius: "8px",
                color: "var(--text-secondary)",
                fontSize: 12,
              }}
              formatter={((value: number | null, name: string) => {
                if (value === null) return ["-", name];
                const label =
                  name === "historical"
                    ? t("dataExplorer.ares.feasibility.forecast.actual")
                    : name === "projected"
                      ? t("dataExplorer.ares.feasibility.forecast.projected")
                      : name;
                return [formatNumber(value), label];
              }) as never}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }}
              formatter={(value: string) => {
                if (value === "historical") return t("dataExplorer.ares.feasibility.forecast.actual");
                if (value === "projected") return t("dataExplorer.ares.feasibility.forecast.projected");
                if (value === "confidenceBand") return t("dataExplorer.ares.feasibility.forecast.confidenceBand");
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
                stroke="var(--critical)"
                strokeDasharray="4 4"
                label={{
                  value: t("dataExplorer.ares.feasibility.forecast.targetLabel", {
                    target: formatNumber(effectiveTarget),
                  }),
                  fill: "var(--critical)",
                  fontSize: 11,
                  position: "insideTopRight",
                }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-2 text-[10px] text-text-ghost">
        {t("dataExplorer.ares.feasibility.forecast.footnote")}
      </p>
    </div>
  );
}
