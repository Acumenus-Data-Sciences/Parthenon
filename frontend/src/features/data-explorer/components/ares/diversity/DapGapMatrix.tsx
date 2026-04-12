interface DapGapItem {
  dimension: string;
  source_value: number;
  benchmark_value: number;
  gap: number;
  status: "met" | "gap" | "critical";
}

interface DapGapSource {
  source_id: number;
  source_name: string;
  gaps: DapGapItem[];
}

interface DapGapMatrixProps {
  data: DapGapSource[];
}

const STATUS_STYLES: Record<string, string> = {
  met: "bg-[#2DD4BF]/20 text-[#2DD4BF]",
  gap: "bg-[#C9A227]/20 text-[#C9A227]",
  critical: "bg-[#9B1B30]/20 text-[#9B1B30]",
};

export default function DapGapMatrix({ data }: DapGapMatrixProps) {
  if (data.length === 0) return null;

  // Extract all unique dimensions from first source
  const dimensions = data[0]?.gaps.map((g) => g.dimension) ?? [];

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-[#151518] px-3 py-2 text-left text-[11px] text-[#888]">
              Source
            </th>
            {dimensions.map((dim) => (
              <th key={dim} className="px-2 py-2 text-center text-[10px] text-[#666]">
                {dim}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((source) => (
            <tr key={source.source_id} className="border-t border-[#1a1a22]">
              <td className="sticky left-0 bg-[#151518] px-3 py-1.5 text-[#ccc]">
                {source.source_name}
              </td>
              {source.gaps.map((gap) => (
                <td key={gap.dimension} className="px-1 py-1">
                  <div
                    className={`rounded px-2 py-1.5 text-center text-[10px] font-mono ${STATUS_STYLES[gap.status]}`}
                    title={`Actual: ${gap.source_value}% | Target: ${gap.benchmark_value}% | Gap: ${gap.gap > 0 ? "+" : ""}${gap.gap}%`}
                  >
                    {gap.source_value.toFixed(1)}%
                    <span className="ml-1 text-[8px] opacity-70">
                      ({gap.gap > 0 ? "+" : ""}{gap.gap.toFixed(1)})
                    </span>
                  </div>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex gap-4 text-[10px] text-[#666]">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#2DD4BF]" /> Met (within 2%)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#C9A227]" /> Gap (2-10%)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-[#9B1B30]" /> Critical (&gt;10%)
        </span>
      </div>
    </div>
  );
}
