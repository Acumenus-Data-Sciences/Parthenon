import { fmt } from "@/lib/formatters";
import { useTranslation } from "react-i18next";

interface PSDistributionPoint {
  score: number;
  targetCount: number;
  comparatorCount: number;
}

interface PropensityScorePlotProps {
  data: PSDistributionPoint[];
  auc?: number;
  targetLabel?: string;
  comparatorLabel?: string;
}

export function PropensityScorePlot({
  data,
  auc,
  targetLabel,
  comparatorLabel,
}: PropensityScorePlotProps) {
  const { t } = useTranslation("app");
  const resolvedTargetLabel =
    targetLabel ?? t("analyses.auto.targetCohort_4d7f0b");
  const resolvedComparatorLabel =
    comparatorLabel ?? t("analyses.auto.comparatorCohort_904c75");
  if (data.length === 0) return null;

  const width = 600;
  const height = 320;
  const padding = { top: 30, right: 30, bottom: 50, left: 55 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const TARGET_COLOR = "var(--success)";
  const COMPARATOR_COLOR = "var(--accent)";

  // Normalize to density (proportions)
  const totalTarget = data.reduce((s, d) => s + d.targetCount, 0) || 1;
  const totalComparator = data.reduce((s, d) => s + d.comparatorCount, 0) || 1;

  const maxDensity = Math.max(
    ...data.map((d) => d.targetCount / totalTarget),
    ...data.map((d) => d.comparatorCount / totalComparator),
  );

  const toX = (score: number) => padding.left + score * plotW;
  const toY = (density: number) =>
    padding.top + plotH - (density / (maxDensity * 1.1)) * plotH;

  // Build area paths
  function buildAreaPath(
    getValue: (d: PSDistributionPoint) => number,
    total: number,
  ): string {
    const sorted = [...data].sort((a, b) => a.score - b.score);
    if (sorted.length === 0) return "";
    let path = `M ${toX(sorted[0].score)} ${toY(getValue(sorted[0]) / total)}`;
    for (let i = 1; i < sorted.length; i++) {
      path += ` L ${toX(sorted[i].score)} ${toY(getValue(sorted[i]) / total)}`;
    }
    // Close to baseline
    path += ` L ${toX(sorted[sorted.length - 1].score)} ${toY(0)}`;
    path += ` L ${toX(sorted[0].score)} ${toY(0)} Z`;
    return path;
  }

  function buildLinePath(
    getValue: (d: PSDistributionPoint) => number,
    total: number,
  ): string {
    const sorted = [...data].sort((a, b) => a.score - b.score);
    if (sorted.length === 0) return "";
    let path = `M ${toX(sorted[0].score)} ${toY(getValue(sorted[0]) / total)}`;
    for (let i = 1; i < sorted.length; i++) {
      path += ` L ${toX(sorted[i].score)} ${toY(getValue(sorted[i]) / total)}`;
    }
    return path;
  }

  const targetArea = buildAreaPath((d) => d.targetCount, totalTarget);
  const comparatorArea = buildAreaPath(
    (d) => d.comparatorCount,
    totalComparator,
  );
  const targetLine = buildLinePath((d) => d.targetCount, totalTarget);
  const comparatorLine = buildLinePath(
    (d) => d.comparatorCount,
    totalComparator,
  );

  const xTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <div className="overflow-x-auto">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="text-text-primary"
        role="img"
        aria-label={t("analyses.auto.propensityScoreDistribution_f5ab12")}
      >
        <rect width={width} height={height} fill="var(--surface-raised)" rx={8} />

        {/* Grid */}
        {xTicks.map((v) => (
          <g key={v}>
            <line
              x1={toX(v)}
              y1={padding.top}
              x2={toX(v)}
              y2={padding.top + plotH}
              stroke="var(--surface-elevated)"
              strokeWidth={0.5}
            />
            <text
              x={toX(v)}
              y={padding.top + plotH + 16}
              textAnchor="middle"
              fill="var(--text-ghost)"
              fontSize={10}
            >
              {v.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Area fills */}
        {targetArea && (
          <path d={targetArea} fill={TARGET_COLOR} opacity={0.15} />
        )}
        {comparatorArea && (
          <path d={comparatorArea} fill={COMPARATOR_COLOR} opacity={0.15} />
        )}

        {/* Lines */}
        {targetLine && (
          <path
            d={targetLine}
            fill="none"
            stroke={TARGET_COLOR}
            strokeWidth={2}
          />
        )}
        {comparatorLine && (
          <path
            d={comparatorLine}
            fill="none"
            stroke={COMPARATOR_COLOR}
            strokeWidth={2}
          />
        )}

        {/* Plot boundary */}
        <rect
          x={padding.left}
          y={padding.top}
          width={plotW}
          height={plotH}
          fill="none"
          stroke="var(--surface-highlight)"
          strokeWidth={1}
        />

        {/* Legend */}
        <g
          transform={`translate(${padding.left + plotW - 170}, ${padding.top + 8})`}
        >
          <rect
            x={0}
            y={0}
            width={160}
            height={auc !== undefined ? 56 : 42}
            rx={4}
            fill="var(--surface-base)"
            stroke="var(--surface-elevated)"
            strokeWidth={1}
          />
          <line
            x1={8}
            y1={14}
            x2={28}
            y2={14}
            stroke={TARGET_COLOR}
            strokeWidth={2.5}
          />
          <text x={34} y={18} fill="var(--text-secondary)" fontSize={11}>
            {resolvedTargetLabel}
          </text>
          <line
            x1={8}
            y1={32}
            x2={28}
            y2={32}
            stroke={COMPARATOR_COLOR}
            strokeWidth={2.5}
          />
          <text x={34} y={36} fill="var(--text-secondary)" fontSize={11}>
            {resolvedComparatorLabel}
          </text>
          {auc !== undefined && (
            <text
              x={8}
              y={52}
              fill="var(--text-muted)"
              fontSize={10}
              fontFamily="IBM Plex Mono, monospace"
            >
              {t("analyses.auto.pSAUC_0092fa")} {fmt(auc)}
            </text>
          )}
        </g>

        {/* Axis labels */}
        <text
          x={padding.left + plotW / 2}
          y={height - 8}
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize={11}
          fontWeight={600}
        >
          {t("analyses.auto.propensityScore_1cf048")}
        </text>
        <text
          x={14}
          y={padding.top + plotH / 2}
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize={11}
          fontWeight={600}
          transform={`rotate(-90 14 ${padding.top + plotH / 2})`}
        >
          {t("analyses.auto.density_7e6d11")}
        </text>
      </svg>
    </div>
  );
}
