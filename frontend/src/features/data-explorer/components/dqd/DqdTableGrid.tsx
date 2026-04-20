import { useMemo } from "react";
import { useTranslation } from "react-i18next";
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

function getCellColor(passRate: number): string {
  if (passRate >= 90) return "bg-success/15 text-success";
  if (passRate >= 70) return "bg-accent/15 text-accent";
  return "bg-critical/15 text-critical";
}

export function DqdTableGrid({ results }: DqdTableGridProps) {
  const { t } = useTranslation("app");
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
      <div className="flex items-center justify-center rounded-xl border border-border-default bg-surface-raised py-16">
        <p className="text-sm text-text-muted">
          {t("dataExplorer.dqd.tableGrid.noResults")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border-default bg-surface-raised overflow-hidden">
      <div className="border-b border-border-default bg-surface-overlay px-6 py-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {t("dataExplorer.dqd.tableGrid.title")}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-default text-xs text-text-ghost">
              <th className="px-6 py-2 text-left font-medium min-w-[180px]">
                {t("dataExplorer.dqd.tableGrid.cdmTable")}
              </th>
              {[...CATEGORIES, "overall" as const].map((cat) => (
                <th
                  key={cat}
                  className="px-4 py-2 text-center font-medium min-w-[110px]"
                >
                  {t(`dataExplorer.dqd.categories.${cat}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {grid.map((row) => (
              <tr key={row.table} className="hover:bg-surface-overlay transition">
                <td className="px-6 py-2.5">
                  <span className="font-['IBM_Plex_Mono',monospace] text-xs text-text-secondary">
                    {row.table}
                  </span>
                </td>
                {[...CATEGORIES, "overall" as const].map((cat) => {
                  const cell = row.cells[cat];
                  if (!cell) {
                    return (
                      <td key={cat} className="px-4 py-2.5 text-center">
                        <span className="rounded-md bg-surface-elevated px-3 py-1 text-xs text-text-ghost">
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
