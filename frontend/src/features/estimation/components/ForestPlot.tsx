import type { EstimateEntry } from "../types/estimation";

interface ForestPlotProps {
  estimates: EstimateEntry[];
}

export function ForestPlot({ estimates }: ForestPlotProps) {
  if (estimates.length === 0) return null;

  const width = 800;
  const rowHeight = 40;
  const headerHeight = 50;
  const footerHeight = 40;
  const leftLabelWidth = 200;
  const rightLabelWidth = 220;
  const plotWidth = width - leftLabelWidth - rightLabelWidth;
  const height = headerHeight + estimates.length * rowHeight + footerHeight;

  // Compute logarithmic scale bounds
  const allValues = estimates.flatMap((e) => [
    Math.log(e.ci_95_lower || 0.01),
    Math.log(e.ci_95_upper || 100),
    Math.log(e.hazard_ratio || 1),
  ]);
  const logMin = Math.min(...allValues, Math.log(0.1));
  const logMax = Math.max(...allValues, Math.log(10));
  const logPadding = (logMax - logMin) * 0.1;
  const scaleMin = logMin - logPadding;
  const scaleMax = logMax + logPadding;

  const toX = (hr: number): number => {
    const logVal = Math.log(Math.max(hr, 0.001));
    return (
      leftLabelWidth +
      ((logVal - scaleMin) / (scaleMax - scaleMin)) * plotWidth
    );
  };

  const refLineX = toX(1.0);

  // Tick marks at powers of 10 and nice fractions
  const ticks = [0.1, 0.25, 0.5, 1.0, 2.0, 4.0, 10.0].filter(
    (t) => Math.log(t) >= scaleMin && Math.log(t) <= scaleMax,
  );

  return (
    <div className="overflow-x-auto">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="text-[#F0EDE8]"
      >
        {/* Background */}
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="#151518"
          rx={8}
        />

        {/* Header */}
        <text
          x={leftLabelWidth / 2}
          y={30}
          textAnchor="middle"
          fill="#8A857D"
          fontSize={11}
          fontWeight={600}
        >
          Outcome
        </text>
        <text
          x={leftLabelWidth + plotWidth / 2}
          y={20}
          textAnchor="middle"
          fill="#8A857D"
          fontSize={11}
          fontWeight={600}
        >
          Hazard Ratio (95% CI)
        </text>
        <text
          x={leftLabelWidth + plotWidth / 2}
          y={36}
          textAnchor="middle"
          fill="#5A5650"
          fontSize={10}
        >
          Favors Target | Favors Comparator
        </text>
        <text
          x={width - rightLabelWidth / 2}
          y={30}
          textAnchor="middle"
          fill="#8A857D"
          fontSize={11}
          fontWeight={600}
        >
          HR (95% CI) p-value
        </text>

        {/* Reference line at HR=1.0 */}
        <line
          x1={refLineX}
          y1={headerHeight}
          x2={refLineX}
          y2={headerHeight + estimates.length * rowHeight}
          stroke="#C9A227"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          opacity={0.6}
        />

        {/* Grid lines */}
        {ticks.map((tick) => {
          const x = toX(tick);
          return (
            <g key={tick}>
              <line
                x1={x}
                y1={headerHeight}
                x2={x}
                y2={headerHeight + estimates.length * rowHeight}
                stroke="#232328"
                strokeWidth={0.5}
              />
              <text
                x={x}
                y={height - 12}
                textAnchor="middle"
                fill="#5A5650"
                fontSize={9}
              >
                {tick}
              </text>
            </g>
          );
        })}

        {/* Row alternating backgrounds */}
        {estimates.map((_, idx) => (
          <rect
            key={`bg-${idx}`}
            x={0}
            y={headerHeight + idx * rowHeight}
            width={width}
            height={rowHeight}
            fill={idx % 2 === 0 ? "transparent" : "#1A1A1E"}
            opacity={0.5}
          />
        ))}

        {/* Data rows */}
        {estimates.map((entry, idx) => {
          const y = headerHeight + idx * rowHeight + rowHeight / 2;
          const hrX = toX(entry.hazard_ratio);
          const ciLowX = toX(Math.max(entry.ci_95_lower, 0.001));
          const ciHighX = toX(Math.min(entry.ci_95_upper, 1000));
          const isSignificant = entry.p_value < 0.05;
          const color = isSignificant
            ? entry.hazard_ratio < 1
              ? "#2DD4BF"
              : "#E85A6B"
            : "#8A857D";

          return (
            <g key={entry.outcome_id}>
              {/* Outcome name */}
              <text
                x={12}
                y={y + 4}
                fill="#F0EDE8"
                fontSize={11}
                className="font-medium"
              >
                {entry.outcome_name.length > 28
                  ? entry.outcome_name.substring(0, 28) + "..."
                  : entry.outcome_name}
              </text>

              {/* CI line */}
              <line
                x1={ciLowX}
                y1={y}
                x2={ciHighX}
                y2={y}
                stroke={color}
                strokeWidth={2}
              />

              {/* CI caps */}
              <line
                x1={ciLowX}
                y1={y - 5}
                x2={ciLowX}
                y2={y + 5}
                stroke={color}
                strokeWidth={1.5}
              />
              <line
                x1={ciHighX}
                y1={y - 5}
                x2={ciHighX}
                y2={y + 5}
                stroke={color}
                strokeWidth={1.5}
              />

              {/* Diamond for point estimate */}
              <polygon
                points={`${hrX},${y - 7} ${hrX + 5},${y} ${hrX},${y + 7} ${hrX - 5},${y}`}
                fill={color}
                stroke="#0E0E11"
                strokeWidth={0.5}
              />

              {/* Right labels: HR (CI), p-value */}
              <text
                x={width - rightLabelWidth + 8}
                y={y + 4}
                fill="#C5C0B8"
                fontSize={10}
                fontFamily="IBM Plex Mono, monospace"
              >
                {entry.hazard_ratio.toFixed(2)} (
                {entry.ci_95_lower.toFixed(2)}-{entry.ci_95_upper.toFixed(2)})
              </text>
              <text
                x={width - 40}
                y={y + 4}
                fill={isSignificant ? color : "#5A5650"}
                fontSize={10}
                fontFamily="IBM Plex Mono, monospace"
                textAnchor="end"
              >
                {entry.p_value < 0.001
                  ? "<0.001"
                  : `p=${entry.p_value.toFixed(3)}`}
              </text>
            </g>
          );
        })}

        {/* Plot boundary */}
        <rect
          x={leftLabelWidth}
          y={headerHeight}
          width={plotWidth}
          height={estimates.length * rowHeight}
          fill="none"
          stroke="#232328"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}
