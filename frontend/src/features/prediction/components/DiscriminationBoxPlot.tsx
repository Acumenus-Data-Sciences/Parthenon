import { useTranslation } from "react-i18next";

interface BoxPlotStats {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  mean: number;
}

interface DiscriminationBoxPlotProps {
  outcomeGroup: BoxPlotStats;
  noOutcomeGroup: BoxPlotStats;
}

export function DiscriminationBoxPlot({
  outcomeGroup,
  noOutcomeGroup,
}: DiscriminationBoxPlotProps) {
  const { t } = useTranslation("app");
  const width = 500;
  const height = 200;
  const padding = { top: 20, right: 30, bottom: 40, left: 130 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const toX = (v: number) => padding.left + v * plotW;
  const rowH = plotH / 2;

  const OUTCOME_COLOR = "var(--critical)";
  const NO_OUTCOME_COLOR = "var(--success)";

  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

  const renderBox = (stats: BoxPlotStats, y: number, color: string) => {
    const boxTop = y - 12;
    const boxBottom = y + 12;
    const boxH = boxBottom - boxTop;

    return (
      <g>
        {/* Whisker line */}
        <line
          x1={toX(stats.min)}
          y1={y}
          x2={toX(stats.max)}
          y2={y}
          stroke={color}
          strokeWidth={1}
          opacity={0.6}
        />
        {/* Whisker caps */}
        <line x1={toX(stats.min)} y1={y - 6} x2={toX(stats.min)} y2={y + 6} stroke={color} strokeWidth={1.5} />
        <line x1={toX(stats.max)} y1={y - 6} x2={toX(stats.max)} y2={y + 6} stroke={color} strokeWidth={1.5} />

        {/* Box */}
        <rect
          x={toX(stats.q1)}
          y={boxTop}
          width={toX(stats.q3) - toX(stats.q1)}
          height={boxH}
          fill={color}
          opacity={0.2}
          stroke={color}
          strokeWidth={1.5}
          rx={2}
        />

        {/* Median line */}
        <line
          x1={toX(stats.median)}
          y1={boxTop}
          x2={toX(stats.median)}
          y2={boxBottom}
          stroke={color}
          strokeWidth={2}
        />

        {/* Mean diamond */}
        <polygon
          points={`${toX(stats.mean)},${y - 5} ${toX(stats.mean) + 4},${y} ${toX(stats.mean)},${y + 5} ${toX(stats.mean) - 4},${y}`}
          fill={color}
          stroke="var(--surface-raised)"
          strokeWidth={0.5}
        />
      </g>
    );
  };

  return (
    <div className="overflow-x-auto">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="text-text-primary"
        role="img"
        aria-label={t(
          "analyses.auto.discriminationBoxPlotShowingPredictedProbabilityDistributionByOutcomeStatus_14e88d",
        )}
      >
        <rect width={width} height={height} fill="var(--surface-raised)" rx={8} />

        {/* Grid */}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={toX(v)} y1={padding.top} x2={toX(v)} y2={padding.top + plotH} stroke="var(--surface-elevated)" strokeWidth={0.5} />
            <text x={toX(v)} y={padding.top + plotH + 16} textAnchor="middle" fill="var(--text-ghost)" fontSize={10}>
              {v.toFixed(1)}
            </text>
          </g>
        ))}

        {/* Labels */}
        <text
          x={padding.left - 10}
          y={padding.top + rowH / 2 + 4}
          textAnchor="end"
          fill={OUTCOME_COLOR}
          fontSize={11}
          fontWeight={500}
        >
          {t("analyses.auto.withOutcome_907788")}
        </text>
        <text
          x={padding.left - 10}
          y={padding.top + rowH + rowH / 2 + 4}
          textAnchor="end"
          fill={NO_OUTCOME_COLOR}
          fontSize={11}
          fontWeight={500}
        >
          {t("analyses.auto.withoutOutcome_12e6b4")}
        </text>

        {/* Box plots */}
        {renderBox(outcomeGroup, padding.top + rowH / 2, OUTCOME_COLOR)}
        {renderBox(noOutcomeGroup, padding.top + rowH + rowH / 2, NO_OUTCOME_COLOR)}

        {/* Plot boundary */}
        <rect x={padding.left} y={padding.top} width={plotW} height={plotH} fill="none" stroke="var(--surface-highlight)" strokeWidth={1} />

        {/* X-axis label */}
        <text
          x={padding.left + plotW / 2}
          y={height - 6}
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize={11}
          fontWeight={600}
        >
          {t("analyses.auto.predictedProbability_81f385")}
        </text>
      </svg>
    </div>
  );
}
