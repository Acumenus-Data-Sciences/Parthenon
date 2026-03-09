import { cn } from "@/lib/utils";

export interface CIBarProps {
  estimate: number;
  ciLower: number;
  ciUpper: number;
  nullValue?: number;
  logScale?: boolean;
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Horizontal confidence interval visualization as SVG.
 * Shows null reference line (gold dashed), CI line with caps, and point estimate circle.
 * Color: gray if CI spans null, teal if estimate < null, red if estimate > null.
 */
export function CIBar({
  estimate,
  ciLower,
  ciUpper,
  nullValue = 1,
  logScale = false,
  width = 200,
  height = 32,
  className,
}: CIBarProps) {
  const transform = logScale ? Math.log : (v: number) => v;

  const tLower = transform(ciLower);
  const tUpper = transform(ciUpper);
  const tEstimate = transform(estimate);
  const tNull = transform(nullValue);

  // Determine visual range with padding
  const dataMin = Math.min(tLower, tNull);
  const dataMax = Math.max(tUpper, tNull);
  const range = dataMax - dataMin || 1;
  const pad = range * 0.15;
  const domainMin = dataMin - pad;
  const domainMax = dataMax + pad;

  const scale = (v: number): number => {
    return ((v - domainMin) / (domainMax - domainMin)) * (width - 16) + 8;
  };

  const xNull = scale(tNull);
  const xLower = scale(tLower);
  const xUpper = scale(tUpper);
  const xEst = scale(tEstimate);
  const midY = height / 2;
  const capH = 8;

  // Color logic
  const spansNull = ciLower <= nullValue && ciUpper >= nullValue;
  const color = spansNull
    ? "#8A857D" // gray — not significant
    : estimate < nullValue
      ? "#2DD4BF" // teal — protective
      : "#E85A6B"; // red — harmful

  return (
    <svg
      data-testid="ci-bar"
      width={width}
      height={height}
      className={cn("block", className)}
      role="img"
      aria-label={`CI: ${ciLower.toFixed(2)}–${ciUpper.toFixed(2)}, estimate: ${estimate.toFixed(2)}`}
    >
      {/* Null reference line */}
      <line
        x1={xNull}
        y1={2}
        x2={xNull}
        y2={height - 2}
        stroke="#C9A227"
        strokeWidth={1}
        strokeDasharray="3,3"
      />

      {/* CI horizontal line */}
      <line
        x1={xLower}
        y1={midY}
        x2={xUpper}
        y2={midY}
        stroke={color}
        strokeWidth={2}
      />

      {/* Lower cap */}
      <line
        x1={xLower}
        y1={midY - capH / 2}
        x2={xLower}
        y2={midY + capH / 2}
        stroke={color}
        strokeWidth={2}
      />

      {/* Upper cap */}
      <line
        x1={xUpper}
        y1={midY - capH / 2}
        x2={xUpper}
        y2={midY + capH / 2}
        stroke={color}
        strokeWidth={2}
      />

      {/* Point estimate */}
      <circle cx={xEst} cy={midY} r={4} fill={color} />
    </svg>
  );
}
