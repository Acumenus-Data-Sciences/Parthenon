import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useTranslation } from "react-i18next";
import type { CohortProfileResult } from "../types/patientSimilarity";

interface CohortCentroidRadarProps {
  profile: CohortProfileResult;
}

interface RadarDataPoint {
  dimension: string;
  coverage: number;
  richness: number;
  fullMark: number;
}

export function CohortCentroidRadar({ profile }: CohortCentroidRadarProps) {
  const { t } = useTranslation("app");
  const dims = profile.dimensions;

  const data: RadarDataPoint[] = Object.entries(dims).map(([, dim]) => ({
    dimension: dim.label,
    coverage: Math.round(dim.coverage * 100),
    richness: Math.min(100, Math.round(
      (dim.unique_concepts ?? dim.unique_measurements ?? dim.unique_genes ?? 0) /
        Math.max(profile.member_count, 1) * 100,
    )),
    fullMark: 100,
  }));

  return (
    <div className="rounded-lg border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
          {t("patientSimilarity.charts.cohortCentroidProfile")}
        </h3>
        <span className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
          {t("patientSimilarity.charts.members", {
            count: profile.member_count,
          })}
        </span>
      </div>

      <ResponsiveContainer width="100%" height={260}>
        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
          <PolarGrid stroke="var(--color-border-default)" />
          <PolarAngleAxis
            dataKey="dimension"
            tick={{ fill: "var(--color-text-secondary)", fontSize: 11 }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fill: "var(--color-text-muted)", fontSize: 9 }}
            tickFormatter={(v: number) => `${v}%`}
          />
          <Radar
            name={t("patientSimilarity.charts.coverageWithData")}
            dataKey="coverage"
            stroke="var(--color-primary)"
            fill="var(--color-primary)"
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Radar
            name={t("patientSimilarity.charts.diversityPerMember")}
            dataKey="richness"
            stroke="var(--color-primary)"
            fill="var(--color-primary)"
            fillOpacity={0.1}
            strokeWidth={1.5}
            strokeDasharray="4 3"
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface-raised)",
              border: "1px solid var(--color-border-default)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={((value: number, name: string) => [
              `${value}%`,
              name,
            ]) as never}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-1">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-[var(--color-primary)] rounded" />
          <span className="text-[10px] text-[var(--color-text-secondary)]">
            {t("patientSimilarity.charts.coverageWithData")}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-0.5 bg-[var(--color-primary)] rounded border-dashed" />
          <span className="text-[10px] text-[var(--color-text-secondary)]">
            {t("patientSimilarity.charts.diversityPerMember")}
          </span>
        </div>
      </div>

      {/* Dimension details */}
      <div className="mt-3 grid grid-cols-3 gap-2">
        {Object.entries(dims).map(([key, dim]) => (
          <div
            key={key}
            className="rounded bg-[var(--color-surface-base)] px-2 py-1.5 text-center"
          >
            <div className="text-[10px] text-[var(--color-text-muted)] uppercase tracking-wider">
              {dim.label}
            </div>
            <div className="text-xs font-medium text-[var(--color-text-primary)]">
              {Math.round(dim.coverage * 100)}%
            </div>
            {(dim.unique_concepts ?? dim.unique_measurements ?? dim.unique_genes) !== undefined && (
              <div className="text-[10px] text-[var(--color-text-muted)]">
                {t("patientSimilarity.charts.unique", {
                  count:
                    dim.unique_concepts ??
                    dim.unique_measurements ??
                    dim.unique_genes,
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
