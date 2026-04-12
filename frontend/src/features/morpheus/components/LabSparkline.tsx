interface LabSparklineProps {
  values: number[];
  rangeLow: number | null;
  rangeHigh: number | null;
  width?: number;
  height?: number;
}

export default function LabSparkline({ values, rangeLow, rangeHigh, width = 100, height = 24 }: LabSparklineProps) {
  if (values.length < 2) return null;

  const min = Math.min(...values, rangeLow ?? Infinity);
  const max = Math.max(...values, rangeHigh ?? -Infinity);
  const range = max - min || 1;
  const pad = 2;

  // Use a viewBox so the SVG scales to fill its container
  const vw = width;
  const vh = height;

  const toX = (i: number) => pad + (i / (values.length - 1)) * (vw - 2 * pad);
  const toY = (v: number) => pad + (1 - (v - min) / range) * (vh - 2 * pad);

  const points = values.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${vw} ${vh}`}
      preserveAspectRatio="none"
      className="w-full block"
      style={{ height }}
    >
      {/* Reference range band */}
      {rangeLow != null && rangeHigh != null && (
        <rect
          x={pad}
          y={toY(rangeHigh)}
          width={vw - 2 * pad}
          height={Math.max(0, toY(rangeLow) - toY(rangeHigh))}
          fill="var(--success)"
          opacity={0.12}
          rx={1}
        />
      )}
      {/* Value line */}
      <polyline points={points} fill="none" stroke="var(--info)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
      {/* Latest point */}
      <circle cx={toX(values.length - 1)} cy={toY(values[values.length - 1])} r={2} fill="var(--text-primary)" stroke="var(--info)" strokeWidth={1} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
