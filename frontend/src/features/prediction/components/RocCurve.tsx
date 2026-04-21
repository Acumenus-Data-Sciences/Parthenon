import { useState, useMemo, useCallback, useRef } from "react";
import { fmt } from "@/lib/formatters";
import { useTranslation } from "react-i18next";

interface RocCurveProps {
  data: { fpr: number; tpr: number }[];
  auc: number;
  validationData?: { fpr: number; tpr: number }[];
}

const ROC_WIDTH = 400;
const ROC_HEIGHT = 400;
const ROC_PADDING = { top: 30, right: 30, bottom: 50, left: 55 } as const;

export function RocCurve({ data, auc, validationData }: RocCurveProps) {
  const { t } = useTranslation("app");
  const width = ROC_WIDTH;
  const height = ROC_HEIGHT;
  const padding = ROC_PADDING;
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const svgRef = useRef<SVGSVGElement>(null);

  const toX = useCallback(
    (fpr: number) => padding.left + fpr * plotW,
    [padding.left, plotW],
  );
  const toY = useCallback(
    (tpr: number) => padding.top + (1 - tpr) * plotH,
    [padding.top, plotH],
  );

  const sortedData = useMemo(() => [...data].sort((a, b) => a.fpr - b.fpr), [data]);

  // Build path string
  const pathD = useMemo(
    () =>
      sortedData.length > 0
        ? sortedData
            .map((pt, i) =>
              i === 0
                ? `M ${toX(pt.fpr)} ${toY(pt.tpr)}`
                : `L ${toX(pt.fpr)} ${toY(pt.tpr)}`,
            )
            .join(" ")
        : "",
    [sortedData, toX, toY],
  );

  // Fill area under curve
  const fillD = useMemo(
    () =>
      sortedData.length > 0
        ? `${pathD} L ${toX(sortedData[sortedData.length - 1].fpr)} ${toY(0)} L ${toX(sortedData[0].fpr)} ${toY(0)} Z`
        : "",
    [sortedData, pathD, toX, toY],
  );

  // Validation overlay path
  const validationPathD = useMemo(() => {
    if (!validationData || validationData.length === 0) return "";
    const sorted = [...validationData].sort((a, b) => a.fpr - b.fpr);
    return sorted
      .map((pt, i) =>
        i === 0
          ? `M ${toX(pt.fpr)} ${toY(pt.tpr)}`
          : `L ${toX(pt.fpr)} ${toY(pt.tpr)}`,
      )
      .join(" ");
  }, [validationData, toX, toY]);

  // Youden's J optimal point: max(TPR - FPR)
  const youdenPoint = useMemo(() => {
    if (sortedData.length === 0) return null;
    let best = sortedData[0];
    let bestJ = best.tpr - best.fpr;
    for (const pt of sortedData) {
      const j = pt.tpr - pt.fpr;
      if (j > bestJ) {
        bestJ = j;
        best = pt;
      }
    }
    return { ...best, j: bestJ };
  }, [sortedData]);

  // Interactive hover state
  const [hoverPoint, setHoverPoint] = useState<{
    fpr: number;
    tpr: number;
    x: number;
    y: number;
    threshold: number;
  } | null>(null);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (sortedData.length === 0 || !svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Scale for viewBox vs actual size
      const scaleX = width / rect.width;
      const scaleY = height / rect.height;
      const svgX = mouseX * scaleX;
      const svgY = mouseY * scaleY;

      // Check if within plot area
      if (
        svgX < padding.left ||
        svgX > padding.left + plotW ||
        svgY < padding.top ||
        svgY > padding.top + plotH
      ) {
        setHoverPoint(null);
        return;
      }

      // Find closest point by pixel distance
      let closest = sortedData[0];
      let closestDist = Infinity;
      let closestIdx = 0;
      for (let i = 0; i < sortedData.length; i++) {
        const px = toX(sortedData[i].fpr);
        const py = toY(sortedData[i].tpr);
        const dist = Math.hypot(px - svgX, py - svgY);
        if (dist < closestDist) {
          closestDist = dist;
          closest = sortedData[i];
          closestIdx = i;
        }
      }

      // Only show tooltip if close enough
      if (closestDist > 30) {
        setHoverPoint(null);
        return;
      }

      // Approximate threshold from index position
      const approxThreshold =
        sortedData.length > 1
          ? 1 - closestIdx / (sortedData.length - 1)
          : 0.5;

      setHoverPoint({
        fpr: closest.fpr,
        tpr: closest.tpr,
        x: toX(closest.fpr),
        y: toY(closest.tpr),
        threshold: approxThreshold,
      });
    },
    [height, padding.left, padding.top, plotH, plotW, sortedData, toX, toY, width],
  );

  const handleMouseLeave = useCallback(() => setHoverPoint(null), []);

  const gridLines = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="text-text-primary"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      data-testid="roc-curve-svg"
    >
      {/* Background */}
      <rect width={width} height={height} fill="var(--surface-raised)" rx={8} />

      {/* Grid */}
      {gridLines.map((v) => (
        <g key={v}>
          <line
            x1={toX(v)}
            y1={padding.top}
            x2={toX(v)}
            y2={padding.top + plotH}
            stroke="var(--surface-elevated)"
            strokeWidth={0.5}
          />
          <line
            x1={padding.left}
            y1={toY(v)}
            x2={padding.left + plotW}
            y2={toY(v)}
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
          <text
            x={padding.left - 8}
            y={toY(v) + 3}
            textAnchor="end"
            fill="var(--text-ghost)"
            fontSize={10}
          >
            {v.toFixed(1)}
          </text>
        </g>
      ))}

      {/* Diagonal reference line (chance) */}
      <line
        x1={toX(0)}
        y1={toY(0)}
        x2={toX(1)}
        y2={toY(1)}
        stroke="var(--surface-highlight)"
        strokeWidth={1}
        strokeDasharray="6 4"
      />

      {/* Area under curve fill */}
      {fillD && <path d={fillD} fill="var(--success)" opacity={0.08} />}

      {/* Validation overlay curve (gold) */}
      {validationPathD && (
        <path
          d={validationPathD}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeDasharray="6 3"
          data-testid="roc-validation-curve"
        />
      )}

      {/* ROC Curve */}
      {pathD && (
        <path
          d={pathD}
          fill="none"
          stroke="var(--success)"
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      )}

      {/* Youden's J optimal point */}
      {youdenPoint && (
        <g data-testid="youden-j-point">
          {/* Vertical guide line from point to diagonal */}
          <line
            x1={toX(youdenPoint.fpr)}
            y1={toY(youdenPoint.tpr)}
            x2={toX(youdenPoint.fpr)}
            y2={toY(youdenPoint.fpr)}
            stroke="var(--accent)"
            strokeWidth={1}
            strokeDasharray="3 2"
            opacity={0.5}
          />
          {/* Optimal point circle */}
          <circle
            cx={toX(youdenPoint.fpr)}
            cy={toY(youdenPoint.tpr)}
            r={6}
            fill="var(--accent)"
            stroke="var(--surface-base)"
            strokeWidth={2}
          />
          {/* Annotation */}
          <text
            x={toX(youdenPoint.fpr) + 10}
            y={toY(youdenPoint.tpr) - 8}
            fill="var(--accent)"
            fontSize={9}
            fontFamily="IBM Plex Mono, monospace"
            data-testid="youden-j-label"
          >
            {t("analyses.auto.youdenJSummary_63e450", {
              j: fmt(youdenPoint.j, 2),
              sensitivity: fmt(youdenPoint.tpr, 2),
              specificity: fmt(1 - youdenPoint.fpr, 2),
            })}
          </text>
        </g>
      )}

      {/* Interactive hover cursor */}
      {hoverPoint && (
        <g data-testid="roc-hover-tooltip">
          {/* Crosshair lines */}
          <line
            x1={hoverPoint.x}
            y1={padding.top}
            x2={hoverPoint.x}
            y2={padding.top + plotH}
            stroke="var(--text-ghost)"
            strokeWidth={0.5}
            strokeDasharray="3 3"
          />
          <line
            x1={padding.left}
            y1={hoverPoint.y}
            x2={padding.left + plotW}
            y2={hoverPoint.y}
            stroke="var(--text-ghost)"
            strokeWidth={0.5}
            strokeDasharray="3 3"
          />
          {/* Point highlight */}
          <circle
            cx={hoverPoint.x}
            cy={hoverPoint.y}
            r={5}
            fill="var(--success)"
            stroke="var(--surface-base)"
            strokeWidth={2}
          />
          {/* Tooltip background */}
          <rect
            x={Math.min(hoverPoint.x + 10, padding.left + plotW - 140)}
            y={Math.max(hoverPoint.y - 50, padding.top)}
            width={130}
            height={42}
            rx={4}
            fill="var(--surface-base)"
            stroke="var(--surface-elevated)"
            strokeWidth={1}
          />
          <text
            x={Math.min(hoverPoint.x + 16, padding.left + plotW - 134)}
            y={Math.max(hoverPoint.y - 34, padding.top + 16)}
            fill="var(--text-secondary)"
            fontSize={9}
            fontFamily="IBM Plex Mono, monospace"
          >
            {t("analyses.auto.thresholdSensitivity_f9de14", {
              threshold: fmt(hoverPoint.threshold, 2),
              sensitivity: fmt(hoverPoint.tpr, 2),
            })}
          </text>
          <text
            x={Math.min(hoverPoint.x + 16, padding.left + plotW - 134)}
            y={Math.max(hoverPoint.y - 20, padding.top + 30)}
            fill="var(--text-secondary)"
            fontSize={9}
            fontFamily="IBM Plex Mono, monospace"
          >
            {t("analyses.auto.specificityFpr_6c8baf", {
              specificity: fmt(1 - hoverPoint.fpr, 2),
              fpr: fmt(hoverPoint.fpr, 2),
            })}
          </text>
        </g>
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

      {/* AUC Label */}
      <rect
        x={padding.left + plotW - 100}
        y={padding.top + plotH - 40}
        width={90}
        height={28}
        rx={4}
        fill="var(--surface-base)"
        stroke="var(--surface-elevated)"
        strokeWidth={1}
      />
      <text
        x={padding.left + plotW - 55}
        y={padding.top + plotH - 22}
        textAnchor="middle"
        fill="var(--success)"
        fontSize={12}
        fontWeight={700}
        fontFamily="IBM Plex Mono, monospace"
      >
        {t("analyses.auto.aucEquals_4305a3", { value: fmt(auc) })}
      </text>

      {/* Validation legend (if present) */}
      {validationPathD && (
        <g>
          <rect
            x={padding.left + 8}
            y={padding.top + plotH - 40}
            width={110}
            height={28}
            rx={4}
            fill="var(--surface-base)"
            stroke="var(--surface-elevated)"
            strokeWidth={1}
          />
          <line
            x1={padding.left + 16}
            y1={padding.top + plotH - 26}
            x2={padding.left + 36}
            y2={padding.top + plotH - 26}
            stroke="var(--accent)"
            strokeWidth={2}
            strokeDasharray="6 3"
          />
          <text
            x={padding.left + 42}
            y={padding.top + plotH - 22}
            fill="var(--accent)"
            fontSize={10}
          >
            {t("analyses.auto.validation_5190f3")}
          </text>
        </g>
      )}

      {/* Axis labels */}
      <text
        x={padding.left + plotW / 2}
        y={height - 8}
        textAnchor="middle"
        fill="var(--text-muted)"
        fontSize={11}
        fontWeight={600}
      >
        {t("analyses.auto.falsePositiveRate_4fe351")}
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
        {t("analyses.auto.truePositiveRate_04fb45")}
      </text>
    </svg>
  );
}
