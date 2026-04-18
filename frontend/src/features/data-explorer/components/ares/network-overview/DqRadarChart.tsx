import { useTranslation } from "react-i18next";
import { formatNumber } from "@/i18n/format";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from "recharts";
import type { DqRadarProfile } from "../../../types/ares";

const COLORS = ["var(--success)", "var(--accent)", "var(--primary)", "var(--domain-observation)", "var(--warning)"];

const DIMENSION_LABEL_KEYS: Record<string, string> = {
  completeness: "completeness",
  conformance_value: "conformanceValue",
  conformance_relational: "conformanceRelational",
  plausibility_atemporal: "plausibilityAtemporal",
  plausibility_temporal: "plausibilityTemporal",
};

interface DqRadarChartProps {
  profiles: DqRadarProfile[];
  maxSources?: number;
}

export default function DqRadarChart({ profiles, maxSources = 5 }: DqRadarChartProps) {
  const { t } = useTranslation("app");
  const displayProfiles = profiles.slice(0, maxSources);

  if (displayProfiles.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-text-ghost">
        {t("dataExplorer.ares.networkOverview.radar.noData")}
      </div>
    );
  }

  // Transform to recharts format: one entry per dimension, with source values as keys
  const dimensions = Object.keys(DIMENSION_LABEL_KEYS);
  const radarData = dimensions.map((dim) => {
    const entry: Record<string, string | number> = {
      dimension: t(`dataExplorer.ares.networkOverview.radar.dimensions.${DIMENSION_LABEL_KEYS[dim]}`),
    };
    for (const profile of displayProfiles) {
      entry[profile.source_name] = profile.dimensions[dim as keyof typeof profile.dimensions] ?? 0;
    }
    return entry;
  });

  return (
    <div className="rounded-lg border border-border-subtle bg-surface-raised p-4">
      <h3 className="mb-3 text-sm font-medium text-text-primary">
        {t("dataExplorer.ares.networkOverview.radar.title")}
      </h3>
      <p className="mb-4 text-xs text-text-ghost">
        {t("dataExplorer.ares.networkOverview.radar.description")}
      </p>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
            <PolarGrid stroke="var(--surface-highlight)" />
            <PolarAngleAxis
              dataKey="dimension"
              tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: "var(--text-ghost)", fontSize: 10 }}
              tickFormatter={(v: number) => t("dataExplorer.ares.networkOverview.percent", { value: formatNumber(v) })}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--surface-overlay)",
                border: "1px solid #333",
                borderRadius: "8px",
              }}
              labelStyle={{ color: "var(--text-primary)" }}
              formatter={((value: number) => [
                t("dataExplorer.ares.networkOverview.percent", { value: formatNumber(value) }),
                undefined,
              ]) as never}
            />
            {displayProfiles.map((profile, idx) => (
              <Radar
                key={profile.source_id}
                name={profile.source_name}
                dataKey={profile.source_name}
                stroke={COLORS[idx % COLORS.length]}
                fill={COLORS[idx % COLORS.length]}
                fillOpacity={0.15}
                strokeWidth={2}
              />
            ))}
            <Legend
              wrapperStyle={{ fontSize: 11, color: "var(--text-muted)" }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
