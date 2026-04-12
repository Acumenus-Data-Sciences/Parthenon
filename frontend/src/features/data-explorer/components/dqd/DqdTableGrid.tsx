import { useMemo } from "react";
import { cn } from "@/lib/utils";
import type { DqdCheckResult } from "../../types/dataExplorer";

interface DqdTableGridProps {
  results: DqdCheckResult[];
}

interface CellData {
  passed: number;
  total: number;
  passRate: number;
}

const CATEGORIES = ["completeness", "conformance", "plausibility"] as const;
const CATEGORY_LABELS: Record<string, string> = {
  completeness: "Completeness",
  conformance: "Conformance",
  plausibility: "Plausibility",
  overall: "Overall",
};

function getCellColor(passRate: number): string {
  if (passRate >= 90) return "bg-[#2DD4BF]/15 text-[#2DD4BF]";
  if (passRate >= 70) return "bg-[#C9A227]/15 text-[#C9A227]";
  return "bg-[#E85A6B]/15 text-[#E85A6B]";
}

export function DqdTableGrid({ results }: DqdTableGridProps) {
  const { grid } = useMemo(() => {
    // Group by table and category
    const grouped = new Map<string, Map<string, CellData>>();
    const tableOverall = new Map<string, { passed: number; total: number }>();

    for (const r of results) {
      const table = r.cdm_table;
      const cat = r.category;

      if (!grouped.has(table)) {
        grouped.set(table, new Map());
        tableOverall.set(table, { passed: 0, total: 0 });
      }

      const catMap = grouped.get(table)!;
      if (!catMap.has(cat)) {
        catMap.set(cat, { passed: 0, total: 0, passRate: 0 });
      }

      const cell = catMap.get(cat)!;
      cell.total++;
      if (r.passed) cell.passed++;
      cell.passRate = (cell.passed / cell.total) * 100;

      const overall = tableOverall.get(table)!;
      overall.total++;
      if (r.passed) overall.passed++;
    }

    // Build grid data
    const tableNames = Array.from(grouped.keys()).sort();
    const gridData = tableNames.map((table) => {
      const catMap = grouped.get(table)!;
      const overall = tableOverall.get(table)!;

      return {
        table,
        cells: Object.fromEntries(
          [...CATEGORIES.map((cat) => [cat, catMap.get(cat) ?? null]),
           ["overall", {
             passed: overall.passed,
             total: overall.total,
             passRate: (overall.passed / overall.total) * 100,
           }]],
        ) as Record<string, CellData | null>,
      };
    });

    return { tables: tableNames, grid: gridData };
  }, [results]);

  if (!results.length) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-[#232328] bg-[#151518] py-16">
        <p className="text-sm text-[#8A857D]">No DQD results to display</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#232328] bg-[#151518] overflow-hidden">
      <div className="border-b border-[#232328] bg-[#1A1A1E] px-6 py-3">
        <h3 className="text-sm font-semibold text-[#F0EDE8]">
          Table x Category Heatmap
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#232328] text-xs text-[#5A5650]">
              <th className="px-6 py-2 text-left font-medium min-w-[180px]">
                CDM Table
              </th>
              {[...CATEGORIES, "overall" as const].map((cat) => (
                <th
                  key={cat}
                  className="px-4 py-2 text-center font-medium min-w-[110px]"
                >
                  {CATEGORY_LABELS[cat]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[#232328]">
            {grid.map((row) => (
              <tr key={row.table} className="hover:bg-[#1A1A1E] transition">
                <td className="px-6 py-2.5">
                  <span className="font-['IBM_Plex_Mono',monospace] text-xs text-[#C5C0B8]">
                    {row.table}
                  </span>
                </td>
                {[...CATEGORIES, "overall" as const].map((cat) => {
                  const cell = row.cells[cat];
                  if (!cell) {
                    return (
                      <td key={cat} className="px-4 py-2.5 text-center">
                        <span className="rounded-md bg-[#232328] px-3 py-1 text-xs text-[#5A5650]">
                          --
                        </span>
                      </td>
                    );
                  }
                  return (
                    <td key={cat} className="px-4 py-2.5 text-center">
                      <span
                        className={cn(
                          "inline-block rounded-md px-3 py-1 text-xs font-semibold font-['IBM_Plex_Mono',monospace]",
                          getCellColor(cell.passRate),
                        )}
                      >
                        {cell.passRate.toFixed(0)}%
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
