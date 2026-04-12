import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Rows3,
  Columns3,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { TableProfile } from "../api";
import {
  fmtNumber,
  fmtNumberFull,
  scoreToGrade,
  tableNullScore,
} from "../lib/profiler-utils";
import { TypeBadge, NullBar, SampleValues, nullPct } from "./profiler-badges";
import PiiBadge from "./PiiBadge";

export function TableAccordion({
  table,
  defaultOpen,
}: {
  table: TableProfile;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const highNullCols = table.columns.filter((c) => c.fraction_empty > 0.5);
  const lowCardCols = table.columns.filter(
    (c) => c.unique_count < 5 && c.n_rows > 100,
  );
  const grade = scoreToGrade(tableNullScore(table));

  return (
    <div className="rounded-lg border border-border-default bg-surface-raised overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-overlay transition-colors"
      >
        <span className="text-text-muted">
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </span>
        <span
          className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold shrink-0"
          style={{ backgroundColor: grade.bg, color: grade.color }}
        >
          {grade.letter}
        </span>
        <span className="flex-1 text-sm font-medium text-text-primary font-mono">
          {table.table_name}
        </span>
        <span className="flex items-center gap-3 text-xs text-text-muted">
          <span className="flex items-center gap-1">
            <Rows3 size={12} />
            {fmtNumber(table.row_count)}
          </span>
          <span className="flex items-center gap-1">
            <Columns3 size={12} />
            {table.column_count}
          </span>
          {highNullCols.length > 0 && (
            <span className="flex items-center gap-1 text-accent">
              <AlertTriangle size={12} />
              {highNullCols.length} high-null
            </span>
          )}
          {lowCardCols.length > 0 && (
            <span className="flex items-center gap-1 text-info">
              <Activity size={12} />
              {lowCardCols.length} low-card
            </span>
          )}
        </span>
      </button>

      {open && (
        <div className="border-t border-border-default overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-overlay">
                {["Column", "Type", "Null %", "Distinct", "Sample Values"].map(
                  (header) => (
                    <th
                      key={header}
                      className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-text-muted"
                    >
                      {header}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {table.columns.map((col, i) => {
                const isHighNull = col.fraction_empty > 0.5;
                return (
                  <tr
                    key={col.name}
                    className={cn(
                      "border-t border-border-subtle",
                      i % 2 === 0 ? "bg-surface-raised" : "bg-surface-overlay",
                      isHighNull && "bg-[rgba(232,90,107,0.04)]",
                    )}
                  >
                    <td className="px-4 py-2.5 font-mono text-text-secondary">
                      <div className="flex items-center gap-1.5">
                        {isHighNull && (
                          <AlertTriangle
                            size={11}
                            className="text-critical shrink-0"
                          />
                        )}
                        {col.name}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <TypeBadge type={col.type} />
                        {col.is_potential_pii === true && col.pii_type && (
                          <PiiBadge piiType={col.pii_type} />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5">
                      <NullBar pct={nullPct(col)} />
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-text-muted">
                      {fmtNumberFull(col.unique_count)}
                    </td>
                    <td className="px-4 py-2.5">
                      <SampleValues values={col.values} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
