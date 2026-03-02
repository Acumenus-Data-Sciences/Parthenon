interface CalibrationPlotProps {
  data: { predicted: number; observed: number }[];
  slope: number;
  intercept: number;
}

export function CalibrationPlot({
  data,
  slope,
  intercept,
}: CalibrationPlotProps) {
  const width = 400;
  const height = 400;
  const padding = { top: 30, right: 30, bottom: 50, left: 55 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  const toX = (predicted: number) => padding.left + predicted * plotW;
  const toY = (observed: number) => padding.top + (1 - observed) * plotH;

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

      {/* Perfect calibration diagonal */}
      <line
        x1={toX(0)}
        y1={toY(0)}
        x2={toX(1)}
        y2={toY(1)}
        stroke="#323238"
        strokeWidth={1}
        strokeDasharray="6 4"
      />

      {/* Calibration line from slope/intercept */}
      {(() => {
        const y0 = intercept;
        const y1 = intercept + slope;
        const clampedY0 = Math.max(0, Math.min(1, y0));
        const clampedY1 = Math.max(0, Math.min(1, y1));
        return (
          <line
            x1={toX(0)}
            y1={toY(clampedY0)}
            x2={toX(1)}
            y2={toY(clampedY1)}
            stroke="#C9A227"
            strokeWidth={1.5}
            strokeDasharray="4 3"
            opacity={0.7}
          />
        );
      })()}

      {/* Data points */}
      {data.map((pt, idx) => (
        <g key={idx}>
          <circle
            cx={toX(pt.predicted)}
            cy={toY(pt.observed)}
            r={5}
            fill="#2DD4BF"
            stroke="#0E0E11"
            strokeWidth={1.5}
            opacity={0.9}
          />
        </g>
      ))}

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

      {/* Annotation */}
      <rect
        x={padding.left + 8}
        y={padding.top + 8}
        width={130}
        height={40}
        rx={4}
        fill="#0E0E11"
        stroke="#232328"
        strokeWidth={1}
      />
      <text
        x={padding.left + 16}
        y={padding.top + 24}
        fill="#C9A227"
        fontSize={10}
        fontFamily="IBM Plex Mono, monospace"
      >
        Slope: {slope.toFixed(3)}
      </text>
      <text
        x={padding.left + 16}
        y={padding.top + 40}
        fill="#C9A227"
        fontSize={10}
        fontFamily="IBM Plex Mono, monospace"
      >
        Intercept: {intercept.toFixed(3)}
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
        Observed Probability
      </text>
    </svg>
  );
}
