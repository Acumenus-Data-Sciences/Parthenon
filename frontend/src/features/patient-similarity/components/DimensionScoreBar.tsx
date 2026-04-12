interface DimensionScoreBarProps {
  score: number | null | undefined;
  label: string;
}

function getScoreColor(score: number): string {
  if (score > 0.7) return "#2DD4BF";
  if (score > 0.4) return "#C9A227";
  return "#666666";
}

export function DimensionScoreBar({ score, label }: DimensionScoreBarProps) {
  if (score == null || !Number.isFinite(score)) {
    return (
      <div className="flex items-center gap-1.5" title={`${label}: N/A`}>
        <div
          className="h-2 rounded-full bg-[#232328]"
          style={{ width: 50 }}
        />
        <span className="text-[10px] text-[#5A5650] tabular-nums">N/A</span>
      </div>
    );
  }

  const color = getScoreColor(score);
  const barWidth = Math.max(0, Math.min(50, Math.round(score * 50)));

  return (
    <div
      className="flex items-center gap-1.5"
      title={`${label}: ${score.toFixed(2)}`}
    >
      <div className="relative h-2 rounded-full bg-[#232328]" style={{ width: 50 }}>
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
          style={{ width: barWidth, backgroundColor: color }}
        />
      </div>
      <span
        className="text-[10px] font-medium tabular-nums"
        style={{ color }}
      >
        {score.toFixed(2)}
      </span>
    </div>
  );
}
