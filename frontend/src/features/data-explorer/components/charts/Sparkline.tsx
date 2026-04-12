interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  showArea?: boolean;
}

export function Sparkline({
  data,
  width = 80,
  height = 24,
  color = "#2DD4BF",
  showArea = true,
}: SparklineProps) {
  if (data.length < 2) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = 1;

  const points = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (v - min) / range) * (height - pad * 2);
    return `${x},${y}`;
  });

  const polyline = points.join(" ");
  const areaPoints = `${pad},${height - pad} ${polyline} ${width - pad},${height - pad}`;

  return (
    <svg width={width} height={height} className="inline-block align-middle">
      {showArea && (
        <polygon points={areaPoints} fill={color} fillOpacity={0.12} />
      )}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
