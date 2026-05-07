// Phase 3 Plan 7 (T-024B) — visual similarity bar (0..1).
// Color stops at 60% (transition to gold) and 80% (transition to teal).

interface SimilarityBarProps {
  value: number;
  ariaLabel?: string;
  width?: "narrow" | "wide";
}

function colorClassFor(value: number): string {
  if (value >= 0.8) return "bg-[#2DD4BF]"; // teal — confident match
  if (value >= 0.6) return "bg-[#C9A227]"; // gold — borderline
  return "bg-[#9B1B30]"; // crimson — needs review
}

export function SimilarityBar({
  value,
  ariaLabel,
  width = "wide",
}: SimilarityBarProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const pct = (clamped * 100).toFixed(1);
  const colorClass = colorClassFor(clamped);
  const trackWidth = width === "wide" ? "w-32" : "w-16";

  return (
    <div className="flex items-center gap-2">
      <div
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={1}
        aria-label={ariaLabel ?? `Similarity ${pct}%`}
        className={`relative h-2 ${trackWidth} overflow-hidden rounded-full bg-zinc-800`}
      >
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="font-mono text-xs tabular-nums text-zinc-300">
        {(clamped * 100).toFixed(1)}%
      </span>
    </div>
  );
}
