interface HeatmapCell {
  release_id: number;
  category: string;
  pass_rate: number;
}

interface DqCategoryHeatmapProps {
  releases: Array<{ id: number; name: string; date: string }>;
  categories: string[];
  cells: HeatmapCell[];
  onCellClick?: (releaseId: number, category: string) => void;
}

function getCellColor(rate: number): string {
  if (rate >= 95) return "bg-[#2DD4BF]/40";
  if (rate >= 90) return "bg-[#2DD4BF]/20";
  if (rate >= 80) return "bg-[#C9A227]/30";
  if (rate >= 70) return "bg-[#C9A227]/15";
  return "bg-[#9B1B30]/30";
}

export default function DqCategoryHeatmap({
  releases,
  categories,
  cells,
  onCellClick,
}: DqCategoryHeatmapProps) {
  const cellMap = new Map<string, number>();
  for (const cell of cells) {
    cellMap.set(`${cell.release_id}-${cell.category}`, cell.pass_rate);
  }

  if (categories.length === 0 || releases.length === 0) {
    return (
      <div className="flex h-32 items-center justify-center text-[#555]">
        No heatmap data available. Run DQD on multiple releases to see category trends.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="sticky left-0 bg-[#151518] px-3 py-2 text-left text-[11px] text-[#888]">
              Category
            </th>
            {releases.map((r) => (
              <th key={r.id} className="px-2 py-2 text-center text-[10px] text-[#666]">
                {r.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => (
            <tr key={cat} className="border-t border-[#1a1a22]">
              <td className="sticky left-0 bg-[#151518] px-3 py-1.5 text-[#ccc]">{cat}</td>
              {releases.map((r) => {
                const rate = cellMap.get(`${r.id}-${cat}`);
                return (
                  <td key={r.id} className="px-1 py-1">
                    <button
                      type="button"
                      onClick={() => onCellClick?.(r.id, cat)}
                      className={`block w-full rounded px-2 py-1.5 text-center text-[10px] font-mono transition-colors hover:ring-1 hover:ring-[#C9A227]/50 ${
                        rate !== undefined ? getCellColor(rate) : "bg-[#1a1a22]"
                      } text-[#ccc]`}
                    >
                      {rate !== undefined ? `${rate}%` : "--"}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
