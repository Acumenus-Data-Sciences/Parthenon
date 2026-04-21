import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useTranslation } from "react-i18next";

export interface CohortSizeComparisonProps {
  cohorts: Array<{ id: number; name: string; count: number }>;
  primaryId: number | null;
}

function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

function truncate(s: string, max = 32): string {
  return s.length > max ? s.slice(0, max - 1) + "\u2026" : s;
}

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { id: number; name: string; count: number } }>;
}) {
  const { t } = useTranslation("app");
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="max-w-xs rounded-lg border border-surface-highlight bg-surface-overlay px-3 py-2 shadow-lg">
      <p className="text-sm font-medium text-text-primary">{item.name}</p>
      <p className="font-['IBM_Plex_Mono',monospace] text-xs text-success">
        {t("investigation.common.counts.subject", {
          count: item.count,
        })}
      </p>
    </div>
  );
}

export function CohortSizeComparison({
  cohorts,
  primaryId,
}: CohortSizeComparisonProps) {
  const { t } = useTranslation("app");
  if (cohorts.length === 0) return null;

  const chartData = cohorts.map((c) => ({
    ...c,
    displayName: truncate(c.name),
  }));

  const barHeight = 32;
  const chartHeight = Math.max(chartData.length * barHeight + 40, 120);

  return (
    <div className="rounded-xl border border-border-default bg-surface-raised p-4">
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-muted">
        {t("investigation.phenotype.cohortSizeComparison.title")}
      </h4>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 0, right: 48, bottom: 0, left: 0 }}
          barCategoryGap="20%"
        >
          <XAxis
            type="number"
            tickFormatter={formatCompact}
            tick={{ fill: "var(--text-primary)", fontSize: 10 }}
            axisLine={{ stroke: "var(--surface-highlight)" }}
            tickLine={{ stroke: "var(--surface-highlight)" }}
          />
          <YAxis
            type="category"
            dataKey="displayName"
            width={180}
            tick={{ fill: "var(--text-primary)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "color-mix(in srgb, var(--accent) 8%, transparent)" }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {chartData.map((entry) => (
              <Cell
                key={`cell-${entry.id}`}
                fill={entry.id === primaryId ? "var(--accent)" : "var(--success)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      {primaryId != null && (
        <p className="mt-1 text-[10px] text-text-muted">
          <span className="inline-block w-2.5 h-2.5 rounded-sm bg-accent mr-1 align-middle" />
          {t("investigation.phenotype.cohortSizeComparison.primaryLegend")}
        </p>
      )}
    </div>
  );
}
