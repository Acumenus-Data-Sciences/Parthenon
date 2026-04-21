import { useTranslation } from "react-i18next";

interface AttritionStep {
  description: string;
  subjectsCount: number;
}

interface AttritionDiagramProps {
  targetSteps: AttritionStep[];
  comparatorSteps: AttritionStep[];
  targetLabel?: string;
  comparatorLabel?: string;
}

export function AttritionDiagram({
  targetSteps,
  comparatorSteps,
  targetLabel,
  comparatorLabel,
}: AttritionDiagramProps) {
  const { t } = useTranslation("app");
  const resolvedTargetLabel =
    targetLabel ?? t("analyses.auto.targetCohort_4d7f0b");
  const resolvedComparatorLabel =
    comparatorLabel ?? t("analyses.auto.comparatorCohort_904c75");
  const maxSteps = Math.max(targetSteps.length, comparatorSteps.length);
  if (maxSteps === 0) return null;

  const boxWidth = 260;
  const boxHeight = 52;
  const arrowHeight = 40;
  const columnGap = 80;
  const excludeBoxWidth = 180;
  const sideMargin = 40;

  const totalWidth = sideMargin + excludeBoxWidth + 16 + boxWidth + columnGap + boxWidth + 16 + excludeBoxWidth + sideMargin;
  const totalHeight = 50 + maxSteps * (boxHeight + arrowHeight);

  const leftCol = sideMargin + excludeBoxWidth + 16;
  const rightCol = leftCol + boxWidth + columnGap;

  const TARGET_COLOR = "var(--success)";
  const COMPARATOR_COLOR = "var(--accent)";

  function renderColumn(
    steps: AttritionStep[],
    colX: number,
    color: string,
    label: string,
    excludeX: number,
    excludeAlign: "left" | "right",
  ) {
    return steps.map((step, i) => {
      const y = 50 + i * (boxHeight + arrowHeight);
      const excluded =
        i > 0 ? steps[i - 1].subjectsCount - step.subjectsCount : 0;

      return (
        <g key={`${label}-${i}`}>
          {/* Main box */}
          <rect
            x={colX}
            y={y}
            width={boxWidth}
            height={boxHeight}
            rx={6}
            fill="var(--surface-base)"
            stroke={color}
            strokeWidth={1.5}
          />
          <text
            x={colX + boxWidth / 2}
            y={y + 18}
            textAnchor="middle"
            fill="var(--text-secondary)"
            fontSize={10}
          >
            {step.description.length > 38
              ? step.description.substring(0, 38) + "..."
              : step.description}
          </text>
          <text
            x={colX + boxWidth / 2}
            y={y + 38}
            textAnchor="middle"
            fill={color}
            fontSize={13}
            fontWeight={700}
            fontFamily="IBM Plex Mono, monospace"
          >
            {t("analyses.auto.n_0b63b7")} {step.subjectsCount.toLocaleString()}
          </text>

          {/* Arrow down to next step */}
          {i < steps.length - 1 && (
            <g>
              <line
                x1={colX + boxWidth / 2}
                y1={y + boxHeight}
                x2={colX + boxWidth / 2}
                y2={y + boxHeight + arrowHeight}
                stroke="var(--surface-highlight)"
                strokeWidth={1.5}
              />
              <polygon
                points={`${colX + boxWidth / 2 - 4},${y + boxHeight + arrowHeight - 6} ${colX + boxWidth / 2 + 4},${y + boxHeight + arrowHeight - 6} ${colX + boxWidth / 2},${y + boxHeight + arrowHeight}`}
                fill="var(--surface-highlight)"
              />
            </g>
          )}

          {/* Exclusion box (side) */}
          {excluded > 0 && (
            <g>
              <line
                x1={
                  excludeAlign === "left"
                    ? colX
                    : colX + boxWidth
                }
                y1={y + boxHeight / 2}
                x2={excludeX + (excludeAlign === "left" ? excludeBoxWidth : 0)}
                y2={y + boxHeight / 2}
                stroke="var(--critical)"
                strokeWidth={1}
                strokeDasharray="4 3"
              />
              <rect
                x={excludeX}
                y={y + boxHeight / 2 - 18}
                width={excludeBoxWidth}
                height={36}
                rx={4}
                fill="#E85A6B10"
                stroke="var(--critical)"
                strokeWidth={0.8}
              />
              <text
                x={excludeX + excludeBoxWidth / 2}
                y={y + boxHeight / 2 - 3}
                textAnchor="middle"
                fill="var(--critical)"
                fontSize={9}
              >
                {t("analyses.auto.excluded_122180")}
              </text>
              <text
                x={excludeX + excludeBoxWidth / 2}
                y={y + boxHeight / 2 + 12}
                textAnchor="middle"
                fill="var(--critical)"
                fontSize={11}
                fontWeight={600}
                fontFamily="IBM Plex Mono, monospace"
              >
                -{excluded.toLocaleString()}
              </text>
            </g>
          )}
        </g>
      );
    });
  }

  return (
    <div className="overflow-x-auto">
      <svg
        width={totalWidth}
        height={totalHeight}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className="text-text-primary"
        role="img"
        aria-label={t("analyses.auto.attritionDiagramShowingPatientFlow_7b43fb")}
      >
        <rect
          width={totalWidth}
          height={totalHeight}
          fill="var(--surface-raised)"
          rx={8}
        />

        {/* Column headers */}
        <text
          x={leftCol + boxWidth / 2}
          y={28}
          textAnchor="middle"
          fill={TARGET_COLOR}
          fontSize={12}
          fontWeight={700}
        >
          {resolvedTargetLabel}
        </text>
        <text
          x={rightCol + boxWidth / 2}
          y={28}
          textAnchor="middle"
          fill={COMPARATOR_COLOR}
          fontSize={12}
          fontWeight={700}
        >
          {resolvedComparatorLabel}
        </text>

        {/* Target column */}
        {renderColumn(
          targetSteps,
          leftCol,
          TARGET_COLOR,
          "target",
          sideMargin,
          "left",
        )}

        {/* Comparator column */}
        {renderColumn(
          comparatorSteps,
          rightCol,
          COMPARATOR_COLOR,
          "comparator",
          rightCol + boxWidth + 16,
          "right",
        )}
      </svg>
    </div>
  );
}
