import { fmt } from "@/lib/formatters";

interface RocCurveProps {
  data: { fpr: number; tpr: number }[];
  auc: number;
}

export function RocCurve({ data, auc }: RocCurveProps) {
  const width = 400;
  const height = 400;
  const padding = { top: 30, right: 30, bottom: 50, left: 55 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const toX = (fpr: number) => padding.left + fpr * plotW;
  const toY = (tpr: number) => padding.top + (1 - tpr) * plotH;

  // Build path string
  const sortedData = [...data].sort((a, b) => a.fpr - b.fpr);
  const pathD =
    sortedData.length > 0
      ? sortedData
          .map((pt, i) =>
            i === 0
              ? `M ${toX(pt.fpr)} ${toY(pt.tpr)}`
              : `L ${toX(pt.fpr)} ${toY(pt.tpr)}`,
          )
          .join(" ")
      : "";

  // Fill area under curve
  const fillD =
    sortedData.length > 0
      ? `${pathD} L ${toX(sortedData[sortedData.length - 1].fpr)} ${toY(0)} L ${toX(sortedData[0].fpr)} ${toY(0)} Z`
      : "";

  const gridLines = [0, 0.2, 0.4, 0.6, 0.8, 1.0];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="text-[#F0EDE8]"
    >
      {/* Background */}
      <rect width={width} height={height} fill="#151518" rx={8} />

      {/* Grid */}
      {gridLines.map((v) => (
        <g key={v}>
          {/* Vertical grid */}
          <line
            x1={toX(v)}
            y1={padding.top}
            x2={toX(v)}
            y2={padding.top + plotH}
            stroke="#232328"
            strokeWidth={0.5}
          />
          {/* Horizontal grid */}
          <line
            x1={padding.left}
            y1={toY(v)}
            x2={padding.left + plotW}
            y2={toY(v)}
            stroke="#232328"
            strokeWidth={0.5}
          />
          {/* X labels */}
          <text
            x={toX(v)}
            y={padding.top + plotH + 16}
            textAnchor="middle"
            fill="#5A5650"
            fontSize={10}
          >
            {v.toFixed(1)}
          </text>
          {/* Y labels */}
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
