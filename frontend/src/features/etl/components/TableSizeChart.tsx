import { useMemo } from "react";
import { BarChart3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TableProfile } from "../api";
import { fmtNumber, scoreToGrade, tableNullScore } from "../lib/profiler-utils";

export function TableSizeChart({ tables }: { tables: TableProfile[] }) {
  const { t } = useTranslation("app");
  const sorted = useMemo(
    () => [...tables].sort((a, b) => b.row_count - a.row_count).slice(0, 20),
    [tables],
  );
  const maxRows = sorted[0]?.row_count ?? 1;

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      <div className="px-4 py-3 bg-surface-overlay border-b border-border-default flex items-center gap-2">
        <BarChart3 size={15} className="text-text-muted" />
        <h4 className="text-sm font-medium text-text-primary">
          {t("etl.profiler.sizeChart.title")}
          {tables.length > 20 && (
            <span className="font-normal text-text-ghost ml-1">
              {t("etl.profiler.sizeChart.topTwenty")}
            </span>
          )}
        </h4>
      </div>
      <div className="divide-y divide-border-subtle">
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
              <span className="w-40 shrink-0 font-mono text-xs text-text-secondary truncate">
                {table.table_name}
              </span>
              <div className="flex-1 h-2 rounded-full bg-surface-elevated overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.max(pct, 1)}%`,
                    backgroundColor: "var(--primary)",
                  }}
                />
              </div>
              <span className="w-20 text-right tabular-nums text-xs text-text-muted">
                {fmtNumber(table.row_count)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
