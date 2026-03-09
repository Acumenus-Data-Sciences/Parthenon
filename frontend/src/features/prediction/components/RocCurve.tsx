import { useState, useMemo, useCallback, useRef } from "react";
import { fmt } from "@/lib/formatters";

interface RocCurveProps {
  data: { fpr: number; tpr: number }[];
  auc: number;
  validationData?: { fpr: number; tpr: number }[];
}

export function RocCurve({ data, auc, validationData }: RocCurveProps) {
  const width = 400;
  const height = 400;
  const padding = { top: 30, right: 30, bottom: 50, left: 55 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;
  const svgRef = useRef<SVGSVGElement>(null);

  const toX = (fpr: number) => padding.left + fpr * plotW;
  const toY = (tpr: number) => padding.top + (1 - tpr) * plotH;

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
    [sortedData],
  );

  // Fill area under curve
  const fillD = useMemo(
    () =>
      sortedData.length > 0
        ? `${pathD} L ${toX(sortedData[sortedData.length - 1].fpr)} ${toY(0)} L ${toX(sortedData[0].fpr)} ${toY(0)} Z`
        : "",
    [sortedData, pathD],
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
  }, [validationData]);

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
    [sortedData],
  );

  const handleMouseLeave = useCallback(() => setHoverPoint(null), []);

  const gridLines = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="text-[#F0EDE8]"
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      data-testid="roc-curve-svg"
    >
      {/* Background */}
      <rect width={width} height={height} fill="#151518" rx={8} />

      {/* Grid */}
      {gridLines.map((v) => (
        <g key={v}>
          <line
            x1={toX(v)}
            y1={padding.top}
            x2={toX(v)}
            y2={padding.top + plotH}
            stroke="#232328"
            strokeWidth={0.5}
          />
          <line
            x1={padding.left}
            y1={toY(v)}
            x2={padding.left + plotW}
            y2={toY(v)}
            stroke="#232328"
            strokeWidth={0.5}
          />
          <text
            x={toX(v)}
            y={padding.top + plotH + 16}
            textAnchor="middle"
            fill="#5A5650"
            fontSize={10}
          >
            {v.toFixed(1)}
          </text>
          <text
            x={padding.left - 8}
            y={toY(v) + 3}
            textAnchor="end"
            fill="#5A5650"
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
        stroke="#323238"
        strokeWidth={1}
        strokeDasharray="6 4"
      />

      {/* Area under curve fill */}
      {fillD && <path d={fillD} fill="#2DD4BF" opacity={0.08} />}

      {/* Validation overlay curve (gold) */}
      {validationPathD && (
        <path
          d={validationPathD}
          fill="none"
          stroke="#C9A227"
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
          stroke="#2DD4BF"
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
            stroke="#C9A227"
            strokeWidth={1}
            strokeDasharray="3 2"
            opacity={0.5}
          />
          {/* Optimal point circle */}
          <circle
            cx={toX(youdenPoint.fpr)}
            cy={toY(youdenPoint.tpr)}
            r={6}
            fill="#C9A227"
            stroke="#0E0E11"
            strokeWidth={2}
          />
          {/* Annotation */}
          <text
            x={toX(youdenPoint.fpr) + 10}
            y={toY(youdenPoint.tpr) - 8}
            fill="#C9A227"
            fontSize={9}
            fontFamily="IBM Plex Mono, monospace"
            data-testid="youden-j-label"
          >
            J={fmt(youdenPoint.j, 2)} Sens={fmt(youdenPoint.tpr, 2)} Spec=
            {fmt(1 - youdenPoint.fpr, 2)}
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
            stroke="#5A5650"
            strokeWidth={0.5}
            strokeDasharray="3 3"
          />
          <line
            x1={padding.left}
            y1={hoverPoint.y}
            x2={padding.left + plotW}
            y2={hoverPoint.y}
            stroke="#5A5650"
            strokeWidth={0.5}
            strokeDasharray="3 3"
          />
          {/* Point highlight */}
          <circle
            cx={hoverPoint.x}
            cy={hoverPoint.y}
            r={5}
            fill="#2DD4BF"
            stroke="#0E0E11"
            strokeWidth={2}
          />
          {/* Tooltip background */}
          <rect
            x={Math.min(hoverPoint.x + 10, padding.left + plotW - 140)}
            y={Math.max(hoverPoint.y - 50, padding.top)}
            width={130}
            height={42}
            rx={4}
            fill="#0E0E11"
            stroke="#232328"
            strokeWidth={1}
          />
          <text
            x={Math.min(hoverPoint.x + 16, padding.left + plotW - 134)}
            y={Math.max(hoverPoint.y - 34, padding.top + 16)}
            fill="#C5C0B8"
            fontSize={9}
            fontFamily="IBM Plex Mono, monospace"
          >
            Thr={fmt(hoverPoint.threshold, 2)} Sens={fmt(hoverPoint.tpr, 2)}
          </text>
          <text
            x={Math.min(hoverPoint.x + 16, padding.left + plotW - 134)}
            y={Math.max(hoverPoint.y - 20, padding.top + 30)}
            fill="#C5C0B8"
            fontSize={9}
            fontFamily="IBM Plex Mono, monospace"
          >
            Spec={fmt(1 - hoverPoint.fpr, 2)} FPR={fmt(hoverPoint.fpr, 2)}
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
        stroke="#323238"
        strokeWidth={1}
      />

      {/* AUC Label */}
      <rect
        x={padding.left + plotW - 100}
        y={padding.top + plotH - 40}
        width={90}
        height={28}
        rx={4}
        fill="#0E0E11"
        stroke="#232328"
        strokeWidth={1}
      />
      <text
        x={padding.left + plotW - 55}
        y={padding.top + plotH - 22}
        textAnchor="middle"
        fill="#2DD4BF"
        fontSize={12}
        fontWeight={700}
        fontFamily="IBM Plex Mono, monospace"
      >
        AUC = {fmt(auc)}
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
            fill="#0E0E11"
            stroke="#232328"
            strokeWidth={1}
          />
          <line
            x1={padding.left + 16}
            y1={padding.top + plotH - 26}
            x2={padding.left + 36}
            y2={padding.top + plotH - 26}
            stroke="#C9A227"
            strokeWidth={2}
            strokeDasharray="6 3"
          />
          <text
            x={padding.left + 42}
            y={padding.top + plotH - 22}
            fill="#C9A227"
            fontSize={10}
          >
            Validation
          </text>
        </g>
      )}

      {/* Axis labels */}
      <text
        x={padding.left + plotW / 2}
        y={height - 8}
        textAnchor="middle"
        fill="#8A857D"
        fontSize={11}
        fontWeight={600}
      >
        False Positive Rate
      </text>
      <text
        x={14}
        y={padding.top + plotH / 2}
        textAnchor="middle"
        fill="#8A857D"
        fontSize={11}
        fontWeight={600}
        transform={`rotate(-90 14 ${padding.top + plotH / 2})`}
      >
        True Positive Rate
      </text>
    </svg>
  );
}
