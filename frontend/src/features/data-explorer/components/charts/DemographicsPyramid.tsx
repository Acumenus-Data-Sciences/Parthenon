import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from "recharts";
import { useTranslation } from "react-i18next";
import type {
  DemographicDistribution,
  AgeDistribution,
} from "../../types/dataExplorer";
import { formatNumber } from "@/i18n/format";

type DemographicsPyramidLabels = {
  title: string;
  noData: string;
  age: string;
  male: string;
  female: string;
};

interface DemographicsPyramidProps {
  gender: DemographicDistribution[];
  age: AgeDistribution[];
  height?: number;
  labels?: DemographicsPyramidLabels;
}

function CustomTooltip({
  active,
  payload,
  labels,
}: {
  active?: boolean;
  payload?: Array<{
    payload: { age_decile: string; male: number; female: number };
  }>;
  labels: DemographicsPyramidLabels;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-lg border border-surface-highlight bg-surface-overlay px-3 py-2 shadow-lg">
      <p className="text-sm font-medium text-text-primary">
        {labels.age} {item.age_decile}
      </p>
      <div className="mt-1 space-y-0.5">
        <p className="font-['IBM_Plex_Mono',monospace] text-xs text-info">
          {labels.male}: {formatNumber(Math.abs(item.male))}
        </p>
        <p className="font-['IBM_Plex_Mono',monospace] text-xs text-critical">
          {labels.female}: {formatNumber(item.female)}
        </p>
      </div>
    </div>
  );
}

export function DemographicsPyramid({
  age,
  height = 320,
  labels,
}: DemographicsPyramidProps) {
  const { t } = useTranslation("app");
  const resolvedLabels: DemographicsPyramidLabels = labels ?? {
    title: t("dataExplorer.charts.demographics.ageDistribution"),
    noData: t("dataExplorer.charts.demographics.noAgeData"),
    age: t("dataExplorer.charts.demographics.age"),
    male: t("dataExplorer.charts.demographics.male"),
    female: t("dataExplorer.charts.demographics.female"),
  };

  if (!age.length) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border-default bg-surface-raised py-16">
        <p className="text-sm text-text-muted">{resolvedLabels.noData}</p>
      </div>
    );
  }

  // Build pyramid data: male counts negative (left), female positive (right)
  // Backend provides real male/female counts per age decile from analysis 10
  const pyramidData = age
    .map((a) => ({
      age_decile: a.age_decile,
      male: -(a.male ?? 0),
      female: a.female ?? 0,
      total: (a.male ?? 0) + (a.female ?? 0),
    }))
    .filter((d) => d.total > 0);

  if (pyramidData.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-border-default bg-surface-raised py-16">
        <p className="text-sm text-text-muted">{resolvedLabels.noData}</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface-raised p-6">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-text-muted">
        {resolvedLabels.title}
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={pyramidData}
          layout="vertical"
          margin={{ top: 0, right: 30, bottom: 0, left: 0 }}
          stackOffset="sign"
          barCategoryGap="15%"
        >
          <XAxis
            type="number"
            tickFormatter={(value) =>
              formatNumber(Math.abs(Number(value)), {
                notation: "compact",
                maximumFractionDigits: 1,
              })
            }
            tick={{ fill: "var(--text-primary)", fontSize: 11 }}
            axisLine={{ stroke: "var(--surface-highlight)" }}
            tickLine={{ stroke: "var(--surface-highlight)" }}
          />
          <YAxis
            type="category"
            dataKey="age_decile"
            width={60}
            tick={{ fill: "var(--text-secondary)", fontSize: 12 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            content={<CustomTooltip labels={resolvedLabels} />}
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
          />
          <ReferenceLine x={0} stroke="var(--surface-highlight)" strokeWidth={1} />
          <Bar dataKey="male" stackId="stack" maxBarSize={22} radius={[4, 0, 0, 4]}>
            {pyramidData.map((_, idx) => (
              <Cell key={`male-${idx}`} fill="var(--info)" />
            ))}
          </Bar>
          <Bar dataKey="female" stackId="stack" maxBarSize={22} radius={[0, 4, 4, 0]}>
            {pyramidData.map((_, idx) => (
              <Cell key={`female-${idx}`} fill="var(--critical)" />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-3 flex items-center justify-center gap-6">
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-info" />
          <span className="text-xs text-text-secondary">{resolvedLabels.male}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-2.5 w-2.5 rounded-sm bg-critical" />
          <span className="text-xs text-text-secondary">{resolvedLabels.female}</span>
        </div>
      </div>
    </div>
  );
}
