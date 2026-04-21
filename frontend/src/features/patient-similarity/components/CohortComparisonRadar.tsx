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
import type { CohortDivergence } from "../types/patientSimilarity";
import {
  buildCohortComparisonRadarModel,
} from "./CohortComparisonRadar.model";

interface CohortComparisonRadarProps {
  divergence: Record<string, CohortDivergence>;
  sourceName: string;
  targetName: string;
}

export function CohortComparisonRadar({
  divergence,
  sourceName,
  targetName,
}: CohortComparisonRadarProps) {
  const { t } = useTranslation("app");
  const { data, unavailableDimensions } = buildCohortComparisonRadarModel(divergence);

  return (
    <div className="rounded-lg border border-[var(--color-surface-overlay)] bg-[var(--color-surface-base)] p-4">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">
            {t("patientSimilarity.charts.divergenceRadar")}
          </h3>
          <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
            {sourceName} vs {targetName}
          </p>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-[var(--color-text-muted)]">
          {t("patientSimilarity.charts.similarityScale")}
        </span>
      </div>

      {data.length > 0 ? (
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
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
              name={t("patientSimilarity.charts.divergence")}
              dataKey="divergence"
              stroke="var(--color-critical)"
              fill="var(--color-critical)"
              fillOpacity={0.18}
              strokeWidth={2}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--color-surface-raised)",
                border: "1px solid var(--color-border-default)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={((value: number) => [
                `${value}%`,
                t("patientSimilarity.charts.divergence"),
              ]) as never}
            />
          </RadarChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-[300px] items-center justify-center rounded border border-dashed border-[var(--color-border-default)] bg-[var(--color-surface-base)]">
          <p className="max-w-sm text-center text-sm text-[var(--color-text-secondary)]">
            {t("patientSimilarity.charts.noComparableDimensions")}
          </p>
        </div>
      )}

      {unavailableDimensions.length > 0 && (
        <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
          {t("patientSimilarity.charts.omittedFromRadar")}{" "}
          <span className="text-[var(--color-text-primary)]">
            {unavailableDimensions.join(", ")}
          </span>
        </p>
      )}
    </div>
  );
}
