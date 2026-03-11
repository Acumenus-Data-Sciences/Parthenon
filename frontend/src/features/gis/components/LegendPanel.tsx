interface LegendPanelProps {
  metric: string;
  maxValue: number;
}

export function LegendPanel({ metric, maxValue }: LegendPanelProps) {
  const labels = [
    { pct: 0, label: "0" },
    { pct: 25, label: formatValue(maxValue * 0.25) },
    { pct: 50, label: formatValue(maxValue * 0.5) },
    { pct: 75, label: formatValue(maxValue * 0.75) },
    { pct: 100, label: formatValue(maxValue) },
  ];

  return (
    <div className="rounded-lg border border-[#232328] bg-[#141418] p-3">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-[#5A5650]">
        {metric.replace(/_/g, " ")}
      </div>
      <div
        className="h-3 w-full rounded"
        style={{
          background: "linear-gradient(to right, #1E1E23, #9B1B30, #C9A227)",
        }}
      />
      <div className="mt-1 flex justify-between text-[10px] text-[#5A5650]">
        {labels.map((l) => (
          <span key={l.pct}>{l.label}</span>
        ))}
      </div>
    </div>
  );
}

function formatValue(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
  return v.toFixed(0);
}
