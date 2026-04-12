interface BenchmarkOverlayProps {
  /** Label for the benchmark source (e.g., "US Census 2020") */
  label: string;
  /** Benchmark proportions keyed by demographic label */
  benchmarks: Record<string, number>;
  /** Actual proportions keyed by demographic label */
  actual: Record<string, number>;
}

export default function BenchmarkOverlay({ label, benchmarks, actual }: BenchmarkOverlayProps) {
  const allLabels = Array.from(new Set([...Object.keys(benchmarks), ...Object.keys(actual)]));

  if (allLabels.length === 0) return null;

  return (
    <div className="rounded-lg border border-[#252530] bg-[#151518] p-4">
      <h4 className="mb-3 text-sm font-medium text-white">Benchmark: {label}</h4>
      <div className="space-y-2">
        {allLabels.map((dim) => {
          const actualVal = actual[dim] ?? 0;
          const benchVal = benchmarks[dim] ?? 0;
          const diff = actualVal - benchVal;

          return (
            <div key={dim} className="flex items-center gap-3">
              <span className="w-28 truncate text-xs text-[#888]" title={dim}>
                {dim}
              </span>
              <div className="relative flex-1 h-5">
                {/* Actual bar */}
                <div
                  className="absolute inset-y-0 left-0 rounded bg-[#2DD4BF]/30"
                  style={{ width: `${Math.min(actualVal, 100)}%` }}
                />
                {/* Benchmark line */}
                {benchVal > 0 && (
                  <div
                    className="absolute inset-y-0 w-0.5 bg-[#C9A227]"
                    style={{ left: `${Math.min(benchVal, 100)}%` }}
                    title={`Benchmark: ${benchVal}%`}
                  />
                )}
              </div>
              <span className="w-16 text-right text-xs text-[#888]">
                {actualVal.toFixed(1)}%
              </span>
              <span
                className={`w-14 text-right text-xs font-mono ${
                  diff >= 0 ? "text-[#2DD4BF]" : "text-[#9B1B30]"
                }`}
              >
                {diff >= 0 ? "+" : ""}{diff.toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex gap-4 text-[10px] text-[#666]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-[#2DD4BF]/30" /> Actual
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-0.5 bg-[#C9A227]" /> Benchmark
        </span>
      </div>
    </div>
  );
}
