import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import type { TableProfile } from "../api";
import { fmtNumber, scoreToGrade, tableNullScore } from "../lib/profiler-utils";

export function TableSizeChart({ tables }: { tables: TableProfile[] }) {
  const sorted = useMemo(
    () => [...tables].sort((a, b) => b.row_count - a.row_count).slice(0, 20),
    [tables],
  );
  const maxRows = sorted[0]?.row_count ?? 1;

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      <div className="px-4 py-3 bg-[#1C1C20] border-b border-[#232328] flex items-center gap-2">
        <BarChart3 size={15} className="text-[#8A857D]" />
        <h4 className="text-sm font-medium text-[#F0EDE8]">
          Table Size Distribution
          {tables.length > 20 && (
            <span className="font-normal text-[#5A5650] ml-1">(top 20)</span>
          )}
        </h4>
      </div>
      <div className="divide-y divide-[#1C1C20]">
        {sorted.map((table) => {
          const pct = maxRows > 0 ? (table.row_count / maxRows) * 100 : 0;
          const grade = scoreToGrade(tableNullScore(table));
          return (
            <div
              key={table.table_name}
              className="flex items-center gap-3 px-4 py-2"
            >
              <span
                className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
                style={{ backgroundColor: grade.bg, color: grade.color }}
              >
                {grade.letter}
              </span>
              <span className="w-40 shrink-0 font-mono text-xs text-[#C5C0B8] truncate">
                {table.table_name}
              </span>
              <div className="flex-1 h-2 rounded-full bg-[#232328] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(pct, 1)}%`,
                    backgroundColor: "#9B1B30",
                  }}
                />
              </div>
              <span className="w-20 text-right tabular-nums text-xs text-[#8A857D]">
                {fmtNumber(table.row_count)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
