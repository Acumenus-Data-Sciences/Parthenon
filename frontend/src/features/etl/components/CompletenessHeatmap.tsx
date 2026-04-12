import { useState, useMemo } from "react";
import { Grid3X3 } from "lucide-react";
import type { TableProfile } from "../api";

function cellColor(fraction: number | undefined): string {
  if (fraction === undefined) return "#1C1C20"; // column not in this table
  if (fraction <= 0.01) return "rgba(45,212,191,0.35)";
  if (fraction <= 0.10) return "rgba(45,212,191,0.2)";
  if (fraction <= 0.25) return "rgba(201,162,39,0.2)";
  if (fraction <= 0.50) return "rgba(201,162,39,0.35)";
  return "rgba(232,90,107,0.35)";
}

export function CompletenessHeatmap({ tables }: { tables: TableProfile[] }) {
  // Collect all unique column names across tables
  const allColumns = useMemo(() => {
    const colSet = new Set<string>();
    tables.forEach((t) => t.columns.forEach((c) => colSet.add(c.name)));
    return Array.from(colSet).sort();
  }, [tables]);

  const [hoveredCell, setHoveredCell] = useState<{
    table: string;
    column: string;
    pct: number;
  } | null>(null);

  if (tables.length === 0 || allColumns.length === 0) return null;

  // Limit columns for readability
  const maxCols = 30;
  const displayCols = allColumns.slice(0, maxCols);
  const truncated = allColumns.length > maxCols;

  return (
    <div className="rounded-lg border border-[#232328] bg-[#151518] overflow-hidden">
      <div className="px-4 py-3 bg-[#1C1C20] border-b border-[#232328] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Grid3X3 size={15} className="text-[#8A857D]" />
          <h4 className="text-sm font-medium text-[#F0EDE8]">
            Completeness Heatmap
          </h4>
        </div>
        <div className="flex items-center gap-3 text-[10px] text-[#8A857D]">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: "rgba(45,212,191,0.35)" }} />
            &lt;1%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: "rgba(201,162,39,0.2)" }} />
            10-25%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: "rgba(232,90,107,0.35)" }} />
            &gt;50%
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded" style={{ backgroundColor: "#1C1C20" }} />
            N/A
          </span>
        </div>
      </div>

      {/* Tooltip */}
      {hoveredCell && (
        <div className="px-4 py-2 bg-[#1A1A1E] border-b border-[#232328] text-xs text-[#C5C0B8]">
          <span className="font-mono text-[#F0EDE8]">{hoveredCell.table}</span>
          {" \u2192 "}
          <span className="font-mono text-[#F0EDE8]">{hoveredCell.column}</span>
          {" \u2014 "}
          <span
            className="font-semibold"
            style={{
              color:
                hoveredCell.pct > 50
                  ? "#E85A6B"
                  : hoveredCell.pct > 20
                    ? "#C9A227"
                    : "#2DD4BF",
            }}
          >
            {hoveredCell.pct}% null
          </span>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="text-[10px]" style={{ borderCollapse: "separate", borderSpacing: 1 }}>
          <thead>
            <tr>
              <th className="px-2 py-1.5 text-left text-[#8A857D] font-medium sticky left-0 bg-[#151518] z-10 min-w-[120px]">
                Table
              </th>
              {displayCols.map((col) => (
                <th
                  key={col}
                  className="px-0.5 py-1.5 text-[#5A5650] font-normal"
                  style={{ writingMode: "vertical-rl", maxWidth: 18, height: 80 }}
                  title={col}
                >
                  {col.length > 15 ? col.slice(0, 14) + "\u2026" : col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tables.map((table) => {
              const colMap = new Map(table.columns.map((c) => [c.name, c.fraction_empty]));
              return (
                <tr key={table.table_name}>
                  <td className="px-2 py-0.5 font-mono text-[#C5C0B8] sticky left-0 bg-[#151518] z-10 whitespace-nowrap">
                    {table.table_name}
                  </td>
                  {displayCols.map((col) => {
                    const fraction = colMap.get(col);
                    return (
                      <td
                        key={col}
                        className="px-0 py-0 cursor-crosshair"
                        style={{ backgroundColor: cellColor(fraction), minWidth: 16, height: 16 }}
                        onMouseEnter={() =>
                          setHoveredCell({
                            table: table.table_name,
                            column: col,
                            pct: fraction !== undefined ? Math.round(fraction * 100) : -1,
                          })
                        }
                        onMouseLeave={() => setHoveredCell(null)}
                      />
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {truncated && (
        <div className="px-4 py-2 text-[11px] text-[#5A5650] border-t border-[#232328]">
          Showing {maxCols} of {allColumns.length} columns. Export full report for complete view.
        </div>
      )}
    </div>
  );
}
