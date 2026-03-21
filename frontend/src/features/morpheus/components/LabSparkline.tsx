// frontend/src/features/morpheus/components/LabSparkline.tsx

interface LabSparklineProps {
  values: number[];
  rangeLow: number | null;
  rangeHigh: number | null;
  width?: number;
  height?: number;
}

export default function LabSparkline({ values, rangeLow, rangeHigh, width = 100, height = 28 }: LabSparklineProps) {
  if (values.length < 2) return null;

  const min = Math.min(...values, rangeLow ?? Infinity);
  const max = Math.max(...values, rangeHigh ?? -Infinity);
  const range = max - min || 1;
  const pad = 2;

  const toX = (i: number) => pad + (i / (values.length - 1)) * (width - 2 * pad);
  const toY = (v: number) => pad + (1 - (v - min) / range) * (height - 2 * pad);

  const points = values.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');

  return (
    <svg width={width} height={height} className="inline-block">
      {/* Reference range band */}
      {rangeLow != null && rangeHigh != null && (
        <rect
          x={pad}
          y={toY(rangeHigh)}
          width={width - 2 * pad}
          height={Math.max(0, toY(rangeLow) - toY(rangeHigh))}
          fill="#22C55E"
          opacity={0.12}
          rx={2}
        />
      )}
      {/* Value line */}
      <polyline points={points} fill="none" stroke="#818CF8" strokeWidth={1.5} />
      {/* Latest point */}
      <circle cx={toX(values.length - 1)} cy={toY(values[values.length - 1])} r={2.5} fill="#F0EDE8" stroke="#818CF8" strokeWidth={1} />
    </svg>
  );
}
