import type { EstimateEntry } from "../types/estimation";
import { fmt, num, computeNNT } from "@/lib/formatters";

interface ForestPlotEstimate extends EstimateEntry {
  weight?: number;
}

interface ForestPlotProps {
  estimates: ForestPlotEstimate[];
  showNNT?: boolean;
  predictionInterval?: { lower: number; upper: number };
}

export function ForestPlot({
  estimates,
  showNNT = false,
  predictionInterval,
}: ForestPlotProps) {
  if (estimates.length === 0) return null;

  const width = showNNT ? 880 : 800;
  const rowHeight = 40;
  const headerHeight = 50;
  const footerHeight = 40;
  const leftLabelWidth = 200;
  const nntColumnWidth = showNNT ? 80 : 0;
  const rightLabelWidth = 220 + nntColumnWidth;
  const plotWidth = width - leftLabelWidth - rightLabelWidth;
  const height = headerHeight + estimates.length * rowHeight + footerHeight;

  // Weight encoding — find max weight for proportional sizing
  const hasWeights = estimates.some((e) => e.weight != null && e.weight > 0);
  const maxWeight = hasWeights
    ? Math.max(...estimates.map((e) => e.weight ?? 0))
    : 1;

  // Compute logarithmic scale bounds
  const allValues = estimates.flatMap((e) => [
    Math.log(num(e.ci_95_lower) || 0.01),
    Math.log(num(e.ci_95_upper) || 100),
    Math.log(num(e.hazard_ratio) || 1),
  ]);

  // Include prediction interval in scale if provided
  if (predictionInterval) {
    allValues.push(
      Math.log(Math.max(predictionInterval.lower, 0.001)),
      Math.log(Math.max(predictionInterval.upper, 0.001)),
    );
  }

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

  // Compute NNT for each estimate if needed
  const nntValues = showNNT
    ? estimates.map((e) => {
        const hr = num(e.hazard_ratio);
        if (hr <= 0 || hr === 1) return { label: "-", value: "-" };
        // Approximate from HR: NNT ~ 1/|1-HR| * baseCER scaled
        // Use simpler approach: compute from outcomes
        const totalOutcomes = num(e.target_outcomes) + num(e.comparator_outcomes);
        if (totalOutcomes === 0) return { label: "-", value: "-" };
        const targetRate = num(e.target_outcomes) / Math.max(totalOutcomes, 1);
        const compRate = num(e.comparator_outcomes) / Math.max(totalOutcomes, 1);
        const nnt = computeNNT(1 - targetRate, 1 - compRate);
        if (!Number.isFinite(nnt)) return { label: "-", value: "\u221E" };
        const absNNT = Math.round(Math.abs(nnt));
        return nnt > 0
          ? { label: "NNT", value: absNNT.toString() }
          : { label: "NNH", value: absNNT.toString() };
      })
    : [];

  return (
    <div className="overflow-x-auto">
      <svg
        data-testid="forest-plot"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="text-text-primary"
      >
        {/* Background */}
        <rect
          x={0}
          y={0}
          width={width}
          height={height}
          fill="var(--surface-raised)"
          rx={8}
        />

        {/* Header */}
        <text
          x={leftLabelWidth / 2}
          y={30}
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize={11}
          fontWeight={600}
        >
          Outcome
        </text>
        <text
          x={leftLabelWidth + plotWidth / 2}
          y={20}
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize={11}
          fontWeight={600}
        >
          Hazard Ratio (95% CI)
        </text>
        <text
          x={leftLabelWidth + plotWidth / 2}
          y={36}
          textAnchor="middle"
          fill="var(--text-ghost)"
          fontSize={10}
        >
          Favors Target | Favors Comparator
        </text>
        <text
          x={leftLabelWidth + plotWidth + 110}
          y={30}
          textAnchor="middle"
          fill="var(--text-muted)"
          fontSize={11}
          fontWeight={600}
        >
          HR (95% CI) p-value
        </text>
        {showNNT && (
          <text
            x={width - nntColumnWidth / 2}
            y={30}
            textAnchor="middle"
            fill="var(--text-muted)"
            fontSize={11}
            fontWeight={600}
          >
            NNT/NNH
          </text>
        )}

        {/* Reference line at HR=1.0 */}
        <line
          x1={refLineX}
          y1={headerHeight}
          x2={refLineX}
          y2={headerHeight + estimates.length * rowHeight}
          stroke="var(--accent)"
          strokeWidth={1.5}
          strokeDasharray="4 4"
          opacity={0.6}
        />

        {/* Prediction interval on last (pooled) row */}
        {predictionInterval && estimates.length > 0 && (
          <line
            data-testid="prediction-interval"
            x1={toX(Math.max(predictionInterval.lower, 0.001))}
            y1={
              headerHeight +
              (estimates.length - 1) * rowHeight +
              rowHeight / 2
            }
            x2={toX(Math.min(predictionInterval.upper, 1000))}
            y2={
              headerHeight +
              (estimates.length - 1) * rowHeight +
              rowHeight / 2
            }
            stroke="var(--accent)"
            strokeWidth={1}
            strokeDasharray="6 3"
            opacity={0.6}
          />
        )}

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
                stroke="var(--surface-elevated)"
                strokeWidth={0.5}
              />
              <text
                x={x}
                y={height - 12}
                textAnchor="middle"
                fill="var(--text-ghost)"
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
            fill={idx % 2 === 0 ? "transparent" : "var(--surface-overlay)"}
            opacity={0.5}
          />
        ))}

        {/* Data rows */}
        {estimates.map((entry, idx) => {
          const y = headerHeight + idx * rowHeight + rowHeight / 2;
          const hrX = toX(num(entry.hazard_ratio) || 1);
          const ciLowX = toX(Math.max(num(entry.ci_95_lower), 0.001));
          const ciHighX = toX(Math.min(num(entry.ci_95_upper), 1000));
          const isSignificant = num(entry.p_value) < 0.05;
          const color = isSignificant
            ? num(entry.hazard_ratio) < 1
              ? "var(--success)"
              : "var(--critical)"
            : "var(--text-muted)";

          // Weight-proportional square size (default 7 half-size)
          const baseSize = 7;
          const squareSize =
            hasWeights && entry.weight != null && entry.weight > 0
              ? Math.max(3, baseSize * Math.sqrt(entry.weight / maxWeight))
              : baseSize;

          return (
            <g key={entry.outcome_id}>
              {/* Outcome name */}
              <text
                x={12}
                y={y + 4}
                fill="var(--text-primary)"
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

              {/* Point estimate — square sized by weight if available, diamond otherwise */}
              {hasWeights ? (
                <rect
                  x={hrX - squareSize}
                  y={y - squareSize}
                  width={squareSize * 2}
                  height={squareSize * 2}
                  fill={color}
                  stroke="var(--surface-base)"
                  strokeWidth={0.5}
                />
              ) : (
                <polygon
                  points={`${hrX},${y - baseSize} ${hrX + 5},${y} ${hrX},${y + baseSize} ${hrX - 5},${y}`}
                  fill={color}
                  stroke="var(--surface-base)"
                  strokeWidth={0.5}
                />
              )}

              {/* Right labels: HR (CI), p-value */}
              <text
                x={leftLabelWidth + plotWidth + 8}
                y={y + 4}
                fill="var(--text-secondary)"
                fontSize={10}
                fontFamily="IBM Plex Mono, monospace"
              >
                {fmt(entry.hazard_ratio, 2)} (
                {fmt(entry.ci_95_lower, 2)}-{fmt(entry.ci_95_upper, 2)})
              </text>
              <text
                x={leftLabelWidth + plotWidth + 180}
                y={y + 4}
                fill={isSignificant ? color : "var(--text-ghost)"}
                fontSize={10}
                fontFamily="IBM Plex Mono, monospace"
                textAnchor="end"
              >
                {num(entry.p_value) < 0.001
                  ? "<0.001"
                  : `p=${fmt(entry.p_value)}`}
              </text>

              {/* NNT/NNH column */}
              {showNNT && nntValues[idx] && (
                <text
                  x={width - nntColumnWidth / 2}
                  y={y + 4}
                  textAnchor="middle"
                  fill={
                    nntValues[idx].label === "NNT"
                      ? "var(--success)"
                      : nntValues[idx].label === "NNH"
                        ? "var(--critical)"
                        : "var(--text-ghost)"
                  }
                  fontSize={10}
                  fontFamily="IBM Plex Mono, monospace"
                >
                  {nntValues[idx].value === "-"
                    ? "-"
                    : `${nntValues[idx].label} ${nntValues[idx].value}`}
                </text>
              )}
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
          stroke="var(--surface-elevated)"
          strokeWidth={1}
        />
      </svg>
    </div>
  );
}
