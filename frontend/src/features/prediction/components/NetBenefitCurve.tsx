interface NetBenefitCurveProps {
  data: { threshold: number; model: number; treatAll: number; treatNone: number }[];
}

export function NetBenefitCurve({ data }: NetBenefitCurveProps) {
  if (data.length === 0) return null;

  const width = 500;
  const height = 350;
  const padding = { top: 30, right: 30, bottom: 50, left: 60 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const allValues = data.flatMap((d) => [d.model, d.treatAll, d.treatNone]);
  const yMin = Math.min(...allValues, 0);
  const yMax = Math.max(...allValues, 0.1);
  const yPad = (yMax - yMin) * 0.1;
  const yLow = yMin - yPad;
  const yHigh = yMax + yPad;

  const toX = (v: number) => padding.left + v * plotW;
  const toY = (v: number) =>
    padding.top + ((yHigh - v) / (yHigh - yLow)) * plotH;

  const buildPath = (values: number[]) =>
    data
      .map((d, i) => `${i === 0 ? "M" : "L"} ${toX(d.threshold)} ${toY(values[i])}`)
      .join(" ");

  const modelPath = buildPath(data.map((d) => d.model));
  const treatAllPath = buildPath(data.map((d) => d.treatAll));

  const xTicks = [0, 0.2, 0.4, 0.6, 0.8, 1.0];
  const yRange = yHigh - yLow;
  const yStep = Math.pow(10, Math.floor(Math.log10(yRange))) / 2;
  const yTicks: number[] = [];
  for (let v = Math.ceil(yLow / yStep) * yStep; v <= yHigh; v += yStep) {
    yTicks.push(Math.round(v * 1000) / 1000);
  }

  return (
    <div className="overflow-x-auto">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="text-[#F0EDE8]"
        role="img"
        aria-label="Decision curve analysis showing net benefit vs threshold probability"
      >
        <rect width={width} height={height} fill="#151518" rx={8} />

        {/* Grid */}
        {xTicks.map((v) => (
          <g key={`x-${v}`}>
            <line x1={toX(v)} y1={padding.top} x2={toX(v)} y2={padding.top + plotH} stroke="#232328" strokeWidth={0.5} />
            <text x={toX(v)} y={padding.top + plotH + 16} textAnchor="middle" fill="#5A5650" fontSize={10}>
              {v.toFixed(1)}
            </text>
          </g>
        ))}
        {yTicks.map((v) => (
          <g key={`y-${v}`}>
            <line x1={padding.left} y1={toY(v)} x2={padding.left + plotW} y2={toY(v)} stroke="#232328" strokeWidth={0.5} />
            <text x={padding.left - 8} y={toY(v) + 4} textAnchor="end" fill="#5A5650" fontSize={9}>
              {v.toFixed(3)}
            </text>
          </g>
        ))}

        {/* Zero line */}
        {yLow < 0 && yHigh > 0 && (
          <line
            x1={padding.left}
            y1={toY(0)}
            x2={padding.left + plotW}
            y2={toY(0)}
            stroke="#5A5650"
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}

        {/* Treat None (y=0 line) */}
        <line
          x1={padding.left}
          y1={toY(0)}
          x2={padding.left + plotW}
          y2={toY(0)}
          stroke="#5A5650"
          strokeWidth={1.5}
          strokeDasharray="6 4"
          opacity={0.5}
        />

        {/* Treat All */}
        <path d={treatAllPath} fill="none" stroke="#E85A6B" strokeWidth={1.5} strokeDasharray="6 4" />

        {/* Model */}
        <path d={modelPath} fill="none" stroke="#2DD4BF" strokeWidth={2} />

        {/* Plot boundary */}
        <rect x={padding.left} y={padding.top} width={plotW} height={plotH} fill="none" stroke="#323238" strokeWidth={1} />

        {/* Legend */}
        <g transform={`translate(${padding.left + plotW - 170}, ${padding.top + 8})`}>
          <rect x={0} y={0} width={160} height={58} rx={4} fill="#0E0E11" stroke="#232328" strokeWidth={1} />
          <line x1={10} y1={12} x2={30} y2={12} stroke="#2DD4BF" strokeWidth={2} />
          <text x={36} y={16} fill="#C5C0B8" fontSize={10}>Model</text>
          <line x1={10} y1={28} x2={30} y2={28} stroke="#E85A6B" strokeWidth={1.5} strokeDasharray="6 4" />
          <text x={36} y={32} fill="#C5C0B8" fontSize={10}>Treat All</text>
          <line x1={10} y1={44} x2={30} y2={44} stroke="#5A5650" strokeWidth={1.5} strokeDasharray="4 4" />
          <text x={36} y={48} fill="#C5C0B8" fontSize={10}>Treat None</text>
        </g>

        {/* Axis labels */}
        <text x={padding.left + plotW / 2} y={height - 8} textAnchor="middle" fill="#8A857D" fontSize={11} fontWeight={600}>
          Threshold Probability
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
          Net Benefit
        </text>
      </svg>
    </div>
  );
}
