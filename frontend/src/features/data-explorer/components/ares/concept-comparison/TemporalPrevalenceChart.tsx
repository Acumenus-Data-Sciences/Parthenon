import { useTranslation } from "react-i18next";
import { formatNumber } from "@/i18n/format";
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

const SOURCE_COLORS = ["var(--success)", "var(--accent)", "var(--critical)", "#7c8aed", "#59c990", "#f0a8d0", "#87ceeb"];

interface TemporalPrevalenceChartProps {
  sources: TemporalPrevalenceSource[];
  title?: string;
}

export default function TemporalPrevalenceChart({ sources, title }: TemporalPrevalenceChartProps) {
  const { t } = useTranslation("app");

  if (sources.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-text-ghost">
        {t("dataExplorer.ares.conceptComparison.messages.noTemporalPrevalenceData")}
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
      {title && <h4 className="mb-2 text-xs font-medium text-text-muted">{title}</h4>}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 30, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-accent)" />
            <XAxis
              dataKey="release"
              tick={{ fill: "var(--text-muted)", fontSize: 10 }}
              axisLine={{ stroke: "var(--surface-highlight)" }}
              angle={-30}
              textAnchor="end"
            />
            <YAxis
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              axisLine={{ stroke: "var(--surface-highlight)" }}
              tickFormatter={(v: number) =>
                t("dataExplorer.ares.conceptComparison.metrics.perThousandShort", { value: formatNumber(v) })
              }
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--surface-overlay)",
                border: "1px solid #333",
                borderRadius: "8px",
                color: "var(--text-secondary)",
                fontSize: 12,
              }}
              formatter={((value: number | string) => [
                t("dataExplorer.ares.conceptComparison.metrics.perThousandLong", {
                  value: formatNumber(Number(value), { maximumFractionDigits: 2 }),
                }),
                t("dataExplorer.ares.conceptComparison.metrics.rate"),
              ]) as never}
            />
            <Legend wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }} />

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
      <p className="mt-1 text-center text-[10px] text-text-ghost">
        {t("dataExplorer.ares.conceptComparison.messages.temporalPrevalenceHelp")}
      </p>
    </div>
  );
}
