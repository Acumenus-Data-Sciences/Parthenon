import { fmt } from "@/lib/formatters";

interface PredictionDistributionProps {
  bins: { binStart: number; binEnd: number; outcomeCount: number; noOutcomeCount: number }[];
}

export function PredictionDistribution({ bins }: PredictionDistributionProps) {
  if (bins.length === 0) return null;

  const width = 500;
  const height = 300;
  const padding = { top: 30, right: 30, bottom: 50, left: 60 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const maxCount = Math.max(...bins.map((b) => b.outcomeCount + b.noOutcomeCount), 1);

  const binW = plotW / bins.length;
  const toY = (count: number) =>
    padding.top + plotH - (count / maxCount) * plotH;

  const xTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
  const yStep = Math.pow(10, Math.floor(Math.log10(maxCount)));
  const yTicks: number[] = [];
  for (let v = 0; v <= maxCount; v += yStep) {
    yTicks.push(v);
  }
  if (yTicks[yTicks.length - 1] < maxCount) yTicks.push(maxCount);

  return (
    <div className="overflow-x-auto">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="text-[#F0EDE8]"
        role="img"
        aria-label="Prediction distribution histogram"
      >
        <rect width={width} height={height} fill="#151518" rx={8} />

        {/* Y Grid */}
        {yTicks.map((v) => (
          <g key={`y-${v}`}>
            <line
              x1={padding.left}
              y1={toY(v)}
              x2={padding.left + plotW}
              y2={toY(v)}
              stroke="#232328"
              strokeWidth={0.5}
            />
            <text x={padding.left - 8} y={toY(v) + 4} textAnchor="end" fill="#5A5650" fontSize={9}>
              {v.toLocaleString()}
            </text>
          </g>
        ))}

        {/* Bars */}
        {bins.map((bin, i) => {
          const x = padding.left + i * binW;
          const noOutH = (bin.noOutcomeCount / maxCount) * plotH;
          const outH = (bin.outcomeCount / maxCount) * plotH;
          const baseY = padding.top + plotH;

          return (
            <g key={i}>
              {/* No outcome (bottom) */}
              <rect
                x={x + 1}
                y={baseY - noOutH}
                width={binW - 2}
                height={noOutH}
                fill="#2DD4BF"
                opacity={0.5}
                rx={1}
              >
                <title>
                  {fmt(bin.binStart, 2)}-{fmt(bin.binEnd, 2)}: {bin.noOutcomeCount} without outcome
                </title>
              </rect>
              {/* Outcome (top, stacked) */}
              <rect
                x={x + 1}
                y={baseY - noOutH - outH}
                width={binW - 2}
                height={outH}
                fill="#E85A6B"
                opacity={0.6}
                rx={1}
              >
                <title>
                  {fmt(bin.binStart, 2)}-{fmt(bin.binEnd, 2)}: {bin.outcomeCount} with outcome
                </title>
              </rect>
            </g>
          );
        })}

        {/* X axis ticks */}
        {xTicks.map((v) => {
          const x = padding.left + v * plotW;
          return (
            <text key={`x-${v}`} x={x} y={padding.top + plotH + 16} textAnchor="middle" fill="#5A5650" fontSize={10}>
              {v.toFixed(1)}
            </text>
          );
        })}

        {/* Plot boundary */}
        <rect x={padding.left} y={padding.top} width={plotW} height={plotH} fill="none" stroke="#323238" strokeWidth={1} />

        {/* Legend */}
        <g transform={`translate(${padding.left + plotW - 175}, ${padding.top + 8})`}>
          <rect x={0} y={0} width={165} height={42} rx={4} fill="#0E0E11" stroke="#232328" strokeWidth={1} />
          <rect x={10} y={8} width={10} height={10} rx={2} fill="#E85A6B" opacity={0.6} />
          <text x={26} y={17} fill="#C5C0B8" fontSize={10}>With Outcome</text>
          <rect x={10} y={26} width={10} height={10} rx={2} fill="#2DD4BF" opacity={0.5} />
          <text x={26} y={35} fill="#C5C0B8" fontSize={10}>Without Outcome</text>
        </g>

        {/* Axis labels */}
        <text x={padding.left + plotW / 2} y={height - 8} textAnchor="middle" fill="#8A857D" fontSize={11} fontWeight={600}>
          Predicted Probability
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
          Count
        </text>
      </svg>
    </div>
  );
}
