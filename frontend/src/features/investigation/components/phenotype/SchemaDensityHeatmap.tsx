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
import type { DomainCount } from "./schemaDensity";

interface SchemaDensityHeatmapProps {
  domains: DomainCount[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  const { t } = useTranslation("app");
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div className="rounded border border-border-default bg-surface-base px-2.5 py-1.5 text-xs shadow-lg">
      <span className="text-text-secondary font-medium">{label}</span>
      <span className="ml-2 text-text-muted">
        {t("investigation.phenotype.schemaDensity.tooltip", {
          count: payload[0].value,
        })}
      </span>
    </div>
  );
}

export function SchemaDensityHeatmap({ domains }: SchemaDensityHeatmapProps) {
  const { t } = useTranslation("app");
  if (domains.length === 0) {
    return (
      <div className="flex items-center justify-center rounded border border-border-default/40 bg-surface-raised/20 px-4 py-5">
        <p className="text-xs text-text-ghost">
          {t("investigation.phenotype.schemaDensity.addConcepts")}
        </p>
      </div>
    );
  }

  // Dynamic height: at least 80px, 36px per bar
  const chartHeight = Math.max(80, domains.length * 36);

  return (
    <div className="rounded border border-border-default/40 bg-surface-raised/20 px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-ghost">
          {t("investigation.phenotype.schemaDensity.domainCoverage")}
        </span>
        <span className="text-[10px] text-text-ghost">
          {t("investigation.phenotype.schemaDensity.total", {
            count: domains.reduce((s, d) => s + d.count, 0),
          })}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart
          data={domains}
          layout="vertical"
          margin={{ top: 0, right: 12, bottom: 0, left: 0 }}
        >
          <XAxis
            type="number"
            tick={{ fontSize: 10, fill: "var(--text-muted)" }}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            width={88}
            tick={{ fontSize: 10, fill: "var(--text-secondary)" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: "color-mix(in srgb, var(--surface-overlay) 45%, transparent)" }}
          />
          <Bar dataKey="count" radius={[0, 3, 3, 0]} maxBarSize={20}>
            {domains.map((entry) => (
              <Cell key={entry.name} fill={entry.color} fillOpacity={0.8} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
