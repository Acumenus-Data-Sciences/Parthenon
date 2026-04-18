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
import { useTranslation } from "react-i18next";
import { formatNumber } from "@/i18n/format";

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
  const { t } = useTranslation("app");
  const displayData = data.slice(0, 50); // Show top 50

  return (
    <div>
      <div className="mb-3 rounded-lg border border-accent/30 bg-accent/10 px-4 py-2 text-sm text-accent">
        {t("dataExplorer.ares.unmapped.pareto.topCodesCoverage", {
          percent: formatNumber(top20Coverage, { maximumFractionDigits: 1 }),
        })}
      </div>
      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={displayData} margin={{ top: 5, right: 30, bottom: 40, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--surface-accent)" />
            <XAxis
              dataKey="source_code"
              tick={{ fill: "var(--text-muted)", fontSize: 9 }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis
              yAxisId="count"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              tickFormatter={(v: number) => formatNumber(v)}
            />
            <YAxis
              yAxisId="pct"
              orientation="right"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
              tickFormatter={(v: number) =>
                t("dataExplorer.ares.unmapped.pareto.percent", {
                  value: formatNumber(v, { maximumFractionDigits: 1 }),
                })
              }
              domain={[0, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--surface-overlay)",
                border: "1px solid #333",
                borderRadius: "8px",
                color: "var(--text-secondary)",
                fontSize: 12,
              }}
            />
            <Bar
              yAxisId="count"
              dataKey="record_count"
              fill="var(--success)"
              radius={[2, 2, 0, 0]}
              name={t("dataExplorer.ares.unmapped.table.records")}
            />
            <Line
              yAxisId="pct"
              type="monotone"
              dataKey="cumulative_percent"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={false}
              name={t("dataExplorer.ares.unmapped.pareto.cumulativePercent")}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
